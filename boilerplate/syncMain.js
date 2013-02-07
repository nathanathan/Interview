//It might be best to completely scrap using
//local storage due to the space limitations,
//and instead always persist to dropbox or the file system.

require.config({
    'paths': {
        "underscore": "libs/underscore-min",
        "backbone": "libs/backbone-min",
        "backbonels": "libs/backbone-localstorage",
        "dropbox": "libs/dropbox",
        "Filer": "libs/filerjs/src/filer"
    },
    'shim': {
        underscore: {
            'exports': '_'
        },
        backbone: {
            'deps': ['jquery', 'underscore'],
            'exports': 'Backbone'
        }
    }
});

require(['underscore', 'backbone', 'LogItems', 'Sessions', 'dropbox', 'Filer' ],
function( _,            Backbone,   LogItems,   Sessions,   Dropbox,   Filer) {
    /**
     * Takes any number of file path strings as arguments and joins them into one.
     * Trailing and leading slashes are added and removed as needed.
     **/
    function joinPaths() {
        var result = arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            if (result[result.length - 1] !== '/') {
                result += '/';
            }
            if (arguments[i][0] === '/') {
                result += arguments[i].substr(1);
            } else {
                result += arguments[i];
            }
        }
        return result;
    }
    /*
    var logItems = new LogItems();
    var sessions = new Sessions();
    function syncToFS(path, client, callback) {
        client.readdir(path, function syncDir(error, entries, dirStat, entriesStat) {
            if (error) {
                console.error(error);
                client.mkdir(path, function(error, dirStat){
                    if (error) {
                        console.error(error);
                        return;
                    }
                    syncDir(error, [], dirStat, []);
                });
                return;
            }
            entriesStat.forEach(function(entryStat) {
                var session = sessions.get(entryStat.name);
                if (session) {
                    session.set("__lastSynced", new Date());
                    if (entriesStat.versionTag == session.get("versionTag")) {
                        return;
                    }
                    //save session to db
                    //save all session annotations to db
                } else {
                    //if "pull data" checkbox is checked
                    //create session from entry.
                    //session.set("__lastSynced") = new Date();
                }
            });
            sessions.forEach(function(session) {
                if (session.get("__lastSynced")) {
                    //TODO: Add a delete local synced data button.
                    //TODO: Also add dropbox logout button
                    return;
                }
                //save session to db
                //save all session annotations to db
            });
        });
    }
    */
    function readEntriesWithMetadata(dirEntry, success, error){
        var directoryReader = dirEntry.createReader();
        directoryReader.readEntries(function(entries){
            var successCounter = _.after(entries.length, function(){
                success(entries);
            });
            _.forEach(entries, function(entry){
                entry.getMetadata(function(metadata){
                    entry.metadata = metadata;
                    successCounter();
                }, error);
            });
        }, error);
    }
    
    function downloadToFS(path, client, callback) {
        console.log("downloadToFS: " + path);
        client.readdir(path, function(error, entries, dirStat, entriesStat) {
            if (error) {
                console.error(error);
                return;
            }
            console.log("found", entriesStat);
            //Create fs dir
            var filer = new Filer();
            filer.init({
                persistent: true,
                size: 5 * 1024 * 1024
            }, function(fs) {
                filer.mkdir(path, false, function success(dirEntry) {
                    console.log("got/made dir: " + path);
                    readEntriesWithMetadata(dirEntry, function success(localEntries){
                        var entriesToDownload = _.filter(entriesStat, function(entryStat) {
                            return _.every(localEntries, function(localEntry){
                                console.log(localEntry.metadata.modificationTime)
                                return (localEntry.name !== entryStat.name || localEntry.metadata.modificationTime < entryStat.modifiedAt);
                            });
                        });
                        console.log("downloading", entriesToDownload);
                        entriesToDownload.forEach(function(entryStat) {
                            var entryPath = joinPaths(path, entryStat.name);
                            if (entryStat.isDirectory) {
                                downloadToFS(entryPath, client);
                            } else {
                                client.readFile(entryPath, {
                                    arrayBuffer: true
                                }, function(error, content){
                                    if(error){
                                        callback(error);
                                    }
                                    // Write string data.
                                    filer.write(entryPath, {
                                        data: content,
                                        type: entryStat.mimeType//'text/plain'
                                    },
                                    function(fileEntry, fileWriter) {
                                        callback(null, fileEntry);
                                    },
                                    function fail() {
                                        callback("Could not write file: " + entryPath);
                                    });
                                });
                            }
                        });
                    }, function fail() {
                        callback("Could not read directory: " + path);
                    });
                }, function fail() {
                    callback("Could not get directory: " + path);
                });
            }, function fail() {
                callback("Could not get file system");
            });
        });
    }

    var onReady = function() {
        $(function() {
            var authDriver;
            var that = this;
            var client = new Dropbox.Client({
                //TODO: Remove secret?
                key: "on7odfsh27wtjuy", secret: "q90htxlnnlw4kw2",
                sandbox: true
            });
            var $statusEl = $('#status');
            $statusEl.append("<p>Authenticating...</p>");
            if ('cordova' in window) {
                if (window.plugins.childBrowser == null) {
                    ChildBrowser.install();
                }
                authDriver = new Dropbox.Drivers.Popup({
                    //Hack to avoid redirecting to a page on the filesystem.
                    receiverUrl: "http://blank",
                    rememberUser: true,
                    useQuery: true
                });
                authDriver.openWindow = function(url) {
                    return window.plugins.childBrowser.showWebPage(url, {
                        showLocationBar: true
                    });
                };
                authDriver.listenForMessage = function(token, callback) {
                    var listener,
                    _this = this;
                    listener = function(event) {
                        var data;
                        if (event.data) {
                            data = event.data;
                        }
                        else {
                            data = event;
                        }
                        if (_this.locationToken(data) === token) {
                            token = null;
                            window.removeEventListener('message', listener);
                            Dropbox.Drivers.Popup.onMessage.removeListener(listener);
                            return callback();
                        }
                    };
                    window.plugins.childBrowser.onLocationChange = function(url) {
                        console.log(url);
                        if (_this.locationToken(url) === token) {
                            token = null;
                            window.plugins.childBrowser.close();
                            Dropbox.Drivers.Popup.onMessage.removeListener(listener);
                            return callback();
                        }
                    };
                    return Dropbox.Drivers.Popup.onMessage.addListener(listener);
                };
            }
            else {
                authDriver = new Dropbox.Drivers.Redirect({
                    useQuery: true,
                    rememberUser: true
                });
            }
            client.authDriver(authDriver);
            client.authenticate(function(error, client) {
                if (error) {
                    $statusEl.append("<p>Authentication error</p>");
                }
                else {
                    $statusEl.append("<p>Authentication success</p>");
                    afterAuth(client);
                }
            });
            //For debugging:
            window.client = client;
        });
    };

    var afterAuth = function(client) {
        var path = "/sessions/";
        downloadToFS(path, client, function(){
            console.log("downloaded file.");
        });
    };

    if ('cordova' in window) {
        //No need to worry about timing. From cordova docs:
        //This event behaves differently from others in that any event handler
        //registered after the event has been fired will have its callback
        //function called immediately.
        document.addEventListener("deviceready", onReady);
    }
    else {
        onReady();
    }
});
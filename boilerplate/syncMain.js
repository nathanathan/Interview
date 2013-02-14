//It might be best to completely scrap using
//local storage due to the space limitations,
//and instead always persist to dropbox or the file system.

require.config({
    'paths': {
        "underscore": "libs/underscore-min",
        "backbone": "libs/backbone-min",
        "backbonels": "libs/backbone-localstorage",
        "dropbox": "libs/dropbox",
        "sfsf": "libs/sfsf/sfsf"
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

require(['underscore', 'backbone', 'dropbox', 'sfsf'],
function( _,            Backbone,   Dropbox,   sfsf) {
    var statusLog;
    
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
    
    function downloadToFS(localPath, remotePath, client, callback) {
        statusLog("downloadToFS: " + localPath + ", " + remotePath);
        client.readdir(remotePath, function(error, entries, dirStat, entriesStat) {
            if (error) {
                console.error(error);
                return;
            }
            statusLog("found " + entriesStat.length + " entries");
            console.log("found entries:", entriesStat);

            sfsf.cretrieve(localPath, {}, function (error, dirEntry) {
                if(error){
                    callback(error);
                }
                statusLog("got/made directory: " + localPath);
                sfsf.readEntriesWithMetadata(dirEntry, function (error, localEntries){
                    if(error){
                        callback(error);
                        return;
                    }
                    var entriesToDownload = _.filter(entriesStat, function(entryStat) {
                        return _.every(localEntries, function(localEntry) {
                            statusLog(localEntry.metadata.modificationTime);
                            return (localEntry.name !== entryStat.name || localEntry.metadata.modificationTime < entryStat.modifiedAt);
                        });
                    });
                    statusLog("downloading", entriesToDownload);
                    entriesToDownload.forEach(function(entryStat) {
                        var remoteEntryPath = sfsf.joinPaths(remotePath, entryStat.name);
                        var localEntryPath = sfsf.joinPaths(localPath, entryStat.name);
                        if (entryStat.isDirectory) {
                            downloadToFS(localEntryPath, remoteEntryPath, client, callback);
                        } else {
                            client.readFile(remoteEntryPath, {
                                arrayBuffer: true
                            }, function(error, content){
                                if(error){
                                    callback(error);
                                }
                                console.log(content);
                                // Write string data.
                                sfsf.cretrieve(localEntryPath, {
                                    data: content,
                                    type: entryStat.mimeType //'text/plain'
                                }, function(error, fileEntry) {
                                    if(error){
                                        callback(error);
                                    }
                                    callback(null, fileEntry);
                                });
                            });
                        }
                    });
                });
            });
        });
    }

    var onReady = function() {
        $(function() {
            $('#sync').click(startSync);

        });
    };
    var afterAuth = function(client) {
        downloadToFS("interviews", "", client, function(error, fileEntry){
            if(error){
                statusLog("error");
                console.error(error);
                return;
            }
            statusLog("downloaded file: " + fileEntry.name);
        });
    };
    var startSync = function(){
        var authDriver;
        var that = this;
        var client = new Dropbox.Client({
            //TODO: Remove secret?
            key: "on7odfsh27wtjuy", secret: "q90htxlnnlw4kw2",
            sandbox: true
        });
        statusLog = (function(){
            var $statusEl = $('#status');
            return function(statusString){
                var $p = $('<p>');
                $p.text(statusString);
                $statusEl.append($p);
            };
        })();
        statusLog("Authenticating...");
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
        } else {
            authDriver = new Dropbox.Drivers.Redirect({
                useQuery: true,
                rememberUser: true
            });
        }
        client.authDriver(authDriver);
        client.authenticate(function(error, client) {
            if (error) {
                statusLog("Authentication error");
            }
            else {
                statusLog("Authentication success");
                afterAuth(client);
            }
        });
        //For debugging:
        window.client = client;
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
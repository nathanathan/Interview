//It might be best to completely scrap using
//local storage due to the space limitations,
//and instead always persist to dropbox or the file system.

require.config({
    'paths': {
        "underscore": "libs/underscore-min",
        "backbone": "libs/backbone-min",
        "backbonels": "libs/backbone-localstorage",
        "dropbox": "libs/dropbox"
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

require(['underscore', 'backbone', 'dropbox'],
function( _,            Backbone,   Dropbox) {
    var statusLog;
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
    function readEntriesWithMetadata(dirEntry, callback){
        var directoryReader = dirEntry.createReader();
        directoryReader.readEntries(function(entries){
            var successCounter = _.after(entries.length, function(){
                callback(null, entries);
            });
            _.forEach(entries, function(entry){
                entry.getMetadata(function(metadata){
                    entry.metadata = metadata;
                    successCounter();
                }, callback);
            });
        }, callback);
    }
    var politelyRequestFileSystem = function(options, callback){
        function onReady(){
            var defaultOptions = {
                storageNeeded: 5*1024*1024, //5MB
                persistent: true //TODO: false
            };
            options = _.extend(defaultOptions, options || {});
            var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            var PERSISTENT = ("LocalFileSystem" in window) ?  window.LocalFileSystem.PERSISTENT : window.PERSISTENT;
            if(!requestFileSystem) {
                callback("Browser does not support filesystem API");
                return;
            }
            if("webkitStorageInfo" in window && "requestQuota" in window.webkitStorageInfo){
                //We're using chrome probably and need to request storage space.
                window.webkitStorageInfo.requestQuota(PERSISTENT, options.storageNeeded, function(grantedBytes) {
                    requestFileSystem(PERSISTENT, options.storageNeeded, function(fs){
                        callback(null, fs);
                    }, callback);
                }, callback);
            } else {
                requestFileSystem(PERSISTENT, options.storageNeeded, function(fs){
                    callback(null, fs);
                }, callback);
            }
        }
        if ('cordova' in window) {
            document.addEventListener("deviceready", onReady);
        }
        else {
            onReady();
        }
    };
    /**
     * Check that the directory path exists, and creates it if not.
     * Returns the cordova dirEntry object to the success function,
     * and an error string to the fail function.
     **/
    function cretrieve(path, options, callback) {
        politelyRequestFileSystem({}, function(error, fileSystem) {
            if(error){
                callback(error);
                return;
            }
            function justWrite(filePath, options, callback){
                fileSystem.root.getFile(filePath, {
                    create: true,
                    exclusive: false
                }, function(fileEntry) {
                    
                    // Create a FileWriter object for our FileEntry (log.txt).
                    fileEntry.createWriter(function(fileWriter) {
                        
                        fileWriter.onwriteend = function(e) {
                            callback(null, fileEntry)
                        };
                        
                        fileWriter.onerror = callback;
                        
                        // Blob() takes ArrayBufferView, not ArrayBuffer.
                        if (options.data.__proto__ == ArrayBuffer.prototype) {
                            options.data = new Uint8Array(options.data);
                        }
                        
                        var blob = new Blob([options.data], {type: options.type});
                        
                        //TODO: This might be broken in chromium.
                        fileWriter.write(blob);
                        
                    }, callback);
                
                }, callback);
            }
            console.log(fileSystem.name);
            console.log(fileSystem.root.name);
            var dirArray = path.split('/');
            var curPath = '';
            var getDirectoryHelper = function(dirEntry) {
                console.log(curPath);
                var pathSegment = dirArray.shift();
                if(_.isString(pathSegment)) {
                    curPath = joinPaths(curPath, pathSegment);
                    if(dirArray.length === 0){
                        //This is the final segment
                        if(options.data){
                            //Data was included so assume were creating a file.
                            //TODO: Check that the directory doesn't exist.
                            justWrite(curPath, options, callback);
                            return;
                        }
                    }
                    fileSystem.root.getDirectory(curPath, {
                        create: (curPath.length > 1), //avoid creating the root dir.
                        exclusive: false
                    },
                    getDirectoryHelper,
                    callback);
                } else if(dirArray.length !== 0) {
                    callback("Error creating path: " + path);
                } else {
                    callback(null, dirEntry);
                }
            };
            getDirectoryHelper();
        });
    }
    //Add function readFilteredEntries(path, filter, callback)
    
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

            cretrieve(localPath, {}, function (error, dirEntry) {
                if(error){
                    callback(error);
                }
                statusLog("got/made directory: " + localPath);
                readEntriesWithMetadata(dirEntry, function (error, localEntries){
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
                        var remoteEntryPath = joinPaths(remotePath, entryStat.name);
                        var localEntryPath = joinPaths(localPath, entryStat.name);
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
                                cretrieve(localEntryPath, {
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
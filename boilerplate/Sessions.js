define(['jquery', 'backbone', 'underscore', 'LogItems', 'backbonels'],
function($,        Backbone,   _,            LogItems) {
    var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    var PERSISTENT = ("LocalFileSystem" in window) ?  window.LocalFileSystem.PERSISTENT : window.PERSISTENT;
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
    
    var Session = Backbone.Model.extend({
        toJSON: function(){
            var attrs = _.clone(this.attributes);
            if(attrs.startTime) {
                attrs.startTime = String(attrs.startTime);
            }
            if(attrs.endTime) {
                attrs.endTime = String(attrs.endTime);
            }
            return attrs;
        },

        parse: function(attrs) {
            //Parse dates strings into js objects
            if(attrs.startTime) {
                attrs.startTime = new Date(attrs.startTime);
            }
            if(attrs.endTime) {
                attrs.endTime = new Date(attrs.endTime);
            }
            return attrs;
        },

        dropboxSave: function(options){
            
        },
        dropboxFetch: function(options){
            
        },
        
        saveToFS: function(options){
            var that = this;
            var storageNeeded = 5*1024*1024; //5MB
            
            var content = JSON.stringify({
                session: that.toJSON(),
                log: that.Log.toJSON()
            });
            var fileName = joinPaths(options.dirPath, that.get('id') + '.json');
            function saveToFile(filePath, content, success, fail) {
                console.log("saving " + filePath);
                if(!requestFileSystem) {
                    fail("Browser does not support filesystem API");
                    return;
                }
                requestFileSystem(PERSISTENT, storageNeeded, function(fileSystem) {
                    console.log("Got FileSystem");
                    fileSystem.root.getFile(filePath, {
                        create: true,
                        exclusive: false
                    }, function gotFileEntry(fileEntry) {
                        console.log("Got fileEntry");
                        fileEntry.createWriter(function gotFileWriter(writer) {
                            console.log(writer);
                            console.log("created writer");
                            writer.onwriteend = function(evt) {
                                console.log("contents written!");
                                success();
                            };
                            if('chrome' in window){
                                writer.write(new Blob([content], {type: 'text/plain'}));
                            } else {
                                writer.write(content);
                            }
                        }, fail);
                    }, fail);
                }, fail);
            }
            
            if("webkitStorageInfo" in window && "requestQuota" in window.webkitStorageInfo){
                //We're using chrome probably and need to request storage space.
                window.webkitStorageInfo.requestQuota(PERSISTENT, storageNeeded, function(grantedBytes) {
                    saveToFile(fileName, content, options.success, options.error);
                }, options.error);
            } else {
                saveToFile(fileName, content, options.success, options.error);
            }

        }
    });
    
    return Backbone.Collection.extend({

        localStorage: new Backbone.LocalStorage("interview-sessions"),
        
        model: Session,
        
        fetchFromFS: function(options){
            var that = this;
            this.reset();
            requestFileSystem(window.PERSISTENT, 0, function(fileSystem) {
                console.log(fileSystem.name);
                console.log(fileSystem.root.name);
                fileSystem.root.getDirectory(options.dirPath, {
                    exclusive: false
                }, function(dirEntry) {
                    var directoryReader = dirEntry.createReader();
                    // Get a list of all the entries in the directory
                    directoryReader.readEntries(function(entries) {
                        var successCounter = _.after(entries.length, options.success);
                        _.forEach(entries, function(entry){
                            var fileReader = new FileReader();
                            if(entry.isFile){
                                entry.file(function(file){
                                    fileReader.onloadend = function(evt) {
                                        console.log("Read as text");
                                        var fileJSON = JSON.parse(evt.target.result);
                                        var session = new Session();
                                        session.set(session.parse(fileJSON.session));
                                        var logItems = new LogItems();
                                        session.Log = new LogItems(logItems.parse(fileJSON.log));
                                        that.add(session);
                                        successCounter();
                                    };
                                    console.log("calling read...");
                                    try {
                                        fileReader.readAsText(file);
                                        console.log("Reading...");
                                    } catch(e){
                                        if(window.chrome) {
                                            console.error(e);
                                            console.error(file);
                                        }
                                        options.error("Read error");
                                    }
                                }, options.error);
                            }
                        });
                    }, function(error) {
                        alert("Failed to list directory contents: " + error.code);
                    });
                }, function(error) {
                    alert("Unable to access directory: " + error.code);
                });
            }, function failFS(evt) {
                console.log(evt);
                alert("File System Error: " + evt.target.error.code);
            });
            return this;
        },
        collectLogItems: function() {
            var outLogItems = new LogItems();
            this.forEach(function(session){
                console.log(session);
                outLogItems.add(session.Log.models);
            });
            console.log(outLogItems);
            return outLogItems;
        }
    });
});

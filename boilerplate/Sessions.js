define(['jquery', 'backbone', 'underscore', 'LogItems', 'sfsf'],
function($,        Backbone,   _,            LogItems,   sfsf) {
    
    var Session = Backbone.Model.extend({
        
        sync: function(){},
        
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
            var content = JSON.stringify({
                session: that.toJSON(),
                log: that.Log.toJSON()
            });
            var filePath = sfsf.joinPaths(options.dirPath, that.get('id') + '.json');
            console.log("saving " + filePath);
            sfsf.cretrieve(filePath, {
                data: content,
                type: 'text/plain'
            }, function(error) {
                if(error){
                    options.error(error);
                    return;
                }
                console.log("contents written!");
                options.success();
            });
            /*
            sfsf.politelyRequestFileSystem(function(error, fileSystem) {
                if(error){
                    options.error(error);
                    return;
                }
                console.log("Got fileSystem");
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
                            options.success();
                        };
                        if('chrome' in window){
                            writer.write(new Blob([content], {type: 'text/plain'}));
                        } else {
                            writer.write(content);
                        }
                    }, options.error);
                }, options.error);
            });
            */
        }
    });
    
    return Backbone.Collection.extend({
        
        model: Session,
        
        fetchFromFS: function(options){
            var that = this;
            this.reset();
            sfsf.politelyRequestFileSystem(function(error, fileSystem) {
                if(error) {
                    options.error(error);
                    return;
                }
                console.log(fileSystem.name);
                console.log(fileSystem.root.name);
                fileSystem.root.getDirectory(options.dirPath, {
                    exclusive: false
                }, function(dirEntry) {
                    var directoryReader = dirEntry.createReader();
                    // Get a list of all the entries in the directory
                    directoryReader.readEntries(function(entries) {
                        var filteredEntries = _.filter(entries, function(entry){
                            return entry.isFile && entry.name.slice(-5) === ".json";
                        });
                        var successCounter = _.after(filteredEntries.length, options.success);
                        filteredEntries.forEach(function(entry){
                            var fileReader = new FileReader();
                            entry.file(function(file){
                                fileReader.onloadend = function(evt) {
                                    console.log("finished reading: " + entry.name);
                                    var fileJSON;
                                    try{
                                        fileJSON = JSON.parse(evt.target.result);
                                    } catch(e) {
                                        alert("File could not be parsed: " + entry.name);
                                        console.log(e);
                                        //If the file could not be parsed we notify the user and continue.
                                        //This is most likely due to errors when writing
                                        successCounter();
                                        return;
                                    }
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
                        });
                    }, function(error) {
                        alert("Failed to list directory contents: " + error.code);
                    });
                }, function(error) {
                    alert("Unable to access directory: " + error.code);
                });
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

define(['jquery', 'backbone', 'underscore', 'LogItems', 'sfsf', 'TagCollection'],
function($,        Backbone,   _,            LogItems,   sfsf,   TagCollection) {
    
    /**
     * From backbone-localstorage:
     * Generate a pseudo-GUID by concatenating random hexadecimal.
     **/
    function GUID() {
        // Generate four random hex digits.
        function S4() {
           return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }
       return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }
    
    var Session = Backbone.Model.extend({
        
        initialize: function(){
            this.tagLayers = {};
        },
        
        defaults: function(){
            return {
                id: GUID()
            };
        },
        
        sync: function(){},
        
        //JSON stringifies dates in a way that the Date object can't parse in webkits.
        //Try: new Date(JSON.parse(JSON.stringify(new Date())))
        //To avoid this issue dates can be stringified with the String function.
        //Use .toUTCString instead?
        toJSON: function() {
            var attrs = _.clone(this.attributes);
            _.each(attrs, function(attrName, attrValue){
                if(_.isDate(attrValue)){
                    attrs[attrName] = String(attrValue);
                }
            });
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
                console.log("main content written, persisting layers...");
                var tagLayerNames = _.keys(that.tagLayers);
                var successCounter = _.after(tagLayerNames.length, options.success);
                _.each(tagLayerNames, function(layerName){
                    that.tagLayers[layerName].saveToFS(_.extend({}, options, {
                        success: successCounter
                    }));
                });
            });
            
        },
        
        addTag: function(layerName, tag, timestamp){
            if(!(layerName in this.tagLayers)){
                this.tagLayers[layerName] = new TagCollection([], {
                    id: this.get("id"),
                    layerName: layerName
                });
            }
            this.tagLayers[layerName].create({tag : tag, _timestamp : timestamp});
        },
        
        fetchTagLayers: function(options){
            var that = this;
            that.tagLayers = {};
            //Search FS for tag collections corresponding to this session.
            //Read each collection and add them to this.
            //voila
            sfsf.politelyRequestFileSystem(function(error, fileSystem) {
                if(error) {
                    options.error(error);
                    return;
                }
                fileSystem.root.getDirectory(options.dirPath, {
                    exclusive: false
                }, function(dirEntry) {
                    var directoryReader = dirEntry.createReader();

                    // Get a list of all the entries in the directory
                    directoryReader.readEntries(function(entries) {
                        var filteredEntries = _.filter(entries, function(entry){
                            var nameParse = entry.name.split('.');
                            if(!entry.isFile) return false;
                            if(nameParse[3] !== "json") return false;
                            if(nameParse[2] !== "tags") return false;
                            if(nameParse[0] !== that.get("id")) return false;
                            entry.layerName = nameParse[1];
                            return true;
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
                                    that.tagLayers[entry.layerName] = new TagCollection(fileJSON, {
                                        id:that.get("id"),
                                        layerName: entry.layerName
                                    });
                                    //TODO: Can this be removed?
                                    that.tagLayers[entry.layerName].each(function(tag){
                                        if(!_.isDate(tag.get("_timestamp"))){
                                            console.log("Tag timestamps are not parsed");
                                            tag.set("_timestamp", new Date(tag.get("_timestamp")));
                                        }
                                    });
                                    successCounter();
                                };
                                console.log("calling read...");
                                try {
                                    fileReader.readAsText(file);
                                    console.log("Reading...");
                                } catch(e) {
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
                            var nameParse = entry.name.split('.');
                            if(!entry.isFile) return false;
                            if(nameParse.length !== 2) return false;
                            if(nameParse[1] !== "json") return false;
                            return true;
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
        /**
         * Gather all the logItems of all the sessions into a single LogItem collection.
         **/
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

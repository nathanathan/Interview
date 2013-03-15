/*
Simple File System Functions:
Notes:
Everything uses errbacks.
*/
var init = function(_){
    var sfsf = {
    /**
     * Takes any number of file path strings as arguments and joins them into one.
     * Tries to copy python's os.path.join
     **/
    joinPaths : function() {
        var result = arguments[0];
        for (var i = 1; i < arguments.length; i++) {
            if(result === '') {
                result += arguments[i];
            } else if(result[result.length - 1] === '/'){
                if (arguments[i][0] === '/') {
                    result += arguments[i].substr(1);
                } else {
                    result += arguments[i];
                }
            } else {
                if (arguments[i][0] === '/') {
                    result += arguments[i];
                } else {
                    result += '/' + arguments[i];
                }
            }
        }
        return result;
    },
    /**
     * Reads a directory and adds a metadata property to each entry
     * with the 
     **/
    readEntriesWithMetadata: function(dirEntry, callback){
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
    },
    /**
     * This will request the file system, but it will also wait for cordova to load
     * and request storage space if need be.
     */
    politelyRequestFileSystem : function(options, callback){
        if(_.isFunction(options)){
            callback = options;
        }
        function onReady(){
            var defaultOptions = {
                storageNeeded: 5*1024*1024, //5MB
                persistent: true //TODO
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
    },
    /**
     * Retrieve the file/directory and create it if it does not exist.
     * The file system is automatically requested with the default options.
     **/
    cretrieve : function(path, options, callback) {
        if(_.isFunction(options)){
            callback = options;
            options = {};
        }
        options = _.extend({
            //Treat as file by default if last segment contains a dot
            isFile: path.split('/').pop().match('\\.'),
            type: 'text/plain'
        }, options);
        sfsf.politelyRequestFileSystem({}, function(error, fileSystem) {
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
                        
                        if('cordova' in window){
                            fileWriter.write(options.data);
                        } else {
                            // Blob() takes ArrayBufferView, not ArrayBuffer.
                            if (options.data.__proto__ == ArrayBuffer.prototype) {
                                options.data = new Uint8Array(options.data);
                            }
                            fileWriter.write(new Blob([options.data], {type: options.type }));
                        }
                    }, callback);
                
                }, callback);
            }

            //Monkey patch for fullPath not being relative to the root.
            if(path.search(fileSystem.root.fullPath) === 0) {
                path = path.substring(fileSystem.root.fullPath.length);
            }
            
            //Prevent the leading slash from being used when splitting.
            if(path[0] === "/") {
                path = path.substring(1);
            }
            
            var dirArray = path.split('/');
            var curPath = '';
            var getDirectoryHelper = function(dirEntry) {
                var pathSegment = dirArray.shift();
                if(_.isString(pathSegment) && pathSegment !== '') {
                    curPath = sfsf.joinPaths(curPath, pathSegment);
                    console.log("curPath:", curPath);
                    if(dirArray.length === 0){
                        //This is the final segment
                        if(options.data){
                            //Data was included so assume were creating a file.
                            //TODO: Check that the directory doesn't exist.
                            justWrite(curPath, options, callback);
                            return;
                        }
                        if(options.isFile){
                            fileSystem.root.getFile(curPath, {
                                create: true,
                                exclusive: false
                            },
                            function(fileEntry){
                                callback(null, fileEntry);
                            },
                            callback);
                            return;
                        }
                    }
                    fileSystem.root.getDirectory(curPath, {
                        create: (curPath !== '/' && curPath !== ''), //avoid creating the root dir.
                        exclusive: false
                    },
                    getDirectoryHelper,
                    callback);
                } else if(dirArray.length !== 0) {
                    callback("Error cretrieving path: " + path);
                    console.log(dirArray);
                } else {
                    callback(null, dirEntry);
                }
            };
            getDirectoryHelper();
        });
    }
    };
    return sfsf;
};
if("define" in window){
    define(['underscore'], init);
} else {
    window.sfsf = init(_);
}
define([
	'jquery', 
	'backbone', 
	'underscore',
    'text!main.html',
    'text!dirListView.html'], 
function($, Backbone, _, mainTemplateHtml, dirListView){
    var mainTemplate = _.template(mainTemplateHtml);
    function getDirList(dirPath, callback) {
        console.log("getDirList");
        console.log(dirPath);
        if(!('requestFileSystem' in window)) {
            alert('Cannot call requestFileSystem');
            var fakeMetaDataFunction = function(success, fail){
                success({
                    modificationTime: new Date(Math.random()*2000000000000)
                });
            };
            var fakeEntries = [{
                isFile: true,
                isDirectory: false,
                name: "fakeFile.js",
                fullPath: dirPath + "fakeFile.js",
                getMetadata: fakeMetaDataFunction
            }, {
                isFile: false,
                isDirectory: true,
                name: "fakeDir",
                fullPath: dirPath + "fakeDir",
                getMetadata: fakeMetaDataFunction
            }, {
                isFile: false,
                isDirectory: true,
                name: "fakeDir2",
                fullPath: dirPath + "fakeDir2",
                getMetadata: fakeMetaDataFunction
            }];
            callback(fakeEntries);
            return;
        }
        window.requestFileSystem(window.LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
            console.log(fileSystem.name);
            console.log(fileSystem.root.name);
            $('#file-system-text').html("File System: <strong>" + fileSystem.name + "</strong> " + "Root: <strong>" + fileSystem.root.name + "</strong>");
            fileSystem.root.getDirectory(dirPath, {
                create: true,
                exclusive: false
            }, function(dirEntry) {
                var directoryReader = dirEntry.createReader();
                // Get a list of all the entries in the directory
                directoryReader.readEntries(function(entries) {
                    callback(entries);
                }, function(error) {
                    alert("Failed to list directory contents: " + error.code);
                });
            }, function(error) {
                alert("Unable to create new directory: " + error.code);
            });
        }, function failFS(evt) {
            console.log(evt);
            alert("File System Error: " + evt.target.error.code);
        });
    }
    
    var DirView = Backbone.View.extend({
        template: _.template(dirListView),
        orderVar: 1,
        render: function() {
            console.log('render');
            this.$el.html(this.template({
                entries : this.collection.toJSON()
            }));
            return this;
        },
        events: {
            'click .sort-name' : 'sortName',
            'click .sort-date' : 'sortDate',
            'click .refresh' : 'refresh'
        },
        genComparator : function(cfunc, incr) {
            if(!incr) {
                incr = 1;
            }
            return function(Ain, Bin) {
                var A = cfunc(Ain);
                var B = cfunc(Bin);
                if(A < B) return -incr;
                if(A > B) return incr;
                if(A == B) return 0;
            };
        },
        sortName: function(e) {
            console.log('sortName');
            console.log(e);
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("name");
            }, this.orderVar);
            this.collection.sort();
            this.render();
            return this;
        },
        sortDate: function(e) {
            console.log('sortTime');
            console.log(e);
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("_modificationTime");
            }, this.orderVar);
            this.collection.sort();
            this.render();
            return this;
        },
        refresh: function(e) {
            console.log('refresh');
            console.log(e);
            var that = this;
            getDirList(that.options.dirPath, function(entries) {
                console.log('got entries');
                console.log(entries);
                var afterMetadataAttached = _.after(entries.length, function() {
                    console.log('resetting entries');
                    that.collection['reset'](entries);
                    that.render();
                });
                //Go through all the entries and asynchronously get their metadatas.
                console.log('attaching metadata');
                _.each(entries, function(entry){
                    entry.getMetadata(function success(metaData){
                        entry._modificationTime = metaData.modificationTime;
                        console.log(entry._modificationTime);
                        afterMetadataAttached();
                    }, function fail(err){
                        alert("Could not get metadata");
                    });
                });
            });
            return this;
        }
    });
    
    //indexRelPathPrefix computed so the location of the boilerplate directory can change
    //only requiring modification of index.html
    //I haven't tested it though.
    //var indexRelPathPrefix = _.map(require.toUrl('').split('/'), function(){return '';}).join('../');
	var Router = Backbone.Router.extend({
        currentContext: {
            page: '',
            qp: {},
            last: {},
            url: ''
        },
		initialize: function(){
			Backbone.history.start();
            //TODO: Loading message?
		},
		routes: {
            '': 'main',
			'listFiles': 'listFiles'
		},
        main: function(params){
            console.log('main');
            $("#container").html(mainTemplate());
            //this.navigate('listFiles', {trigger: true, replace: true});
        },
		listFiles: function(page, params){
            console.log('params:');
            console.log(params);
            if(!params){
                params = {};
            }
            params = _.extend({
                "dirPath" : "odk/js/forms/"
            }, params);
            
            var myDirView = new DirView({
                collection: new Backbone.Collection(),
                dirPath: params.dirPath
            });
            myDirView.setElement(document.getElementById("container"));
            myDirView.refresh();
		}
	});
	return Router;
});

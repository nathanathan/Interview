require.config({ 
    'paths': { 
		"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "sfsf": "libs/sfsf/sfsf",
        "jszip" : "libs/XLSXInterview/js-xlsx/jszip",
        "jsxlsx" : "libs/XLSXInterview/js-xlsx/xlsx",
        "XLSXInterview" : "libs/XLSXInterview/XLSXInterview"
	},
	'shim': 
	{
        underscore: {
			'exports': '_'
		},
		backbone: {
			'deps': ['jquery', 'underscore'],
			'exports': 'Backbone'
		},
        jsxlsx: ['jszip'],
        jszip: []
	}	
});

require([
    'config',
    'underscore',
    'backbone',
    'text!chooser/dirList.html',
    'sfsf',
    'mixins'
], 
function(config, _, Backbone, dirListView, sfsf){
    
    var InterviewListView = Backbone.View.extend({
        template: _.template(dirListView),
        orderVar: 1,
        render: _.debounce(function() {
            console.log('render');
            console.log(this.collection.toJSON());
            this.$el.html(this.template({
                status : this.options.status.toJSON(),
                interviews : this.collection.toJSON()
            }));
            return this;
        }, 200),
        events: {
            'click .sort-name' : 'sortName',
            'click .sort-date' : 'sortDate',
            'click .refresh' : 'refresh',
            'click .install-example' : 'installExample'
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
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("name");
            }, this.orderVar);
            this.collection.sort();
            return this;
        },
        sortDate: function(e) {
            console.log('sortTime');
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("modificationTime");
            }, this.orderVar);
            this.collection.sort();
            return this;
        },
        refresh: function(e) {
            console.log('refresh');
            this.collection.fetchFromFS();
            return this;
        },
        installExample: function(){
            var that = this;
            var status = this.options.status;
            status.set("installing", true);
            var files = [
                'example/start.html',
                'example/interview.json',
                'example/star.png' //TODO: This isn't working...
            ];
            var afterInstall = _.after(files.length, function(err){
                status.set("installing", false);
                that.refresh();
            });
            _.each(files, function(file){
                require(['text!../' + file],
                function(fileContent) {
                    var type = 'text/plain';
                    if (file.slice(-3) === 'png') {
                        type = 'image/png';
                    }
                    sfsf.cretrieve(sfsf.joinPaths(config.appDir, 'interviews', file), {
                        data: fileContent,
                        type: type
                    }, function(err){
                        if(err) {
                            status.set("error", String(err));
                            console.error(err);
                        }
                        afterInstall();
                    });
                });
            });
        }
    });
    var generateJSON = function(xlsxPath, outPath, callback) {
        require(["jszip", "jsxlsx", "XLSXInterview"], function(){
            console.log("xlsxPath", xlsxPath);
            console.log("outPath", outPath);
            sfsf.cretrieve(xlsxPath, function(err, entry){
                if(err){
                    callback(err);
                    console.log(err);
                    return;
                }
                var reader = new FileReader();
                entry.file(function(file){
                    reader.onload = function(e) {
                        var dataURL = e.target.result;
                        var data = dataURL.substring(dataURL.search("base64,") + 7);
                        console.log(data);
                        console.log("Reading XLSX data...");
                        var xlsx = XLSX.read(data, {type: 'base64'});
                        var workbookToJSON = function(workbook) {
                            var result = {};
                            workbook.SheetNames.forEach(function(sheetName) {
                                var rObjArr = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                                if(rObjArr.length > 0){
                                    result[sheetName] = rObjArr;
                                }
                            });
                            return result;
                        }
                        console.log("Writing JSON def...");
                        try {
                            sfsf.cretrieve(outPath, {
                                data: JSON.stringify(XLSXInterview.processWorkbook(workbookToJSON(xlsx)), 2, 2)
                            }, callback);
                        } catch(e){
                            console.log("Error processing XLSX File.");
                            callback(e);
                        }
                    };
                    console.log("Reading XLSX file...");
                    reader.readAsDataURL(file);
                });
            });
        });
    };
    var InterviewDefs = Backbone.Collection.extend({
        fetchFromFS: function(){
            //There is a potential bug here if this function gets called again
            //before the previous fetch finishes.
            var that = this;
            sfsf.cretrieve(sfsf.joinPaths(config.appDir, 'interviews'), function(error, dirEntry) {
                if(error){
                    that.trigger("error", error);
                    return;
                }
                sfsf.readEntriesWithMetadata(dirEntry, function (error, entries){
                    if(error){
                        that.trigger("error", error);
                        return;
                    }
                    entries = _.filter(entries, function(entry){
                        return entry.isDirectory;
                    });
                    var remainingEntries = entries.length;
                    that['reset']();
                    _.each(entries, function(entry){

                        sfsf.readEntriesWithMetadata(entry, function (error, entries){
                            that.trigger("error", "No json or xlsx interview");
                            //The map function is used to convert the EntryList object into a normal array.
                            var jsonEntry = _.find(entries, function(entry) {
                                return entry.name === "interview.json";
                            });
                            var xlsxEntry = _.find(entries, function(entry) {
                                return entry.name === "interview.xlsx";
                            });
                            var entryModel = new Backbone.Model({
                                name: entry.name,
                                modificationTime: entry.metadata.modificationTime
                            });
                            if(!jsonEntry && !xlsxEntry){
                                entryModel.set("error", "No json or xlsx files for interview");
                            }
                            if(xlsxEntry) {
                                var xlsxModTime = xlsxEntry.metadata.modificationTime;
                                var jsonModTime = jsonEntry ? jsonEntry.metadata.modificationTime : new Date(0);
                                if(xlsxModTime > jsonModTime) {
                                    entryModel.set("converting", true);
                                    generateJSON(xlsxEntry.fullPath, sfsf.joinPaths(entry.fullPath, "interview.json"),
                                    function(err) {
                                        if(err) {
                                            entryModel.set("error", String(err));
                                            console.log(err);
                                        }
                                        entryModel.set("converting", false);
                                    });
                                }
                            }
                            entryModel.on("change", function(){
                                that.trigger("change");
                            });
                            that.add(entryModel);
                            remainingEntries--;
                            that.trigger("fetchUpdate", remainingEntries);
                        });

                    });                    
                });
            });
            return this;
        }
    });

    var onReady = function() {
        $(function() {
            //This is a patch to make it so form submission puts the params after
            //the hash so they can be picked up by Backboneqp.
            $(document).submit(function(e) {
                e.preventDefault();
                window.location = $(e.target).attr('action') + '?' + $(e.target).serialize();
            });
            
            var status = new Backbone.Model({
                interviewsToFetch: 0,
                error: null,
                installing: false,
                converting: ""
            });
            var myInterviewDefs = new InterviewDefs();
            myInterviewDefs.on("fetchUpdate", function(remainingEntries){
                status.set("interviewsToFetch", remainingEntries);
                if(remainingEntries === 0){
                    status.set("converting", "");
                }
            });
            myInterviewDefs.on("fetchError", function(error){
                status.set("error", error);
            });
            
            var myInterviewList = new InterviewListView({
                collection: myInterviewDefs,
                el: $(".container").get(0),
                status: status
            });
            myInterviewList.render();

            myInterviewDefs.on('all', _.debounce(myInterviewList.render, 100), myInterviewList);
            status.on('change', _.debounce(myInterviewList.render, 100), myInterviewList);
            myInterviewList.refresh();
        });
    };
    //This works for android but it might not work everywhere:
    var isCordovaApp = document.URL.indexOf( 'http://' ) === -1 && document.URL.indexOf( 'https://' ) === -1;
    
    if (isCordovaApp) {
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

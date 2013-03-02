require.config({ 
    'paths': { 
		"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "sfsf": "libs/sfsf/sfsf"
	},
	'shim': 
	{
        underscore: {
			'exports': '_'
		},
		backbone: {
			'deps': ['jquery', 'underscore'],
			'exports': 'Backbone'
		}
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
        render: function() {
            console.log('render');
            console.log(this.collection.toJSON());
            this.$el.html(this.template({
                interviews : this.collection.toJSON()
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
            return this;
        },
        sortDate: function(e) {
            console.log('sortTime');
            console.log(e);
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("modificationTime");
            }, this.orderVar);
            this.collection.sort();
            return this;
        },
        refresh: function(e) {
            console.log('refresh');
            console.log(e);
            this.collection.fetchFromFS();
            return this;
        }
    });
    
    var InterviewDefs = Backbone.Collection.extend({
        fetchFromFS: function(options){
            var that = this;
            if(!options){
                options = {};
            }
            options = _.extend({
                success: function(){},
                fail: function(){}
            }, options);
            
            sfsf.cretrieve(sfsf.joinPaths(config.appDir, 'interviews'), function(error, dirEntry) {
                if(error){
                    options.fail(error);
                    return;
                }
                sfsf.readEntriesWithMetadata(dirEntry, function (error, entries){
                    if(error){
                        options.fail(error);
                        return;
                    }
                    console.log('resetting entries');
                    console.log(entries);
                    //The map function is used to convert the EntryList object into a normal array.
                    that['reset'](_(entries).filter(function(entry) {
                        return entry.isDirectory;
                    }).map(function(entry) {
                        //Attach interview data?
                        return entry;
                    }));
                    options.success(that);
                });
            });
            return this;
        }
    });
    
    var installDefaultInterview = function(callback){
        var files = [
            'example/start.html',
            'example/interview.json',
            'example/star.png' //TODO: This isn't working...
        ];
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
                }, callback);
            });
        });
    };
    
    var onReady = function() {
        $(function() {
            //This is a patch to make it so form submission puts the params after
            //the hash so they can be picked up by Backboneqp.
            $(document).submit(function(e) {
                e.preventDefault();
                window.location = $(e.target).attr('action') + '?' + $(e.target).serialize();
            });
                    
            document.addEventListener("backbutton", function() {
                //disable back presses.
            }, false);
            
            var myInterviewDefs = new InterviewDefs();
            var myInterviewList = new InterviewListView({
                collection: myInterviewDefs,
                el: $(".container").get(0)
            });
            myInterviewDefs.on('all', myInterviewList.render, myInterviewList);
            myInterviewDefs.fetchFromFS({
                success: function(){
                    console.log("Success!");
                    if(myInterviewDefs.length === 0){
                        console.log("No interviews found, installing default.");
                        installDefaultInterview(function(err){
                            if(err) {
                                console.error(err);
                            }
                            myInterviewDefs.refresh();
                        });
                    }
                },
                fail: function(err){
                    console.error(err);
                }
            });
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
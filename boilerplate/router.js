//TODO: Move collections + models into separate files
//TODO: Perhap I should lazy load some of the templates.
console.log("In router.js");
define([
	'jquery', 
	'backbone', 
	'underscore',
    'text!opening.html',
    'text!body.html',
    'text!interviewEnd.html',
    'text!sessions.html'], 
function($, Backbone, _, openingTemplate, bodyTemplate, interviewEndTemplate, sessionsTemplate){
    console.log("Defining router");
    var compiledOpeningTemplate = _.template(openingTemplate);
    var compiledBodyTemplate = _.template(bodyTemplate);
    var compiledInterviewEndTemplate = _.template(interviewEndTemplate);
    var compiledSessionsTemplate = _.template(sessionsTemplate);
    console.log("Templates compiled");
    
    //TODO: Implement include function for templates.
    // it will return a stub, and then asyc get the template.
    // and fill in the stub when it loads.
    // Maybe it could be a require.js plugin?
    
    // From backbone-localstorage:
    // Generate four random hex digits.
    function S4() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    // Generate a pseudo-GUID by concatenating random hexadecimal.
    function GUID() {
       return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }
    
    //Session made global for easy debugging.
    window.session = null;
    //var session = null;
    
    var interviewTitle = $('title').text();
    
    var Sessions = Backbone.Collection.extend({
        
        localStorage: new Backbone.LocalStorage("interview-sessions")
        
    });
    
    var mySessions = new Sessions();
    
    var LogItem = Backbone.Model.extend({
    
        defaults: function() {
            return {
                _timestamp : new Date(),
                _sessionId : session.id
            };
        },
    
        validate: function(attrs) {
            if (!attrs.page) {
                return "page missing";
            }
        }

    });
    
    var LogItems = Backbone.Collection.extend({
    
        model: LogItem,
        
        //Might need to use interview title?
        //And be careful not to fetch in a interview
        //hopefully save doesn't overwrite
        localStorage: new Backbone.LocalStorage("interview-logItems"),

        save: function(context) {
            var defaultContext = {
                success: function(){},
                error: function(){}
            };
            if(context) {
                context = _.extend(defaultContext, context);
            } else {
                context = defaultContext;
            }
            var itemContext = {
                success: _.after(this.length, context.success),
                error: _.once(context.error)
            };
            this.forEach(function(logItem) {
                console.log('test');
                logItem.save(null, itemContext);
            });
        },

        comparator: function(todo) {
            return todo.get('_timestamp');
        },
                
        rfind: function(iterator) {
            for(var i=(this.length - 1); i >= 0; i--){
                if(iterator(this.models[i])) {
                    return this.models[i];
                }
            }
        },
        
        /**
         * Returns the most recently logged value of the given attribute.
         * If the attribute is not found returns defaultValue.
         */
        getAttr: function(attrName, defaultValue) {
            var foundItem = session.Log.rfind(function(logItem){
                return logItem.has(attrName);
            });
            if(foundItem){
                return foundItem.get(attrName);
            }
            return defaultValue;
        }
    
    });
    /**
     * Check that the directory path exists, and creates it if not.
     * Returns the cordova dirEntry object to the success function,
     * and an error string to the fail function.
     **/
    function getDirectory(dirPath, success, fail){
        //No need to worry about timing. From cordova docs:
        //This event behaves differently from others in that any event handler
        //registered after the event has been fired will have its callback
        //function called immediately.
        document.addEventListener("deviceready", function onDeviceReady() {
            window.requestFileSystem(window.LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
                console.log(fileSystem.name);
                console.log(fileSystem.root.name);
                var dirArray = dirPath.split('/');
                var curDir = '';
                var getDirectoryHelper = function(dirEntry){
                    console.log(curDir);
                    if(dirArray.length > 0){
                        curDir += dirArray.shift() + '/';
                        fileSystem.root.getDirectory(curDir, {
                            create: true,
                            exclusive: false
                        },
                        getDirectoryHelper,
                        function(error) {
                            fail("Unable to create new directory: " + error.code);
                        });
                    } else {
                        success(dirEntry);
                    }
                };
                getDirectoryHelper();
            }, function failFS(evt) {
                console.log(evt);
                fail("File System Error: " + evt.target.error.code);
            });
        });
    }
    
    //indexRelPathPrefix computed so the location of the boilerplate directory can change
    //only requiring modification of index.html
    //I haven't tested it though.
    var indexRelPathPrefix = _.map(require.toUrl('').split('/'), function(){return '';}).join('../');
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
            '': 'opening',
            'sessions': 'showSessions',
            'interviewStart': 'interviewStart',
            'interviewEnd':'interviewEnd',
            //order is important here:
            ':page': 'setPage'
		},
        opening: function(){
            $('body').html(compiledOpeningTemplate({title: interviewTitle}));
        },
        showSessions: function(){
            mySessions.fetch({success: function(){
                $('body').html(compiledSessionsTemplate({sessions: mySessions.toJSON()}));
            }});
            
        },
        interviewStart: function start(){
            var that = this;
            var sessionId = GUID();
            //TODO: Slugify interview title
            var recordingDir = 'interviews/' + interviewTitle + '/';
            var recordingName = sessionId + ".amr";
            session = mySessions.create({
                id: sessionId,
                startTime: new Date()
            });
            session.Log = new LogItems();
            
            $('body').html(compiledBodyTemplate());
            var $stop = $('#stop');
            var $time = $('#time');
            var recStartTime = new Date();
            function setAudioPosition(time){
                $time.text((new Date() - recStartTime) / 1000);
            }
            if('Media' in window) {
                //TODO: Check that directory exists, and create it if not.
                //TODO: Should probably be using these callbacks.
                getDirectory(recordingDir, function(dirEntry){
                    var mediaRec = new Media(dirEntry.toURL() + recordingName, function beginRecording(){
                        console.log("media ready: " + dirEntry.toURL() + recordingName);
                        mediaRec.startRecord();
                        var recInterval = setInterval(function() {
                            setAudioPosition();
                        }, 1000);
                        $stop.click(function(){
                            $stop.addClass('disabled');
                            mediaRec.stopRecord();
                            mediaRec.release();
                            clearInterval(recInterval);
                        });
                        that.navigate('start.html', {trigger: true, replace: true});
                    }, function onError(){
                        alert("Media error.");
                    });
                }, function(err){
                    alert(err);
                });
            } else {
                //TODO: How do dismiss?
                //TODO: Use template.
                $('#alert-area').html('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Warning!</h4> Audio is not being recorded.</div>');
                that.navigate('start.html', {trigger: true, replace: true});
            }
        },
        interviewEnd: function(){
            var that = this;
            /*
            session.Log.add({
                page: "interviewEnd",
                lastPage: this.currentContext.page
            });
            */
            session.set("endTime", new Date()).save();
            $('body').html(compiledInterviewEndTemplate());
            $('#save').click(function(){
                //TODO: Find a way to save recordings into the interview folder
                //And try to make it possible to hear them entirely via HTML Audio.
                //alert("Implement storage");
                var success = function(){
                    session = null;
                    that.navigate('', {trigger: true, replace: true});
                };
                session.Log.save({
                    success: success,
                    error: function(err) {
                        $('#alert-area').html('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Error!</h4> Could not save.</div>');
                    }
                });
            });
            $('#discard').click(function(){
                session = null;
                that.navigate('', {trigger: true, replace: true});
            });
        },
        setPage: function(page, params){
            var that = this;
            console.log('params:');
            console.log(params);
            if(!params){
                params = {};
            }
            if(session){
                session.Log.add(_.extend({}, params, {
                    page: page,
                    lastPage: that.currentContext.page
                }));
            }
            require(['text!' + indexRelPathPrefix + page], function(template){
                var compiledTemplate, renderedHtml;
                that.currentContext = {
                    page: page,
                    qp: params,
                    last: that.currentContext,
                    url: that.toFragment(page, params)
                };
                try{
                    compiledTemplate = _.template(template);
                } catch(e) {
                    console.error(e);
                    alert("Error compiling template.");
                }
                try{
                    renderedHtml = compiledTemplate(that.currentContext);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
                $('#container').html(renderedHtml);
            }, function(error){
                console.error(error);
                alert("Could not load page: " + error.requireModules[0].substring(5));
            });
        }
	});
	return Router;
});

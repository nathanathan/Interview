define([
	'jquery', 
	'backbone', 
	'underscore',
    'LogItems',
    'Sessions',
    'text!interviewer/opening.html',
    'text!interviewer/body.html',
    'text!interviewer/interviewEnd.html',
    'text!interviewer/sessions.html',
    'backboneqp'],
function($, Backbone, _, LogItems, Sessions,
         openingTemplate, bodyTemplate, interviewEndTemplate, sessionsTemplate){
    console.log("Compiling templates...");
    var compiledOpeningTemplate = _.template(openingTemplate);
    var compiledBodyTemplate = _.template(bodyTemplate);
    var compiledInterviewEndTemplate = _.template(interviewEndTemplate);
    var compiledSessionsTemplate = _.template(sessionsTemplate);
    console.log("Templates compiled");
    
    //TODO: Implement include function for templates.
    // it will return a stub, and then asyc get the template.
    // and fill in the stub when it loads.
    // Maybe it could be a require.js plugin?
    
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
                    var pathSegment = dirArray.shift();
                    if(pathSegment){
                        curDir += pathSegment + '/';
                        fileSystem.root.getDirectory(curDir, {
                            create: true,
                            exclusive: false
                        },
                        getDirectoryHelper,
                        function(error) {
                            fail("Unable to create new directory: " + error.code);
                        });
                    } else if(dirArray.length !== 0) {
                        fail("Error creating path: " + dirPath);
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
    
    var mySessions = new Sessions();
    var interviewTitle = $('title').text();
    var timerUpdater;
    //indexRelPathPrefix computed so the location of the boilerplate directory can change
    //only requiring modification of index.html
    //I haven't tested it though.
    var indexRelPathPrefix = _.map(require.toUrl('').split('/'), function(){return '';}).join('../');
    //Session made global for easy debugging.
    window.session = null;
    //var session = null;

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
            'interviewEnd': 'interviewEnd',
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
            var $time;
            var sessionId = GUID();
            //TODO: Slugify interview title
            var recordingDir = 'interviews/' + interviewTitle + '/';
            var recordingName = sessionId + ".amr";
            session = mySessions.create({
                id: sessionId,
                startTime: new Date(),
                interviewTitle: interviewTitle
            });
            session.Log = new LogItems();
            
            $('body').html(compiledBodyTemplate());
            $time = $('#time');
            
            timerUpdater = window.setInterval(function() {
                $time.text(Math.round((new Date() - session.get('startTime')) / 1000));
            }, 1000);
            if('Media' in window) {
                getDirectory(recordingDir, function(dirEntry){
                    var mediaRec = new Media(recordingDir + '/' + recordingName);
                    console.log("media created: " + recordingDir + '/' + recordingName);
                    mediaRec.startRecord();
                    that.interviewEndBody = _.wrap(that.interviewEndBody, function(interviewEndBody){
                        mediaRec.stopRecord();
                        mediaRec.release();
                        console.log("Recording stopped.");
                        that.interviewEndBody = interviewEndBody;
                        that.interviewEndBody();
                    });
                    that.navigate('start.html', {trigger: true, replace: true});
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
        interviewEndBody: function(){
            var that = this;
            window.clearInterval(timerUpdater);
            session.set("endTime", new Date()).save();
            $('body').html(compiledInterviewEndTemplate());
            $('#save').click(function(){
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
                //TODO: Delete recording?
                session = null;
                that.navigate('', {trigger: true, replace: true});
            });
        },
        interviewEnd: function(){
            this.interviewEndBody();
        },
        //TODO: Adds support for links to a JSON interview definition
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
                    lastPage: that.currentContext.page,
                    _sessionId: session.get('id'),
                    //This is duplicate information but it is convenient to have available on the model.
                    _recordingStart: session.get('startTime')
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

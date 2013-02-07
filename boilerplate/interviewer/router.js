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
    'text!interviewer/JSONQuestionTemplate.html',
    'backboneqp'],
function($, Backbone, _, LogItems, Sessions,
         openingTemplate, bodyTemplate, interviewEndTemplate, sessionsTemplate, JSONQuestionTemplate){
    console.log("Compiling templates...");
    var compiledOpeningTemplate = _.template(openingTemplate);
    var compiledBodyTemplate = _.template(bodyTemplate);
    var compiledInterviewEndTemplate = _.template(interviewEndTemplate);
    var compiledSessionsTemplate = _.template(sessionsTemplate);
    var compiledJSONQuestionTemplate = _.template(JSONQuestionTemplate);
    console.log("Templates compiled");
    
    //This is a patch to make it so form submission puts the params after
    //the hash so they can be picked up by Backboneqp.
    $(document).submit(function(e) {
        e.preventDefault();
        window.location = $(e.target).attr('action') + '?' + $(e.target).serialize();
    });
    
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
    function getDirectory(dirPath, success, fail) {
        var requestFileSystemWrapper = function(success, error){
            var storageNeeded;
            var PERSISTENT = ("LocalFileSystem" in window) ?  window.LocalFileSystem.PERSISTENT : window.PERSISTENT;
            var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            if("webkitStorageInfo" in window && "requestQuota" in window.webkitStorageInfo){
                storageNeeded = 5*1024*1024; //5MB
                //We're using chrome probably and need to request storage space.
                window.webkitStorageInfo.requestQuota(PERSISTENT, storageNeeded, function(grantedBytes) {
                    requestFileSystem(PERSISTENT, storageNeeded, success, error);
                }, error);
            } else {
                requestFileSystem(PERSISTENT, storageNeeded, success, error);
            }
        }
        requestFileSystemWrapper(function(fileSystem) {
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
                        console.log(error);
                        console.log(curDir);
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
    }
    
    var mySessions = new Sessions();
    var interviewTitle = $('title').text();
    var dirPath = 'interviews/';
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
            var onReady = function() {
                $(function(){
                    getDirectory(dirPath, function(){
                        console.log("got directory");
                        $('body').html('<div id="pagecontainer">');

                        var started = Backbone.history.start();
                        if(!started){
                            alert("Routes may be improperly set up.");
                        }
                    }, function(err){
                        if(window.chrome) console.error(err);
                        alert("Could not create directory to save data.");
                    });
                });
            };
            if ('cordova' in window) {
                //No need to worry about timing. From cordova docs:
                //This event behaves differently from others in that any event handler
                //registered after the event has been fired will have its callback
                //function called immediately.
                document.addEventListener("deviceready", onReady);
            } else {
                onReady();
            }
		},
		routes: {
            '': 'opening',
            'sessions': 'showSessions',
            'interviewStart': 'interviewStart',
            'interviewEnd': 'interviewEnd',
            //order is important here:
            'json/:question': 'setJSONQuestion',
            '*page': 'setPage'
		},
        opening: function(){
            $('body').html(compiledOpeningTemplate({title: interviewTitle}));
        },
        showSessions: function(){
            mySessions.fetchFromFS({
                dirPath: dirPath,
                success: function(){
                    $('body').html(compiledSessionsTemplate({sessions: mySessions.toJSON()}));
                },
                error: function(){
                    alert("Error loading sessions");
                }
            });
        },
        interviewStart: function start(){
            var that = this;
            var $time;
            var startUrl = $('body').data('start');
            var sessionId = GUID();
            var recordingName = sessionId + ".amr";
            
            if(session){
                //i.e. If the user presses back from the first screen and lands here.
                that.navigate("interviewEnd", {trigger: true });
                return;
            }
            
            session = mySessions.create({
                id: sessionId,
                startTime: new Date(),
                interviewTitle: interviewTitle
            });
            session.Log = new LogItems();
            
            $('body').html(compiledBodyTemplate());
            $time = $('#time');
            
            timerUpdater = window.setInterval(function() {
                $time.text(_.formatTime(new Date() - session.get('startTime')));
            }, 1000);
            if('Media' in window) {
                var mediaRec = new Media(dirPath + '/' + recordingName);
                console.log("media created: " + dirPath + '/' + recordingName);
                mediaRec.startRecord();
                //set startTime again to try to get as close as possible
                //to the recording start time.
                session.set('startTime', new Date());
                that.once("route:interviewEnd", function() {
                    mediaRec.stopRecord();
                    mediaRec.release();
                    console.log("Recording stopped.");
                });
            } else {
                //TODO: How do dismiss?
                //TODO: Use template.
                $('#alert-area').html('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Warning!</h4> Audio is not being recorded.</div>');
            }
            that.navigate(startUrl, {trigger: true, replace: false});
        },
        interviewEnd: function(){
            if(!session){
                alert("Interview ended");
                return;
            }
            var that = this;
            window.clearInterval(timerUpdater);
            session.set("endTime", new Date());
            
            $('body').html(compiledInterviewEndTemplate());
            $('#save').click(function(){
                session.saveToFS({
                    dirPath: dirPath,
                    success: function(){
                        session = null;
                        that.navigate('', {trigger: true, replace: true});
                    },
                    error: function(err) {
                        if(window.chrome) console.error(err);
                        $('#alert-area').html('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Error!</h4> Could not save.</div>');
                        console.log(String(err));
                        console.log(err);
                    }
                });
            });
            $('#discard').click(function(){
                //TODO: Delete recording?
                session = null;
                that.navigate('', {trigger: true, replace: true});
            });
        },
        recordData: function(page, params){
            var that = this;
            if(!session) {
                console.log("No session to record data into.");
                return;
            }
            var newLogItem = new session.Log.model(_.extend({}, params, {
                page: page,
                lastPage: that.currentContext.page,
                _sessionId: session.get('id'),
                //This is duplicate information but it is convenient to have available on the model.
                _recordingStart: session.get('startTime')
            }));
            session.Log.add(newLogItem);
            //Set up events to set the logItem's duration
            //when the next page is reached.
            var onNextPage = function(page, qp){
                console.log(page);
                console.log(newLogItem.get('_timestamp'));
                //TODO: If the next route event is for an annotation don't do anything?
                newLogItem.set({
                    '_duration': (new Date()) - newLogItem.get('_timestamp'),
                    'nextPage': page
                });
                //remove the event listeners.
                that.off(null, onNextPage);
            };
            _.defer(function(){
                //Route event binding is deferred because it will pick up the
                //current route event otherwise.
                that.on('route:setPage', onNextPage);
                that.on('route:setJSONQuestion', onNextPage);
                that.on('route:interviewEnd', onNextPage);
            });
            //Save the params that do not begin with an underscore into the session.
            //TODO: To avoid collisions the backend session vars should begin
            //with an underscore.
            session.set(_.omitUnderscored(params));
        },
        setJSONQuestion: function(question, params){
            function renderQuestion(jsonInterviewDef){
                var renderedHtml;
                try{
                    renderedHtml = compiledJSONQuestionTemplate({
                        questions: jsonInterviewDef.questions,
                        questionName: question || jsonInterviewDef.questions[0].name
                    });
                    $('#pagecontainer').html(renderedHtml);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
            }
            var that = this;
            that.recordData(question, params);
            if(that.__jsonInterviewDef__){
                renderQuestion(that.__jsonInterviewDef__);
            } else {
                //TODO: Eventually, I think the name of the interview should be
                //a prefix on all the routes. We will need to use that prefix
                //here to construct the appropriate path.
                $.getJSON('example/interview.json', function(jsonInterviewDef){
                    that.__jsonInterviewDef__ = jsonInterviewDef;
                    renderQuestion(jsonInterviewDef);
                });
            }
        },
        setPage: function(page, params){
            var that = this;
            console.log('params:');
            console.log(params);
            if(!params){
                params = {};
            }
            that.recordData(page, params);
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
                    return;
                }
                try{
                    renderedHtml = compiledTemplate(that.currentContext);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                    return;
                }
                $('#pagecontainer').html(renderedHtml);
            }, function(error){
                console.error(error);
                alert("Could not load page: " + error.requireModules[0].substring(5));
            });
        }
	});
	return Router;
});

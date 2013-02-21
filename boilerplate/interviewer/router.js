/*
TODO:
Refactor interviewStart into beginSession and interviewStart.
Begin session shows initial screens for data input and preliminary notices.
interviewStart starts the recording.
*/
define([
    'config',
	'jquery', 
	'backbone', 
	'underscore',
    'LogItems',
    'Sessions',
    'sfsf',
    'text!interviewer/opening.html',
    'text!interviewer/body.html',
    'text!interviewer/interviewEnd.html',
    'text!interviewer/sessions.html',
    'text!interviewer/JSONQuestionTemplate.html',
    'backboneqp'],
function(config, $, Backbone, _, LogItems, Sessions, sfsf,
         openingTemplate, bodyTemplate, interviewEndTemplate, sessionsTemplate, JSONQuestionTemplate){
    console.log("Compiling templates...");
    var compiledOpeningTemplate = _.template(openingTemplate);
    var compiledBodyTemplate = _.template(bodyTemplate);
    var compiledInterviewEndTemplate = _.template(interviewEndTemplate);
    var compiledSessionsTemplate = _.template(sessionsTemplate);
    var compiledJSONQuestionTemplate = _.template(JSONQuestionTemplate);
    console.log("Templates compiled");
    
    var mySessions = new Sessions();
    var interviewTitle = $('title').text();
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
            sfsf.cretrieve(config.appDir, {}, function(error, entry){
                if(error){
                    console.log(error);
                    alert("Could not create app directory.");
                    return;
                }
                console.log("got directory");
                $('body').html('<div id="pagecontainer">');

                var started = Backbone.history.start();
                if(!started){
                    alert("Routes may be improperly set up.");
                }
            });
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
                dirPath: config.appDir,
                success: function(){
                    //Add durations for this view.
                    //Should durations be stored?
                    mySessions.each(function(session){
                        if(session.get("endTime")){
                            session.set("_duration", session.get("endTime") - session.get("startTime"));
                        }
                    });
                    $('body').html(compiledSessionsTemplate({sessions: mySessions.toJSON()}));
                },
                error: function(){
                    alert("Error loading sessions");
                }
            });
        },
        interviewStart: function start(){
            var thisRouter = this;
            var $time;
            var startUrl = $('body').data('start');
            
            if(session){
                //i.e. If the user presses back from the first screen and lands here.
                thisRouter.navigate("interviewEnd", {trigger: true });
                return;
            }
            
            session = mySessions.create({
                startTime: new Date(),
                interviewTitle: interviewTitle
            });
            session.Log = new LogItems();
            
            session.set("_recordingPath", sfsf.joinPaths(config.appDir, session.get("id") + ".amr"));
            
            var SessionView = Backbone.View.extend({
                events: {
                    'click .add-tag' : 'addTag',
                    'click #stop' : 'endInterview',
                    'click .undo' : 'undo'
                },
                
                addTag: function(evt){
                    var $tagEl = $(evt.target).closest(".add-tag");
                    console.log("adding tag:", $tagEl.data("tag"));
                    session.addTag("base", $tagEl.data("tag"), new Date());
                    //Temporariliy disable the tag...
                    $tagEl.removeClass('add-tag');
                    $tagEl.addClass('add-tag-disabled');
                    window.setTimeout(function(){
                        $tagEl.addClass('add-tag');
                        $tagEl.removeClass('add-tag-disabled');
                    }, 2000);
                },
                
                endInterview: function(evt){
                    if(confirm("Are you sure you want to end the interview?")){
                        thisRouter.navigate("interviewEnd", {trigger: true });
                    }
                },
                
                undo: function(evt){
                    console.log("triggering undo");
                    thisRouter.trigger("undo");
                },
                
                render: function(){
                    this.$el.html(compiledBodyTemplate());
                    return this;
                },
                
                startTimer: function(){
                    var $time = this.$('#time');
                    var timerUpdater = window.setInterval(function() {
                        $time.text(_.formatTime(new Date() - session.get('startTime')));
                    }, 1000);
                    thisRouter.once("route:interviewEnd", function() {
                        window.clearInterval(timerUpdater);
                    });
                    return this;
                }
            });
            
            var mySessionView = new SessionView({el: $('body').get(0)});
            mySessionView.render().startTimer();
            
            if('Media' in window) {
                var mediaRec = new Media(session.get('_recordingPath'));
                console.log("media created: " + session.get('_recordingPath'));
                mediaRec.startRecord();
                //set startTime again to try to get as close as possible
                //to the recording start time.
                session.set('startTime', new Date());
                thisRouter.once("route:interviewEnd", function() {
                    mediaRec.stopRecord();
                    mediaRec.release();
                    console.log("Recording stopped.");
                });
            } else {
                //TODO: How do dismiss?
                //TODO: Use template.
                $('#alert-area').html('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Warning!</h4> Audio is not being recorded.</div>');
            }
            thisRouter.navigate(startUrl, {trigger: true, replace: false});
        },
        interviewEnd: function(){
            if(!session){
                alert("Interview ended");
                return;
            }
            var that = this;
            session.set("endTime", new Date());
            
            $('body').html(compiledInterviewEndTemplate());
            $('#save').click(function(){
                session.saveToFS({
                    dirPath: config.appDir,
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
                var recordingPath = session.get('_recordingPath');
                if(confirm("Are you sure you want to discard this recording?")){
                    sfsf.cretrieve(recordingPath, function(error, fileEntry){
                        var errorFun = function(){
                            alert("Error clearing recoding at: " + recordingPath + "\nIt will need to be manually deleted from the sd card.");
                        }
                        if(error){
                            console.log(error);
                            errorFun();
                        }
                        fileEntry.remove(function(){
                            console.log("Entry successfully removed.");
                        }, errorFun);
                    });
                    session = null;
                    that.navigate('', {trigger: true, replace: true});
                }
            });
        },
        recordData: function(route, page, params){
            var that = this;

            if(!session) {
                console.log("No session to record data into.");
                return;
            }
            if(!params){
                params = {};
            }
            
            if(params.__nolog) {
                console.log("A log item is not created when the __nolog flag is passed.");
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
            
            //Save the params that do not begin with an underscore into the session.
            //TODO: To avoid collisions the backend session vars should begin
            //with an underscore.
            session.set(_.omitUnderscored(params));
            
            var setupEvents = function(){
                var prevPagePath = page;
                if(route){
                    prevPagePath = route + '/' + page;
                }
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
                    that.off('undo');
                    that.once('undo', function(){
                        console.log("undoing...");
                        console.log("Removing the last log item...");
                        session.Log.pop();
                        console.log("Navigating back to the previuos page...");
                        that.navigate(that.toFragment(prevPagePath, _.extend({
                            __nolog: true
                        }, params)), {
                            trigger: true
                        });
                        console.log("Rebinding events...");
                        setupEvents();
                    });
                };
                _.defer(function(){
                    //Route event binding is deferred because it will pick up the
                    //current route event otherwise.
                    that.on('route:setPage', onNextPage);
                    that.on('route:setJSONQuestion', onNextPage);
                    that.on('route:interviewEnd', onNextPage);
                });

            };
            setupEvents();
        },
        setJSONQuestion: function(questionName, params){
            function renderQuestion(annotatedFlatInterview){
                var renderedHtml;
                
                console.log(annotatedFlatInterview);
                var foundQuestion = _.find(annotatedFlatInterview, function(question){
                    if(question.name === questionName){
                        return question;
                    }
                })
                
                if(!foundQuestion){
                    alert("Could not find question: " + questionName);
                    return;
                }
                
                try{
                    renderedHtml = compiledJSONQuestionTemplate({
                        currentQuestion: foundQuestion,
                        formDir: "example/"
                    });
                    $('#pagecontainer').html(renderedHtml);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
            }
            var that = this;
            if(!params){
                params = {};
            }
            if(!params.__nolog){
                $('.undo').removeClass("fade-out");
                _.delay(function(){ $('.undo').addClass("fade-out"); }, 100);
            }
            
            that.recordData('json', questionName, params);
            if(that.__annotatedFlatInterview__){
                renderQuestion(that.__annotatedFlatInterview__);
            } else {
                //TODO: Eventually, I think the name of the interview should be
                //a prefix on all the routes. We will need to use that prefix
                //here to construct the appropriate path.
                $.getJSON('example/interview.json', function(jsonInterviewDef){
                    //Here we create a flat array with all the questions, and where each 
                    //question has annotations indicating the next questions and branches.
                    that.__annotatedFlatInterview__ = [];
                    var annotateAndFlatten = function(nextQuestions){
                        var currentQuestion, followingQuestions;
                        if(nextQuestions.length > 0) {
                            currentQuestion = nextQuestions[0];
                            if("__nextQuestions" in currentQuestion){
                                //We've already handled this question
                                return;
                            }
                            currentQuestion.__tags = _.where(jsonInterviewDef.tags, {
                                group: ("tags" in currentQuestion) ? currentQuestion.tags : "default"
                            });
                            
                            followingQuestions = nextQuestions.slice(1);
                            currentQuestion.__branches = [];
                            while(followingQuestions.length > 0 &&
                                    "type" in followingQuestions[0] &&
                                    followingQuestions[0].type === "branch"){
                                currentQuestion.__branches.push(followingQuestions[0]);
                                followingQuestions = followingQuestions.slice(1);
                            }
                            _.each(currentQuestion.__branches, function(branch){
                                if("children" in branch && branch.children.length > 0) {
                                    annotateAndFlatten(branch.children.concat(followingQuestions));
                                    branch.__nextQuestions = branch.children.concat(followingQuestions);
                                } else {
                                    branch.__nextQuestions = followingQuestions;
                                }
                            });
                            annotateAndFlatten(followingQuestions);
                            currentQuestion.__nextQuestions = followingQuestions;
                            that.__annotatedFlatInterview__.push(currentQuestion);
                        }
                    };
                    annotateAndFlatten(jsonInterviewDef.interview);
                    renderQuestion(that.__annotatedFlatInterview__);
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
            if(!params.__nolog){
                $('.undo').css('opacity', 1.0);
                $('.undo').animate({
                    opacity: 0
                }, 3000);
            }
            that.recordData(null, page, params);
            require(['text!' + indexRelPathPrefix + page], function(template){
                var compiledTemplate, renderedHtml;
                that.currentContext = {
                    page: page,
                    qp: params,//TODO: Remove? Add session instead?
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

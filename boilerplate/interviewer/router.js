define([
    'config',
    'jquery', 
	'backbone', 
	'underscore',
    'LogItems',
    'Sessions',
    'sfsf',
    'text!interviewer/opening.html',
    'text!interviewer/guideLayout.html',
    'text!interviewer/interviewEnd.html',
    'text!interviewer/sessions.html',
    'text!interviewer/JSONQuestionTemplate.html',
    'backboneqp'],
function(config, $, Backbone, _, LogItems, Sessions, sfsf,
         openingTemplate, guideTemplate, interviewEndTemplate, sessionsTemplate, JSONQuestionTemplate){
    console.log("Compiling templates...");
    var compiledOpeningTemplate = _.template(openingTemplate);
    var compiledGuideTemplate = _.template(guideTemplate);
    var compiledInterviewEndTemplate = _.template(interviewEndTemplate);
    var compiledSessionsTemplate = _.template(sessionsTemplate);
    var compiledJSONQuestionTemplate = _.template(JSONQuestionTemplate);
    console.log("Templates compiled");
    
    var mySessions = new Sessions();

    var myExplorerView;
    
    var createRecorder = function(outputPath, recording_id){
        var currentMedia = null;
        var currentClip = null;
        var clips = [];
        
        return _.extend({
            pauseRecord: function(){
                if(this.paused) return;
                console.log("stoping recording...");
                currentClip.end = new Date();
                currentMedia.stopRecord();
                currentMedia.release();
                this.trigger("stop");
                this.paused = true;
            },
            startRecord: function(){
                console.log("recorder.startRecord");
                currentClip = {
                    start: new Date(),
                    path: sfsf.joinPaths(outputPath, recording_id + "." + clips.length + ".amr")
                };
                
                clips.push(currentClip);
                
                if('Media' in window) {
                    var createMedaStart = new Date();
                    console.log("Media path: " + currentClip.path);
                    currentMedia = new Media(currentClip.path);
                    console.log("Media init delay", new Date() - createMedaStart);
                    currentMedia.startRecord();
                    console.log("Total recording delay", new Date() - createMedaStart);
                } else {
                    currentMedia = {
                        stopRecord: function(){
                            console.log("stopRecoding facade");
                        },
                        startRecord: function(){
                            console.log("startRecoding facade");
                        },
                        release: function(){
                            console.log("release facade");
                        }
                    };
                    this.warning = "Audio cannot be recorded on this device.";
                }
                
                this.paused = false;
                this.trigger("start");
            },
            hasStarted: function(){
                return clips.length > 0;
            },
            remove: function(){
                if('Media' in window) {
                    _.each(clips, function(clip){
                        var recordingPath = clip.path;
                        sfsf.cretrieve(recordingPath, function(error, fileEntry){
                            var errorFun = function(){
                                alert("Error clearing recoding at: " + recordingPath + "\nIt will need to be manually deleted from the sd card.");
                            };
                            if(error){
                                console.log(error);
                                errorFun();
                            }
                            fileEntry.remove(function(){
                                console.log("Entry successfully removed.");
                            }, errorFun);
                        });
                    });
                }
            },
            getClips: function(){
                return clips;
            },
            getDuration: function(){
                if(clips.length === 0) return 0;
                return _.reduce(clips.slice(0, -1), function(memo, clip){ 
                     return memo + (clip.end - clip.start); 
                }, (new Date() - currentClip.start));
            },
            getActualDuration: function(){
                if(clips.length === 0) return 0;
                return new Date() - clips[0].start;
            }
        }, Backbone.Events);
    };

    var SessionView = Backbone.View.extend({
        
        initialize: function(){
            this.currentContext = {
                page: '',
                params: {},
                last: {}
            };
        },

        events: {
            'click .add-tag' : 'addTag',
            'click #stop' : 'endInterview',
			'click .startRecording': 'startRecording',
			'click .pauseRecording': 'pauseRecording',
            'click .resumeRecording': 'resumeRecording'
        },
        
        addTag: function(evt){
            var session = this.options.session;
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
        startRecording: function(evt){
            console.log("Attempting to start recording");
            var that = this;
            var thisRouter = this.options.router;
            var session = this.options.session;
                
            //Setup the timer:
            session.recorder.on("start", function(){
                console.log("Starting timer updater");
                var timerUpdater = window.setInterval(function() {
                    that.$('#time').text(_.formatTime(session.recorder.getDuration()));
                }, 1000);
                session.recorder.once("stop", function() {
                    window.clearInterval(timerUpdater);
                });
            });
            
            session.recorder.startRecord();
            
            thisRouter.navigate('json/start?' + this.$('form').serialize(), {
                trigger: true
            });
        },
        pauseRecording: function(evt){
            var session = this.options.session;
            session.recorder.pauseRecord();
            this.render();
        },
        resumeRecording: function(evt){
            var session = this.options.session;
            session.recorder.startRecord();
            this.render();
        },
        
        endInterview: function(evt){
            if(confirm("Are you sure you want to end the interview?")){
                this.options.router.navigate("interviewEnd", { trigger: true });
            }
        },
        
        render: function(){
            var recorder = this.options.session.recorder;
            this.$el.html(compiledGuideTemplate({ recorder: recorder }));
            this.renderPage();
            return this;
        },
        
        renderPage: function(){
            var currentContext = this.currentContext;
            if(currentContext.json){
                this.renderJSONPage(currentContext.page, currentContext.params);
            } else {
                this.renderHTMLPage(currentContext.page, currentContext.params);
            }
        },
        
        renderHTMLPage: function(page, params){
            var that = this;
            var myRouter = this.options.router;
            require(['text!' + sfsf.joinPaths(myRouter.pathPrefix, myRouter.currentInterviewPath, page)],
            function(template){
                var compiledTemplate, renderedHtml;
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
                that.$('#pagecontainer').html(renderedHtml);
            }, function(error){
                console.error(error);
                alert("Could not load page: " + error.requireModules[0].substring(5));
            });
        },
        renderJSONPage: function(questionName, params){
            var that = this;
            var myRouter = this.options.router;
            var renderQuestion = function(annotatedFlatInterview){
                var renderedHtml;
                
                console.log(annotatedFlatInterview);
                var foundQuestion = _.find(annotatedFlatInterview, function(question){
                    if(question.name === questionName){
                        return question;
                    }
                });
                
                if(!foundQuestion){
                    alert("Could not find question: " + questionName);
                    return;
                }
                
                try{
                    renderedHtml = compiledJSONQuestionTemplate({
                        currentQuestion: foundQuestion,
                        formDir: sfsf.joinPaths(myRouter.pathPrefix, myRouter.currentInterviewPath) + '/'
                    });
                    that.$('#pagecontainer').html(renderedHtml);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
            };
            if(that.__annotatedFlatInterview__){
                renderQuestion(that.__annotatedFlatInterview__);
            } else {
                //TODO: Eventually, I think the name of the interview should be
                //a prefix on all the routes. We will need to use that prefix
                //here to construct the appropriate path.
                console.log(myRouter.currentInterviewPath, 'interview.json');
                $.getJSON(sfsf.joinPaths(myRouter.pathPrefix, myRouter.currentInterviewPath, 'interview.json'),
                function(jsonInterviewDef){
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
        setPageContext: function(context){
            this.currentContext = _.extend({
                last: this.currentContext
            }, context);
            return this;
        }
    });

    //Session made global for easy debugging.
    window.session = null;
    //var session = null;

	var Router = Backbone.Router.extend({

        initialize: function(){
            var that = this;
            //I'm using a pre-hash url param for the interview name because
            //it will stay in the url when hash links are used without needing
            //to be included in the templates.
            //It feels a bit hacky to me...
            var prehashParams = window.decodeURIComponent(window.location.search);
            var parsedPrehashParams = Backbone.history.getQueryParameters(prehashParams);
            if(!parsedPrehashParams || !parsedPrehashParams.interview){
                alert("No interview specified.");
                return;
            }
            this.currentInterview = parsedPrehashParams.interview;
            if(this.currentInterview.slice(-1) === "/"){
                this.currentInterview = this.currentInterview.slice(0, -1);
            }
            this.currentInterviewPath = sfsf.joinPaths(config.appDir, 'interviews', this.currentInterview);
            
            sfsf.cretrieve(this.currentInterviewPath, {}, function(error, entry){
                if(error){
                    console.log(error);
                    alert("Could not get sdcard.");
                    return;
                }
                console.log("got directory");
                
                if("chrome" in window) console.log(entry);
                
                var entryURL = ("toURL" in entry) ? entry.toURL() : entry.fullPath;
                
                that.pathPrefix = entryURL.slice(0, - (that.currentInterviewPath.length));
                
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
            'explorer': 'explorer',
            'playSession': 'playSession',
            'beginSession' : 'beginSession',
            'interviewEnd': 'interviewEnd',
            'json/:question': 'setJSONQuestion',
            'html/*page': 'setPage'
		},
        opening: function(params){
            $('body').html(compiledOpeningTemplate({title: this.currentInterview}));
        },
        showSessions: function(){
            var that = this;
            mySessions.fetchFromFS({
                dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                success: function(){
                    $('body').html(compiledSessionsTemplate({sessions: mySessions.toJSON()}));
                },
                error: function(){
                    alert("Error loading sessions");
                }
            });
        },
        explorer: function(qp){
            var that = this;
            if(myExplorerView && qp){
                console.log(myExplorerView);
                myExplorerView.model.set(qp);
            } else {
                require(['explorer/ExplorerView'], function(ExplorerView){
                    myExplorerView = new ExplorerView({
                        model: new Backbone.Model(qp),
                        sessions: mySessions,
                        el: $('body').get(0)
                    });
                    mySessions.fetchFromFS({
                        dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                        success: function(){
                            myExplorerView.render();
                        },
                        error: function(){
                            alert("Error loading sessions");
                        }
                    });
                });
            }
        },
        
        playSession: function(qp){
            var that = this;
            require(['player/player','text!player/playerContainerTemplate.html'],
            function( player,         playerContainerTemplate){
                if(qp && qp.id) {
                    mySessions.fetchFromFS({
                        id: qp.id, //TODO: Make it so this limits us to fetching the mession with the given id.
                        dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                        success: function(){
                            var sessionToPlay = mySessions.get(qp.id);
                            if(!sessionToPlay) {
                                alert("Could not get session: " + qp.id);
                            }
                            $('body').html(_.template(playerContainerTemplate));
                            player.create({
                                el:  document.getElementById("player-container"),
                                session: sessionToPlay
                            });
                        },
                        error: function(){
                            alert("Error loading sessions");
                        }
                    });
                } else {
                    alert('missing session id');
                }
            });
        },
        
        beginSession: function(){
            var startUrl = "start.html";
            
            session = mySessions.create({
                startTime: new Date(),
                interviewTitle: this.currentInterview
            });
            session.Log = new LogItems();
            session.recorder = createRecorder(sfsf.joinPaths(config.appDir,
                    'interview_data',
                    this.currentInterview),
                session.get("id"));
            
            this.mySessionView = new SessionView({
                el: $('body').get(0),
                router: this,
                session: session
            });
            this.mySessionView.setPageContext({
                page: startUrl,
                params: {}
            }).render();
        },
        interviewEnd: function(){
            if(!session){
                alert("Interview ended");
                return;
            }
            var that = this;
            
            var cleanupSession = function(){
                that.mySessionView.undelegateEvents();
                that.mySessionView = null;
                session = null;
            };
            
            if(session.Log.length < 1){
                //The interview hasn't started yet, just cancel it.
                cleanupSession();
                that.navigate('', {trigger: true, replace: true});
                return;
            }
            
            session.recorder.pauseRecord();
            
            session.set("endTime", new Date());
            var lastLogItem = session.Log.at(session.Log.length - 1);
            lastLogItem.set({
                '_duration': (new Date()) - lastLogItem.get('_timestamp'),
                'nextPage': null
            });
            
            //TODO: Make a view for this.
            $('body').html(compiledInterviewEndTemplate());
            $('#save').click(function(){
                session.set({
                    '_clips': session.recorder.getClips(),
                    '_duration': session.recorder.getDuration(),
                    '_actualDuration': session.recorder.getActualDuration()
                });

                session.saveToFS({
                    dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                    success: function(){
                        cleanupSession();
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
                if(confirm("Are you sure you want to discard this recording?")){
                    session.recorder.remove();
                    cleanupSession();
                    that.navigate('', {trigger: true, replace: true});
                }
            });
        },
        setJSONQuestion: function(questionName, params){
            var that = this;
            if(!params){
                params = {};
            }
            var pageContext = {
    			page: questionName,
				params: params,
				json: true
			};
            session.logPage(pageContext);
			that.mySessionView.setPageContext(pageContext).render();
        },
        setPage: function(page, params){
            var that = this;
            console.log('params:');
            console.log(params);
            if(!params){
                params = {};
            }
            var pageContext = {
        		page: page,
				params: params,
				json: false
			};
            session.logPage(pageContext);
    		that.mySessionView.setPageContext(pageContext).render();
        }
	});
	return Router;
});

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
    
    //jsonInterviewDef is global for convenience,
    //we should probably refactor it.
    window.jsonInterviewDef;
    
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
                    console.log("Media init delay: " + (new Date() - createMedaStart));
                    currentMedia.startRecord();
                    console.log("Total recording delay: " + (new Date() - createMedaStart));
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
                var currentClipEnd = currentClip.end ? currentClip.end : new Date();
                return _.reduce(clips.slice(0, -1), function(memo, clip){ 
                     return memo + (clip.end - clip.start); 
                }, (currentClipEnd - currentClip.start));
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
            //TODO: Get and attach other tag attrs
            session.addTag("base", _.extend({
                _timestamp: new Date(),
                _page: this.currentContext.page
            }, _.where(jsonInterviewDef.tags, {
                name: $tagEl.data("tag")
            })[0]));
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
            
            thisRouter.navigate('json/' + window.jsonInterviewDef.annotatedFlatInterview[0].name + '?' + this.$('form').serialize(), {
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
            if(jsonInterviewDef && jsonInterviewDef.annotatedFlatInterview){
                renderQuestion(jsonInterviewDef.annotatedFlatInterview);
            } else {
                alert("No json interview definition loaded.");
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

    var processInterviewDef = function(loadedInterviewDef){
        //Here we create a flat array with all the questions, where each 
        //question object has annotations indicating the next questions and branches.
        var annotatedFlatInterview = [];
        var annotateAndFlatten = function(nextQuestions){
            var currentQuestion, followingQuestions;
            if(nextQuestions.length > 0) {
                currentQuestion = nextQuestions[0];
                if("__nextQuestions" in currentQuestion){
                    //We've already handled this question
                    return;
                }
                currentQuestion.__tags = _.where(loadedInterviewDef.tags, {
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
                annotatedFlatInterview.unshift(currentQuestion);
            }
        };
        annotateAndFlatten(loadedInterviewDef.interview);
        return _.extend({
            annotatedFlatInterview: annotatedFlatInterview
        }, loadedInterviewDef);
    };

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
            sfsf.politelyRequestFileSystem({}, function(error, fileSystem){
                if(error){
                    console.log(error);
                    alert("Could not get filesystem.");
                    return;
                }
                var root = fileSystem.root;
                that.pathPrefix = ("toURL" in root) ? root.toURL() : root.fullPath;
                
                sfsf.cretrieve(that.currentInterviewPath, function(error, entry){
                    if(error){
                        console.log(error);
                        alert("Could not get interview directory.");
                        return;
                    }
                    console.log("got interview directory");
                    
                    var entryURL = ("toURL" in entry) ? entry.toURL() : entry.fullPath;
                    
                    $('body').html('<div id="pagecontainer">');
                    
                    var started = Backbone.history.start();
                    if(!started){
                        alert("Routes may be improperly set up.");
                    }
                    
                    //Load the json interview def:
                    var interviewDefURL = sfsf.joinPaths(that.pathPrefix, that.currentInterviewPath, 'interview.json');
                    $.getJSON(interviewDefURL, function(loadedInterviewDef) {
                        window.jsonInterviewDef = processInterviewDef(loadedInterviewDef);
                    }).error(function(err) {
                        console.log(err);
                        alert("Could not get JSON interview def: " + interviewDefURL);
                    });
                });
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
            var that = this;
            var renderOpening = function(){
                var totalTime = mySessions.reduce(function(memo, session){
                    return (session.get("endTime") - session.get("startTime"));
                }, 0);
                $('body').html(compiledOpeningTemplate({
                    title: that.currentInterview,
                    stats: {
                        averageDuration: totalTime / mySessions.length,
                        totalTime: totalTime,
                        lastDate: mySessions.at(mySessions.length - 1).get("startTime").toISOString().replace('T',' at ').slice(0,-8),
                        numInterviews: mySessions.length
                    }
                }));
            };
            if(mySessions.length === 0){
                //i.e. if the sessions haven't been loaded yet.
                $('body').html(compiledOpeningTemplate({
                    title: that.currentInterview,
                    stats: null
                }));
                mySessions.fetchFromFS({
                    dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                    success: renderOpening,
                    error: function(){
                        alert("Error loading sessions");
                    }
                });
            } else {
                renderOpening();
            }
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
                        id: qp.id, 
                        dirPath: sfsf.joinPaths(config.appDir, 'interview_data', that.currentInterview),
                        success: function(){
                            var sessionToPlay = mySessions.get(qp.id);
                            if(!sessionToPlay) {
                                alert("Could not get session: " + qp.id);
                            }
                            $('body').html(_.template(playerContainerTemplate));
                            var myPlayer = player.create({
                                el:  $(".player"),
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
            session.Log.trigger("end");
            
            _.defer(function(){
                var totalDuration = session.Log.reduceRight(function(memo, logItem){
                    return memo + (logItem.get('_endTimestamp') - logItem.get('_timestamp'));
                }, 0);
                console.log("durations: ", totalDuration, session.recorder.getDuration());
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

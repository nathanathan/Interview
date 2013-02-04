require.config({ 
    'paths': { 
    	"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "Popcorn": "libs/popcorn-complete.min"
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
	'underscore',
	'backbone',
    'player/player',
    'LogItems',
    'Sessions',
    'Popcorn',
    'backboneqp',
    'mixins'
	], 
	function(_, Backbone, player, LogItems, Sessions){
        //TODO: I might need to think about how to release media on hash changes.
        
        var getMediaPhonegap = function(path, callback) {
            var media = new Media(path,
            function(){},
            function(err){
                console.error("Media error:");
                console.error(err);
            });
            media.seekTo(0);
            var attempts = 10;
            function waitForDuration(){
                if(attempts === 0) {
                    alert("Could not get media duration");
                    return;
                }
                attempts--;
                if(media.getDuration() > 0) {
                    callback(media);
                } else {
                    window.setTimeout(waitForDuration, 100);
                }
            }
            waitForDuration();
        }
        
        var getMediaDebug = function(path, callback) {
            var $audioContainer = $('<div>');
            $('body').append($audioContainer);
            var myAudio = Popcorn.youtube($audioContainer.get(0), 'http://www.youtube.com/watch?v=HgzGwKwLmgM&width=0&height=0' );
            myAudio.on("loadedmetadata", function() {
                myAudio.off("loadedmetadata");
                callback({
                    play: function(){
                        myAudio.play();
                    },
                    pause: function(){
                        myAudio.pause();
                    },
                    stop: function(){
                        myAudio.stop();
                    },
                    getCurrentPosition: function(mediaSuccess, mediaError){
                        //mediaSuccess(myAudio.currentTime);
                        mediaSuccess(myAudio.currentTime());
                    },
                    getDuration: function(){
                        //return myAudio.duration;
                        return myAudio.duration();
                    },
                    seekTo: function(millis){
                        console.log("seeking to: " + millis);
                        //myAudio.currentTime = timeSeconds;
                        myAudio.currentTime(Math.floor(millis / 1000));
                        //myAudio.currentTime = Math.floor(millis / 1000);
                    }
                });
            });
        };

        var getMedia = function(path, callback) {
            //TODO: Download media into temporairy fs if not present.
            //TODO: Figure out how to play media from chrome.
            if('Media' in window){
                getMediaPhonegap(path, callback);
            } else {
                getMediaDebug(path, callback);
            }
        };
        
        var Router = Backbone.Router.extend({
            
            initialize: function(){
                var onReady = function() {
                    $(function(){
                        var started = Backbone.history.start();
                        if(!started){
                            alert("Routes may be improperly set up.");
                        }
                    });
                }
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
                '': 'debugMode',
                'session': 'playSession'
            },
            
            playSession: function(qp){
                var dirPath = "interviews/";
                if(qp && qp.id) {
                    if(qp.dirPath) {
                        dirPath = qp.dirPath;
                    }
                    //TODO: Should make way to fetch individual sessions.
                    var allSessions = new Sessions();
                    allSessions.fetchFromFS({
                        dirPath: dirPath,
                        success: function(){
                            var session = allSessions.get(qp.id);
                            if(!session) {
                                alert("Could not get session");
                                console.error(qp.id);
                            }
                            
                            var recordingPath = dirPath +
                                qp.id +".amr";
                            console.log("recordingPath:" + recordingPath);
                            
                            getMedia(recordingPath, function(media){
                                console.log("Got media.");
                                player.create({
                                    containerEl: document.getElementById("player-container"),
                                    media: media,
                                    logItems: session.Log,
                                    session: session
                                });
                            });
                        },
                        error: function(){
                            alert("Could not get sessions");
                        }
                    });

                } else {
                    alert('missing session id');
                }
            },
            
            debugMode: function(){
                alert("Debug mode.");
                getMediaDebug(null, function(phonegapMediaShim){
                    var debugStartTime = Math.random()*2000000000000;
                    var debugLogItems = [
                        {
                            _recordingStart: new Date(debugStartTime),
                            _timestamp: new Date(debugStartTime + Math.random()*160000),
                            _sessionId: "A23-B34",
                            page: "communityActivities.html"
                        },
                        {
                            _recordingStart: new Date(debugStartTime),
                            _timestamp: new Date(debugStartTime + Math.random()*160000),
                            _sessionId: "A23-B34",
                            page: "communityActivityFollowUp.html"
                        },
                        {
                            _recordingStart: new Date(debugStartTime),
                            _timestamp: new Date(debugStartTime + Math.random()*160000),
                            _sessionId: "A23-B34",
                            page: "interviewEnd"
                        }
                    ];
                    var myLogItems = new LogItems(debugLogItems);

                    player.create({
                        containerEl: document.getElementById("player-container"),
                        media: phonegapMediaShim,
                        logItems: myLogItems
                    });
                });

            }
        });
        new Router();
});

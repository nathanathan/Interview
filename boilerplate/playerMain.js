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
    'backboneqp'
	], 
	function(_, Backbone, player, LogItems, Sessions){
        
        var getMedia = function(path, callback) {
            var media = new Media(path,
            function(){},
            function(err){
                alert("error");
                console.log(err);
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
        
        var Router = Backbone.Router.extend({
            
            initialize: function(options){
                Backbone.history.start();
                //TODO: Loading message?
            },
            
            routes: {
                '': 'main',
                'session': 'playSession'
            },
            
            playSession: function(qp){
                if(qp && qp.id) {
                    //TODO: Watch out for async
                    var mySessions = new Sessions();
                    mySessions.fetch();
                    var session = mySessions.get(qp.id);
                    if(!session) {
                        alert("Could not get session");
                        console.error(qp.id);
                    }
                    //Getting the session will also make it easier to get rid
                    //of the _recordingStart param.
                    var recordingPath = 'interviews/' +
                        session.get('interviewTitle') + '/'+
                        qp.id +".amr";
                    console.log("recordingPath:" + recordingPath);
                    
                    var myLogItems = new LogItems();
                    myLogItems.fetch();
                    myLogItems = new LogItems(myLogItems.where({"_sessionId": qp.id}));
                    
                    getMedia(recordingPath, function(media){
                        console.log("Got media.");
                        player.create({
                            containerEl: document.getElementById("player-container"),
                            media: media,
                            logItems: myLogItems
                        });
                    });
                    
                } else {
                    alert('missing session id');
                }
            },
            
            main: function(){
                alert("Debug mode.");
                var $audioContainer = $('<div>');
                $('body').append($audioContainer);
                var myAudio = Popcorn.youtube($audioContainer.get(0), 'http://www.youtube.com/watch?v=HgzGwKwLmgM&width=0&height=0' );
                var phonegapMediaShim = {
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
                    seekTo: function(timeSeconds){
                        //myAudio.currentTime = timeSeconds;
                        myAudio.currentTime(timeSeconds);
                    }
                };
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
                myLogItems.addDurations();
        
                myAudio.on("loadedmetadata", function() {
                    myAudio.off("loadedmetadata");
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

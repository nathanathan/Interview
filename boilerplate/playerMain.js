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
        var Router = Backbone.Router.extend({
            
            initialize: function(options){
                Backbone.history.start();
                //TODO: Loading message?
            },
            
            routes: {
                '': 'main',
            },
            
            main: function(qp){
                if(qp && qp.sessionId) {
                    qp.sessionId
                    //TODO: Watch out for async
                    var mySessions = new Sessions();
                    mySessions.fetch();
                    var session = mySessions.get(qp.sessionId);
                    if(!session) {
                        alert("Could not get session");
                        console.error(qp.sessionId);
                    }
                    //Getting the session will also make it easier to get rid
                    //of the _recordingStart param.
                    var recordingPath = 'interviews/' +
                        session.get('interviewTitle') + '/'+
                        qp.sessionId +".amr";
                    console.log("recordingPath:" + recordingPath);
                    
                    var myLogItems = new LogItems();
                    myLogItems.fetch();
                    myLogItems = new LogItems(myLogItems.where({"_sessionId": qp.sessionId}));
                    
                    player.create({
                        containerEl: document.getElementById("player-container"),
                        media: new Media(recordingPath,
                        function(){},
                        function(err){
                            alert("error");
                            console.log(err);
                        }),
                        logItems: myLogItems
                    });
                    
                } else {
                    alert("No sessionId suppplied. Debug mode.");
                    //var myAudio = document.getElementById("test-audio");
                    //var myAudio = new Audio("https://s3.amazonaws.com/audiojs/02-juicy-r.mp3");
                    var myAudio = Popcorn.youtube('#test-audio', 'http://www.youtube.com/watch?v=HgzGwKwLmgM&width=0&height=0' );
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
                        $('#test-audio').hide();
                        myAudio.off("loadedmetadata");
                        player.create({
                            containerEl: document.getElementById("player-container"),
                            media: phonegapMediaShim,
                            logItems: myLogItems
                        });
                    });
                }
            }
        });
        new Router();
});

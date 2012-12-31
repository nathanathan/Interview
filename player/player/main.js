// This set's up the module paths for underscore and backbone
require.config({ 
    'paths': { 
    	"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min"
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
    'player'
	], 
	function(_, Backbone, player){
        
        //I'm thinking the form/guide selection should be part of the entry page.
        //But the screen for choosing an instance should be part of the form page.
        //This is bc listing files requires phonegap and bc listing instances requires
        //a form type, and bc it is unlikely that the user will need to compare
        //instances across different form types.
        //I would rather not include the player in the boilerplate if the bp
        //is included with the form, for a minor file size issue.
        //TODO: Move/clairify this reasoning.
        
        //Could the instance selection screen could be the same screen used to search
        //across recordings?
        
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
		player.create({
            containerEl: document.getElementById("player-container"),
            media: phonegapMediaShim,
            logItems: new Backbone.Collection()
        });
});

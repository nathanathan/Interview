require.config({ 
    'paths': { 
		"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "sfsf": "libs/sfsf/sfsf",
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
    'interviewer/router',
    'mixins'
], 
function(_, Backbone, router){
    
    var onReady = function() {
        $(function() {
            //This is a patch to make it so form submission puts the params after
            //the hash so they can be picked up by Backboneqp.
            $(document).submit(function(e) {
                e.preventDefault();
                window.location = $(e.target).attr('action') + '?' + $(e.target).serialize();
            });
                    
            document.addEventListener("backbutton", function() {
                //disable back presses.
            }, false);
            new router();
        });
    };
    if ('cordova' in window) {
        //No need to worry about timing. From cordova docs:
        //This event behaves differently from others in that any event handler
        //registered after the event has been fired will have its callback
        //function called immediately.
        document.addEventListener("deviceready", onReady);
    }
    else {
        onReady();
    }
    
});
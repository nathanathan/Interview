// This set's up the module paths for underscore and backbone
require.config({ 
    'paths': { 
		"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams"
	},
	'shim': 
	{
        underscore: {
			'exports': '_'
		},
		backbone: {
			'deps': ['jquery', 'underscore'],
			'exports': 'Backbone'
		},
        backboneqp: ['backbone', 'underscore']
	}	
}); 

require([
	'underscore',
	'backbone',
    'app',
    'backboneqp'
	], 
	function(_, Backbone, app) {
        //Attempt to detect if this is a cordova app.
        //There are many ways to do it. This one will have problems
        //If the cordova.js script is added to the project.
        //http://stackoverflow.com/questions/8068052/phonegap-detect-if-running-on-desktop-browser
        if ('cordova' in window) {
            //No need to worry about timing. From cordova docs:
            //This event behaves differently from others in that any event handler
            //registered after the event has been fired will have its callback
            //function called immediately.
            document.addEventListener("deviceready", function onDeviceReady() {
                app.init();
            });
        } else {
            app.init();
        }
});

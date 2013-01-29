require.config({
    'paths': { 
        "underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "Popcorn": "libs/popcorn-complete.min"
	},
    'shim': {
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
    'explorer/explorer',
    'backboneqp',
    'Popcorn'
], 
function(_, Backbone, explorer){
    _.mixin({
        formatTime: function(millis) {
            var seconds = Math.floor(millis / 1000) % 60;
            var minutes = Math.floor(millis / 60 / 1000);
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return minutes + ':' + seconds;
        }
    });
	explorer.init();
});
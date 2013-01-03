// This set's up the module paths for underscore and backbone
require.config({
    'paths': { 
        "underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "Popcorn": "libs/popcorn-complete.min"
	},
    'shim': {
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
    'explorer',
    'backboneqp',
    'Popcorn'
	], 
function(_, Backbone, explorer){
	explorer.init();
});



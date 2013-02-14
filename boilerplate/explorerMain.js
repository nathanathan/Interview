require.config({
    'paths': { 
        "underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "Popcorn": "libs/popcorn-complete.min",
        "sfsf": "libs/sfsf/sfsf"
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
    'Popcorn',
    'mixins'
], 
function(_, Backbone, explorer){
	explorer.init();
});
require.config({ 
    'paths': { 
		"underscore": "libs/underscore-min", 
		"backbone": "libs/backbone-min",
        "backboneqp": "libs/backbone.queryparams",
        "backbonels": "libs/backbone-localstorage",
        "sfsf": "libs/sfsf/sfsf"
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
    new router();
});
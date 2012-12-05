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
	function(_, Backbone, app){
		app.init();
});

// This is the main entry point for the App
// I learned this project struture from RequireJS-Backbone-Starter
//I'm tempted to just have a module for the router since this module doesn't
//really do anything.
define(['router'], function(router){
	var init = function(){
		this.router = new router();
	};
	return { init: init };
});

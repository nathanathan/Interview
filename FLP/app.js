// This is the main entry point for the App
// I learned this project struture from RequireJS-Backbone-Starter
define(['router'], function(router){
	var init = function(){
		this.router = new router();
        
    
        remoteStorage.claimAccess('myfavoritedrinks', 'rw').
        then(function() {
            remoteStorage.displayWidget('remotestorage-connect');
        });

        
	};
	return { init: init };
});

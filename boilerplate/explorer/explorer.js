define([ 'config', 'underscore', 'backbone', 'explorer/ClipList', 'LogItems', 'Sessions', 'text!explorer/explorerTemplate.html'],
function( config,   _,            Backbone,   ClipList,            LogItems,   Sessions,   explorerTemplate) {
    
    var compiledExplorerTemplate = _.template(explorerTemplate);
    var allLogItems;
    var allSessions = new Sessions();
    
    var Router = Backbone.Router.extend({
        
        initialize: function(){
            var onReady = function() {
                $(function(){
                    allSessions.fetchFromFS({
                        dirPath: config.appDir,
                        success: function(){
                            allLogItems = allSessions.collectLogItems();
                            var started = Backbone.history.start();
                            if(!started){
                                alert("Routes may be improperly set up.");
                            }
                        },
                        error: function(){
                            alert("Error loading sessions");
                        }
                    });
                });
            };
            if ('cordova' in window) {
                //No need to worry about timing. From cordova docs:
                //This event behaves differently from others in that any event handler
                //registered after the event has been fired will have its callback
                //function called immediately.
                document.addEventListener("deviceready", onReady);
            } else {
                onReady();
            }
		},
        
		routes: {
            '': 'main'
		},
        
        main: function(qp){
            var matcher;
            var logItems = allLogItems;
            
            $('#explorer-nav').html(compiledExplorerTemplate({ data : (qp || {}) }));
            
            if(qp && qp.page) {
                //The page parameter should be more though out.
                //Right now it is treated as a regex,
                //but this leads to a bunch of escaping issues.
                //(e.g. a "." will be treated as a wildcard,
                //but that will usually work out ok)
                matcher = new RegExp(qp.page);
                logItems = new LogItems(allLogItems.filter(function(logItem){
                    return matcher.test(logItem.get("page"));
                }));
            }
            var clipList = new ClipList({
                collection: logItems,
                allSessions: allSessions,
                el: document.getElementById('results')
            });
            clipList.render();
        }
	});

    var init = function(){
		this.router = new Router();
	};
	return { init: init };
});
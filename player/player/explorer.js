define([ 'underscore', 'backbone', 'player', 'ClipList'],
function( _,            Backbone,   player,   ClipList) {

    var LogItem = Backbone.Model.extend({

        validate: function(attrs) {
            if (!attrs.page) {
                return "page missing";
            }
        }

    });

    var LogItems = Backbone.Collection.extend({

        model: LogItem,

        comparator: function(todo) {
            return todo.get('_timestamp');
        },

        rfind: function(iterator) {
            for (var i = (this.length - 1); i >= 0; i--) {
                if (iterator(this.models[i])) {
                    return this.models[i];
                }
            }
        },

        /**
         * Returns the most recently logged value of the given attribute.
         * If the attribute is not found returns defaultValue.
         */
        getAttr: function(attrName, defaultValue) {
            var foundItem = Log.rfind(function(logItem) {
                return logItem.has(attrName);
            });
            if (foundItem) {
                return foundItem.get(attrName);
            }
            return defaultValue;
        }

    });

    var Router = Backbone.Router.extend({
        initialize: function(options){
            this.logItems = options.logItems;
			Backbone.history.start();
            //TODO: Loading message?
		},
		routes: {
            '': 'main',
            'filter': 'filter'
		},
        main: function(){
            var clipList = new ClipList({
                collection: this.logItems,
                el: document.getElementById('results')
            });
            clipList.render();
        },
        filter: function(qp){
            var collection, matcher;
            if(qp && qp.page) {
                //The page parameter should be more though out.
                //Right now it is treated as a regex,
                //but this leads to a bunch of escaping issues.
                //(e.g. a "." will be treated as a wildcard,
                //but that will usually work out ok)
                matcher = new RegExp(qp.page);
                collection = new LogItems(this.logItems.filter(function(logItem){
                    return matcher.test(logItem.get("page"));
                }));
            } else {
                collection = this.logItems;
            }
            var clipList = new ClipList({
                collection: collection,
                el: document.getElementById('results')
            });
            clipList.render();
        }
	});

    var init = function(){
        var logItems = new LogItems();
        //TODO: Params as nested objects?
        var debugStartTime = Math.random()*2000000000000;
        var debugLogItems = [
            {
                _recordingStart: new Date(debugStartTime),
                _timestamp: new Date(debugStartTime + Math.random()*20000),
                _sessionId: "A23-B34",
                page: "communityActivities.html"
            },
            {
                _recordingStart: new Date(debugStartTime),
                _timestamp: new Date(debugStartTime + Math.random()*20000),
                _sessionId: "A23-B34",
                page: "communityActivityFollowUp.html"
            },
            {
                _recordingStart: new Date(debugStartTime),
                _timestamp: new Date(debugStartTime + Math.random()*20000),
                _sessionId: "A23-B34",
                page: "interviewEnd",
            }
        ];
        
        logItems.reset(debugLogItems);
        
        //logItems.fetch();
        
        //Will eventually need to limit the log items pulled down with ajax.
        //logItems.fetch({data: {param: 3}});
		this.router = new Router({
            logItems: logItems
		});
	};
	return { init: init };
});
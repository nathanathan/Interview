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
        currentContext: {
            page: '',
            qp: {},
            last: {},
            url: ''
        },
        initialize: function(){
			Backbone.history.start();
            //TODO: Loading message?
		},
		routes: {
            '': 'main'
		},
        main: function(){
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
            
            /*
            logItems.fetch();
            logItems.filter(function(logItem) {
        
            });
            */
            //For ajax:
            //logItems.fetch({data: {param: 3}})
        
            var clipList = new ClipList({
                collection: logItems,
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
define([
	'jquery', 
	'backbone', 
	'underscore'], 
function($, Backbone, _, mainView){
    //TODO: Implement include function for templates.
    // it will return a stub, and then asyc get the template.
    // and fill in the stub when it loads.
    
    function GUID() {
        var S4 = function () {
            return Math.floor(
                    Math.random() * 0x10000 /* 65536 */
                ).toString(16);
        };
    
        return (
                S4() + S4() + "-" +
                S4() + "-" +
                S4() + "-" +
                S4() + "-" +
                S4() + S4() + S4()
            );
    }
    var sessionId = GUID();
    var LogItem = Backbone.Model.extend({
    
        defaults: function() {
            return {
                _timestamp : new Date(),
                _sessionId : sessionId
            };
        },
    
        validate: function(attrs) {
            if (!attrs.page) {
                return "page missing";
            }
        },

    
    });
    
    var LogItems = Backbone.Collection.extend({
    
        model: LogItem,

        comparator: function(todo) {
            return todo.get('_timestamp');
        },
                
        rfind: function(iterator) {
            for(var i=(this.length - 1); i >= 0; i--){
                if(iterator(this.models[i])) {
                    return this.models[i];
                }
            }
        },
        
        /**
         * Returns the most recently logged value of the given attribute.
         * If the attribute is not found returns defaultValue.
         */
        getAttr: function(attrName, defaultValue) {
            var foundItem = Log.rfind(function(logItem){
                return logItem.has(attrName);
            });
            if(foundItem){
                return foundItem.get(attrName);
            }
            return defaultValue;
        }
    
    });
    
    // Create our global collection of **Todos**.
    var Log = new LogItems();
    window.Log = Log;
    var $container =  $('#container');
    //indexRelPathPrefix computed so the location of the boilerplate directory can change
    //only requiring modification of index.html
    //I haven't tested it though.
    var indexRelPathPrefix = _.map(require.toUrl('').split('/'), function(){return '';}).join('../');
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
            '': 'start',
			':page': 'setPage'
		},
        start: function(){
            this.navigate($container.data('start'), {trigger: true, replace: true});
        },
		setPage: function(page, params){
            var that = this;
            console.log('params:');
            console.log(params);
            if(!params){
                params = {};
            }
            Log.add(_.extend({}, params, {
                page: page,
                lastPage: that.currentContext.page
            }));
            require(['text!' + indexRelPathPrefix + page], function(template){
                that.currentContext = {
                    page: page,
                    qp: params,
                    last: that.currentContext,
                    url: that.toFragment(page, params)
                };
                try{
                    var compiledTemplate = _.template(template);
                } catch(e) {
                    console.error(e);
                    alert("Error compiling template.");
                }
                try{
                    var renderedHtml = compiledTemplate(that.currentContext);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
                $container.html(renderedHtml);
                
            }, function(error){
                console.error(error);
                alert("Could not load page: " + error.requireModules[0].substring(5));
            });
		}
	});
	return Router;
});

define([
	'jquery', 
	'backbone', 
	'underscore',
    'text!opening.html',
    'text!body.html',
    'text!interviewEnd.html'], 
function($, Backbone, _, openingTemplate, bodyTemplate, interviewEndTemplate){
    //TODO: Implement include function for templates.
    // it will return a stub, and then asyc get the template.
    // and fill in the stub when it loads.
    // Maybe it could be a require.js plugin?
    
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
    var recordingName = sessionId + ".amr";
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
        }

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
            '': 'opening',
            'interviewEnd':'interviewEnd',
			':page': 'setPage'
		},
        opening: function(){
            var that = this;
            $('body').html(_.template(openingTemplate)({title: "Interview"}));
            $('#start').click(function start(){
                $('body').html(_.template(bodyTemplate)());
                var $stop = $('#stop');
                var $time = $('#time');
                var recStartTime = new Date();
                function setAudioPosition(time){
                    $time.text((new Date() - recStartTime) / 1000);
                }
                //If Media is not available, mediarec has dummy functions that do nothing.
                var mediaRec = {
                    startRecord: function(){},
                    stopRecord: function(){},
                    release: function(){}
                };
                if('Media' in window) {
                    //TODO: Should probably be using these callbacks.
                    mediaRec = new Media(recordingName, function onSuccess(){
                        
                    }, function onError(){
                        
                    });
                } else {
                    //TODO: How do dismiss?
                    //TODO: Use template.
                    $('body').prepend('<div class="alert alert-block"><button type="button" class="close" data-dismiss="alert">×</button><h4>Warning!</h4> Audio is not being recorded.</div>');
                }
                mediaRec.startRecord();
                var recInterval = setInterval(function() {
                    setAudioPosition();
                }, 1000);
                $stop.click(function(){
                    $stop.addClass('disabled');
                    mediaRec.stopRecord();
                    mediaRec.release();
                    clearInterval(recInterval);
                    that.navigate('interviewEnd', {trigger: true});
                });
                that.navigate('start.html', {trigger: true, replace: true});
            });
        },
        interviewEnd: function(){
            $('body').html(_.template(interviewEndTemplate)());
            $('a').click(function(){
                alert("Implement storage");
            });
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
                var compiledTemplate, renderedHtml;
                that.currentContext = {
                    page: page,
                    qp: params,
                    last: that.currentContext,
                    url: that.toFragment(page, params)
                };
                try{
                    compiledTemplate = _.template(template);
                } catch(e) {
                    console.error(e);
                    alert("Error compiling template.");
                }
                try{
                    renderedHtml = compiledTemplate(that.currentContext);
                } catch(e) {
                    console.error(e);
                    alert("Error rendering page.");
                }
                $('#container').html(renderedHtml);
            }, function(error){
                console.error(error);
                alert("Could not load page: " + error.requireModules[0].substring(5));
            });
		}
	});
	return Router;
});

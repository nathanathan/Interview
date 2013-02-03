define(['jquery', 'backbone', 'underscore', 'backbonels'],
function($,        Backbone,   _) {
    
    var LogItem = Backbone.Model.extend({
    
        defaults: function() {
            return {
                _timestamp : new Date()
            };
        },
    
        validate: function(attrs) {
            if (!attrs.page) {
                return "page missing";
            }
        },
        
        getTimeOffset: function(){
            console.error("LogItem.getTimeOffset:Deprecated");
            return (this.get('_timestamp') - this.get('_recordingStart'));
        },
        
        //new Date(JSON.parse(JSON.stringify(new Date())))
        //JSON stringifies dates in a wierd way that the Date object can't parse in webkits.
        //TODO: Localize
        toJSON: function(){
            var attrs = _.clone(this.attributes);
            if(attrs._timestamp) {
                attrs._timestamp = String(attrs._timestamp);
            }
            if(attrs._recordingStart) {
                attrs._recordingStart = String(attrs._recordingStart);
            }
            return attrs;
        },

        parse: function(attrs) {
            //Parse dates strings into js objects
            if(attrs._timestamp) {
                attrs._timestamp = new Date(attrs._timestamp);
            }
            if(attrs._recordingStart) {
                attrs._recordingStart = new Date(attrs._recordingStart);
            }
            return attrs;
        }

    });
    
    return Backbone.Collection.extend({

        model: LogItem,
        
        localStorage: new Backbone.LocalStorage("interview-logItems"),

        //Saving a collection is kind of an unusual thing to do
        //because generally it is a good idea to immediately save models to avoid
        //data loss. I did this so I could defer the decision to save an interview
        //until after it ends but it might be better to save during the interview
        //and delete it if it is discarded.
        save: function(context) {
            var defaultContext = {
                success: function(){},
                error: function(){}
            };
            if(context) {
                context = _.extend(defaultContext, context);
            } else {
                context = defaultContext;
            }
            var itemContext = {
                success: _.after(this.length, context.success),
                error: _.once(context.error)
            };
            this.forEach(function(logItem) {
                logItem.save(null, itemContext);
            });
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
            var foundItem = this.rfind(function(logItem){
                return logItem.has(attrName);
            });
            if(foundItem){
                return foundItem.get(attrName);
            }
            return defaultValue;
        },
        
        genComparator : function(cfunc, incr) {
            if(!incr) {
                incr = 1;
            }
            return function(Ain, Bin) {
                var A = cfunc(Ain);
                var B = cfunc(Bin);
                if(A < B) return -incr;
                if(A > B) return incr;
                if(A == B) return 0;
            };
        },
        
        sortPage: function(orderVar) {
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("page");
            }, orderVar);
            this.sort();
            return this;
        },
        
        sortTime: function(orderVar) {
            this.comparator = this.genComparator(function(entry) {
                return entry.get("_timestamp");
            }, orderVar);
            this.sort();
            return this;
        },

        addDurations: function(endTime){
            console.error("LogItems.addDurations:Deprecated");
            if(!endTime) {
                console.error("addDurations: No endTime");
            }
            var nextItemTimeStamp = endTime;
            //I'm hoping cloning prevents sortTime from causing any mutation.
            this.clone().sortTime(-1).forEach(function(logItem){
                var curTimestamp = logItem.get("_timestamp");
                logItem.set("_duration", nextItemTimeStamp - curTimestamp);
                nextItemTimeStamp = curTimestamp;
            });
        },
        
        parse: function(response) {
            var parse = (new LogItem()).parse;
            return _.map(response, function(attrs){
                return parse(attrs);
            });
        }
        
    });
});

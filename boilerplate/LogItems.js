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

        parse: function(context) {
            //Parse dates strings into js objects
            if(context._timestamp) {
                context._timestamp = new Date(context._timestamp);
            }
            if(context._recordingStart) {
                context._recordingStart = new Date(context._recordingStart);
            }
            return context;
        }

    });
    
    return Backbone.Collection.extend({

        model: LogItem,
        
        localStorage: new Backbone.LocalStorage("interview-logItems"),

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
                console.log('test');
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
            var nextItemTimeStamp = endTime;
            //I'm hoping cloning prevents sortTime from causing any mutation.
            this.clone().sortTime(-1).forEach(function(logItem){
                var curTimestamp = logItem.get("_timestamp");
                logItem.set("_duration", nextItemTimeStamp - curTimestamp);
                nextItemTimeStamp = curTimestamp;
            });
        }
        
    });
});

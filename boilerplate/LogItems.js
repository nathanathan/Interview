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
        }

    });
    
    return Backbone.Collection.extend({

        orderVar: 1,

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
        
        sortPage: function(e) {
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get("page");
            }, this.orderVar);
            this.sort();
            return this;
        },
        
        sortTime: function(e) {
            this.orderVar = -this.orderVar;
            this.comparator = this.genComparator(function(entry) {
                return entry.get("_timestamp");
            }, this.orderVar);
            this.sort();
            return this;
        }
        
    });
});

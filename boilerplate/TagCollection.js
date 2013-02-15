define(['backbone', 'underscore', 'sfsf'],
function(Backbone,   _,            sfsf) {
    
    var Tag = Backbone.Model.extend({
        
        defaults: function() {
            return {
                _timestamp : new Date()
            };
        },
        
        sync: function(){},
        
        //JSON stringifies dates in a way that the Date object can't parse in webkits.
        //Try: new Date(JSON.parse(JSON.stringify(new Date())))
        //To avoid this issue dates can be stringified with the String function.
        //TODO: Use .toUTCString instead?
        //TODO: Maybe add this to the Backbone core?
        toJSON: function() {
            var attrs = _.clone(this.attributes);
            _.each(attrs, function(attrName, attrValue){
                if(_.isDate(attrValue)){
                    attrs[attrName] = String(attrValue);
                }
            });
            return attrs;
        },

        parse: function(attrs) {
            //Parse dates strings into js objects
            if(attrs._timestamp) {
                attrs._timestamp = new Date(attrs._timestamp);
            }
            return attrs;
        }
        
    });
    
    return Backbone.Collection.extend({
        
        initialize: function(models, options){
            this.options = options;
        },
        
        model: Tag,
        
        saveToFS: function(options){
            var that = this;
            var filePath = sfsf.joinPaths(options.dirPath, that.options.id +
                    '.' + that.options.layerName + '.tags.json');
            console.log("saving " + filePath);
            sfsf.cretrieve(filePath, {
                data: JSON.stringify(that.toJSON()),
                type: 'text/plain'
            }, function(error) {
                if(error){
                    options.error(error);
                    return;
                }
                console.log("contents written!");
                options.success();
            });
        }
        
    });
});

define(['jquery', 'backbone', 'underscore', 'backbonels'],
function($,        Backbone,   _) {
    return Backbone.Collection.extend({

        localStorage: new Backbone.LocalStorage("interview-sessions"),
        
        model: Backbone.Model.extend({
            toJSON: function(){
                var attrs = _.clone(this.attributes);
                if(attrs.startTime) {
                    attrs.startTime = String(attrs.startTime);
                }
                if(attrs.endTime) {
                    attrs.endTime = String(attrs.endTime);
                }
                return attrs;
            },
    
            parse: function(attrs) {
                //Parse dates strings into js objects
                if(attrs.startTime) {
                    attrs.startTime = new Date(attrs.startTime);
                }
                if(attrs.endTime) {
                    attrs.endTime = new Date(attrs.endTime);
                }
                return attrs;
            },
            
            dropboxSave: function(options){
                
            },
            dropboxFetch: function(options){
                
            }
        }),

    });
});

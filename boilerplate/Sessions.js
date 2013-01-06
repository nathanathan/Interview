define(['jquery', 'backbone', 'underscore', 'backbonels'],
function($,        Backbone,   _) {
    return Backbone.Collection.extend({

        localStorage: new Backbone.LocalStorage("interview-sessions")

    });
});

define([
    'config',
    'jquery', 
	'backbone', 
	'underscore',
    'text!interviewer/opening.html'],
function(config, $, Backbone, _, questionTemplate){
    var QuestionView = Backbone.View.extend({
        //updater tracks the setInterval() id.
        updater: null,
        template: _.template(questionTemplate),
        render: function() {
            console.log('PlayerView:render');
            var context = this.model.toJSON();
            this.$el.html(this.template(context));
            return this;
        },
        events: {
            'click #tag-btn' : 'addTag'
        },
        addTag: function(evt){
            console.log('seek');
            if(window.chrome) console.log(evt);
            var $seeker = $(evt.currentTarget);
            //Problem: firefox doesn't have offsetX
            var progressPercentage = (evt.offsetX * 100 / $seeker.width());
            this.model.setProgress(progressPercentage);
            console.log('seeking media to: ' + this.model.get('time') * 1000);
            this.options.media.seekTo(this.model.get('time') * 1000);
            return this;
        }
    });
    return QuestionView;
});

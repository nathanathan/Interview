define(['backbone', 'underscore', 'text!playerTemplate.html'], function(Backbone, _, playerTemplate){
    var PlayerModel = Backbone.Model.extend({
        defaults: {
            //Progress as a percentage:
            "progress": 0,
            //Time in seconds (note that this lags behind the actual media object's time)
            "time": 0,
            "duration": 0,
            "playing": false
        },
        validate: function(attrs) {
            if (attrs.time >= this.get("duration") || attrs.time < 0) {
                console.error("Time out of bounds");
                return "Time out of bounds";
            }
        },
        setProgress: function(progressPercentage){
            this.set({
                "progress": progressPercentage,
                "time": ((progressPercentage / 100) * this.get("duration"))
            });
            return this;
        },
        setTime: function(timeSeconds) {
            console.log(timeSeconds / this.get("duration"));
            //Need to update underscore/backbone to resolve the "has" error.
            this.set({
                "progress": (timeSeconds / this.get("duration")) * 100,
                "time": timeSeconds
            });
            return this;
        }
    });
    
    var PlayerView = Backbone.View.extend({
        updater: null,//Used to keep track of the setInterval id
        template: _.template(playerTemplate),
        render: function() {
            console.log('render');
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },
        events: {
            'click #seeker' : 'seek',
            'click #play' : 'play',
            'click #pause' : 'pause',
            'click #stop' : 'stop'
        },
        seek: function(e){
            console.log('seek');
            console.log(e);
            var $seeker = $(e.currentTarget);
            //Problem: firefox doesn't have offsetX
            var progressPercentage = (e.offsetX * 100 / $seeker.width());
            this.model.setProgress(progressPercentage);
            this.options.media.seekTo(this.model.get('time'));
            return this;
        },
        play: function(e){
            console.log('play');
            console.log(e);
            var that = this;
            var playerModel = this.model;
            if(playerModel.get('playing')){
                return;
            }
            playerModel.set('playing', true);
            this.options.media.play();
            this.updater = setInterval(function(){
                that.options.media.getCurrentPosition(function(positionSeconds){
                    if(playerModel.get('time') === positionSeconds){
                        that.$('#progressBar').addClass('halted');
                    } else {
                        playerModel.setTime(positionSeconds);
                    }
                });
            }, 1000);
            return this;
        },
        pause: function(e){
            console.log('pause');
            console.log(e);
            if(!this.model.get('playing')){
                return;
            }
            clearInterval(this.updater);
            this.model.set('playing', false);
            this.options.media.pause();
            return this;
        },
        stop: function(e){
            console.log('stop');
            console.log(e);
            if(!this.model.get('playing')){
                return;
            }
            clearInterval(this.updater);
            this.options.media.stop();
            this.model.set('playing', false);
            this.model.setTime(0);
            return this;
        }
    });
    
    var create = function(context){
        var defaultContext = {
            containerEl: document.getElementById("player-container"),
            media: null,//new Media(),
            logItems: new Backbone.Collection(),
            start: 0
        };
        context = _.extend(defaultContext, context);
        if(!(context.media.getDuration() > 0)){
            console.log("Could not get media duration, be sure it is loaded before passing it to player.create()");
        }
        var player = new PlayerModel({
            //Note, duration must be static.
            duration: context.media.getDuration()
        });
        player.setTime(context.start);
        //This is a bit inelegant
        context.media.seekTo(context.start);
        
        var view = new PlayerView({
            model: player,
            media: context.media
        });
        player.on("change", view.render, view);
        player.on("error", view.pause, view);
        
        view.setElement(context.containerEl);
        
        view.render();
        //$('body').append(view.render().el);
        /*
        Dont think I need this bc the player view only reflects the media state.
        But maybe I want to indicate that the media is loading?
        myAudio.on('pause', function(evt) {
            view.pause(evt);
            if(myAudio.readyState() > 2) {
                //view.pause(evt);
            }
        });
        */
	};
	return { create: create };
});

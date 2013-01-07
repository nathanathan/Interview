//TODO: It would be nice to have a way to pass in media files with different offsets.
//(i.e. pass in a shortened clip from an interview)
//Also, it would be nice to have a way to use media files with pauses in them.
//Handling pauses would be really tricky, so I probably won't bother.
//The popcorn.js movie maker has an interesting way of handling skips that might
//be applicable.
define(['backbone', 'underscore', 'text!player/playerTemplate.html', 'text!player/logItemTemplate.html'],
function(Backbone,   _,            playerTemplate,                    logItemTemplate){
    var compiledPlayerTemplate = _.template(playerTemplate);
    var compiledLogItemTemplate  = _.template(logItemTemplate);
    
    var PlayerModel = Backbone.Model.extend({
        validate: function(attrs) {
            if (attrs.time >= this.get("duration") || attrs.time < 0) {
                console.error("Time out of bounds");
                console.error(attrs.time);
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
        //updater tracks the setInterval() id.
        updater: null,
        template: compiledPlayerTemplate,
        render: function() {
            console.log('render');
            var context = this.model.toJSON();
            this.$el.html(this.template(context));
            return this;
        },
        events: {
            'click #seeker' : 'seek',
            'click #play' : 'play',
            'click #pause' : 'pause',
            'click #stop' : 'stop'
        },
        seek: function(evt){
            console.log('seek');
            if(window.chrome) console.log(evt);
            var $seeker = $(evt.currentTarget);
            //Problem: firefox doesn't have offsetX
            var progressPercentage = (evt.offsetX * 100 / $seeker.width());
            this.model.setProgress(progressPercentage);
            this.options.media.seekTo(this.model.get('time'));
            return this;
        },
        play: function(evt){
            console.log('play');
            if(window.chrome) console.log(evt);
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
        pause: function(evt){
            console.log('pause');
            if(window.chrome) console.log(evt);
            if(!this.model.get('playing')){
                console.log("not playing");
                return;
            }
            clearInterval(this.updater);
            this.model.set('playing', false);
            this.options.media.pause();
            return this;
        },
        stop: function(evt){
            console.log('stop');
            if(window.chrome) console.log(evt);
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
        console.log("Creating player");
        var defaultContext = {
            containerEl: document.getElementById("player-container"),
            media: null,//new Media(),
            logItems: new Backbone.Collection(),
            start: 0
        };
        context = _.extend(defaultContext, context);
        if(!(context.media.getDuration() > 0)){
            alert("Could not get media duration, be sure it is loaded before passing it to player.create()");
        }
        if(context.media.getDuration() === Infinity) {
            alert("Media is infinately long?");
        }
        var player = new PlayerModel({
            //Progress as a percentage:
            progress: 0,
            //Time in seconds
            //(note that this lags behind the actual media object's time)
            time: 0,
            //Note, duration must be static.
            duration: context.media.getDuration(),
            playing: false
        });
        
        /*
        var startTimestamp = new Date();
        //Assuming that the first logItem's timestamp matches the start of the
        //recording.
        context.logItems.forEach(function(logItem){
            var timestamp = logItem.get('_timestamp');
            if(timestamp < startTimestamp) {
                startTimestamp = timestamp;
            }
        });
        */
        
        //Setting the start time is a bit inelegant right now.
        player.setTime(context.start);
        context.media.seekTo(context.start);
        
        var $playerControls = $('<div>');
        var $markers = $('<div id="logItemContainer">');
        var $info = $('<div id="logItemInfo">');
        $(context.containerEl)
            .empty()
            .append($playerControls)
            .append($markers)
            .append($info);

        var updateMarkers = function(){
            var deselectPrevious = function(){};
            $markers.empty();
            //Track current log item in url for navigation?
            context.logItems.each(function(logItem){
                //var secondsOffset = (logItem.get('_timestamp') - startTimestamp) / 1000;
                var secondsOffset = logItem.getTimeOffset() / 1000;
                var logItemProgress = secondsOffset / player.get("duration");
                var $marker = $('<div class="logItemMarker">');
                $marker.css("left", logItemProgress * 100 + '%');
                $markers.append($marker);
                $marker.click(function(evt){
                    var $selectedMarker = $marker;
                    if(window.chrome) console.log(evt);
                    deselectPrevious();
                    deselectPrevious = function(){
                        $selectedMarker.removeClass("selected");
                    };
                    $selectedMarker.addClass("selected");
                    $info.html(compiledLogItemTemplate(logItem.toJSON()));
                    $info.find('.playhere').click(function(evt){
                        player.setTime(secondsOffset);
                        context.media.seekTo(secondsOffset);
                    });
                });
            });
        };
        
        var playerView = new PlayerView({
            model: player,
            media: context.media
        });
        player.on("change", playerView.render, playerView);
        //player.on("change", updateMarkers);
        updateMarkers();
        player.on("error", playerView.pause, playerView);
        
        playerView.setElement($playerControls.get(0));
        playerView.render();
	};
    
	return { create: create };
    
});

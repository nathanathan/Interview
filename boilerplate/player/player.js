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
            console.log('PlayerView:render');
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
            console.log('seeking media to: ' + this.model.get('time') * 1000);
            this.options.media.seekTo(this.model.get('time') * 1000);
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
                //TODO: Add failure function that pauses and goes to start/end
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
            media: null,
            logItems: new Backbone.Collection(),//Problem
            session: new Backbone.Model({
                startTime: new Date(0),
                endTime: new Date(context.media.getDuration())
            }),
            //Start time in millis
            start: 0
        };
        context = _.extend(defaultContext, context);
        
        //Note:
        //The timeline shows the session duration rather than the recording duration.
        //This means that we need to be careful when seeking as these might have some discrepancies...
        var sessionDuration = context.session.get('endTime') - context.session.get('startTime');
        console.log("session duration:" +sessionDuration);
        
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
            duration: sessionDuration / 1000,
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
        console.log("Start time: " + context.start);
        //Setting the start time is a bit inelegant right now.
        player.setTime(context.start / 1000);
        context.media.seekTo(context.start);
        
        var $playerControls = $('<div>');
        var $markers = $('<div id="logItemContainer">');
        var $info = $('<div id="logItemInfo">');
        
        $(context.containerEl)
            .empty()
            .append($playerControls)
            .append($markers)
            .append($info);
        
        var selectedLogItem = null;
        var updateMarkers = function(){
            console.log("updateMarkers");
            $markers.empty();
            //Track current log item in url for navigation?
            context.logItems.each(function(logItem){
                var millisOffset = logItem.get('_timestamp') - context.session.get('startTime');
                var logItemProgress = (millisOffset / 1000) / player.get("duration");
                var $marker = $('<div class="logItemMarker">');
                $marker.css("left", logItemProgress * 100 + '%');
                window.x = logItem.get('_timestamp'); window.y = context.session.get('startTime');
                $markers.append($marker);
                $marker.click(function(){
                    selectedLogItem = logItem;
                    updateMarkers();
                });
                if(selectedLogItem === logItem){
                    $marker.addClass("selected");
                    try{
                        $info.html(compiledLogItemTemplate(logItem.toJSON()));
                    } catch(e) {
                        alert("Could not render template.");
                        console.error(e);
                        return;
                    }
                    $info.find('.playhere').click(function(evt){
                        player.setTime(millisOffset / 1000);
                        context.media.seekTo(millisOffset);
                    });
                }
            });
        };
        
        var playerView = new PlayerView({
            model: player,
            media: context.media
        });
        player.on("change", playerView.render, playerView);
        
        updateMarkers();
        
        player.on("error", playerView.pause, playerView);
        
        playerView.setElement($playerControls.get(0));
        playerView.render();
        return this;
	};
    
	return {
        create: create
    };
    
});

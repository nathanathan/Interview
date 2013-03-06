define(['config', 'backbone', 'underscore', 'text!player/playerLayout.html', 'text!player/logItemTemplate.html', 'text!player/controlsTemplate.html', 'Popcorn'],
function(config,   Backbone,   _,            playerLayout,                    logItemTemplate, controlsTemplate){

    var compiledLogItemTemplate  = _.template(logItemTemplate);
    
    var getMediaPhonegap = function(path, callback) {
        var media = new Media(path,
        function(){},
        function(err){
            console.error("Media error:");
            console.error(err);
        }, function(status){
            if(status === Media.MEDIA_STOPPED) {
                if("onStop" in media) {
                    media.onStop();
                }
            }
        });
        media.seekTo(0);
        var attempts = 10;
        function waitForDuration(){
            if(attempts === 0) {
                alert("Could not get media duration for:\n" + path);
                return;
            }
            attempts--;
            if(media.getDuration() > 0) {
                callback(media);
            } else {
                window.setTimeout(waitForDuration, 100);
            }
        }
        waitForDuration();
    };
    var testVideos = [
        'http://cuepoint.org/dartmoor.mp4',
        "http://clips.vorwaerts-gmbh.de/VfE_html5.mp4",
        'http://cuepoint.org/dartmoor.mp4',
        "http://clips.vorwaerts-gmbh.de/VfE_html5.mp4"];
        
    var getMediaDebug = function(path, callback) {
        var $audioContainer = $('<div>');
        var generatedId = "random-" + (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        $audioContainer.attr("id", generatedId);
        $('body').append($audioContainer);
        /*
        var myAudio = Popcorn.youtube($audioContainer.get(0), 'http://www.youtube.com/watch?v=oozJH6jSr2U&width=0&height=0' );
        */
        
        var myAudio = Popcorn.smart(
         "#" + generatedId,
         testVideos.pop());

        window.audioDbg = myAudio;
        myAudio.on("loadedmetadata", function() {
            myAudio.off("loadedmetadata");
            var mediaWrapper = {
                play: function(){
                    myAudio.play();
                },
                pause: function(){
                    myAudio.pause();
                },
                stop: function(){
                    console.log("Stopping audio:", path);
                    //Seek to the end
                    myAudio.currentTime(myAudio.duration());
                    //myAudio.pause();
                    //myAudio.trigger("ended");
                },
                getCurrentPosition: function(mediaSuccess, mediaError){
                    //mediaSuccess(myAudio.currentTime);
                    mediaSuccess(myAudio.currentTime());
                },
                getDuration: function(){
                    //return myAudio.duration;
                    return myAudio.duration();
                },
                seekTo: function(millis){
                    console.log("seeking to: " + millis);
                    //myAudio.currentTime = timeSeconds;
                    myAudio.currentTime(Math.floor(millis / 1000));
                    //myAudio.currentTime = Math.floor(millis / 1000);
                }
            };
            //TODO: Extend with backbone events instead, eg:
            //_.extend(mediaWrapper, Backbone.Events);
            myAudio.on("ended", function(){
                console.log("Media file ended");
                if("onStop" in mediaWrapper){
                    mediaWrapper.onStop();
                }
            });
            callback(mediaWrapper);
        });
    };
    
    var getMedia = function(path, callback) {
        //TODO: Download media into temporairy fs if not present? Maybe it is better to just sync everything up front for now.
        //TODO: Figure out how to play audio from chrome.
        if('Media' in window){
            getMediaPhonegap(path, callback);
        } else {
            getMediaDebug(path, callback);
        }
    };
    
    /**
     * create a special media object for playing a sequence of clips
     * the clips are specified in an array like this
     * [{start: timestamp, end: timestamp, path: pathToClipMediaFile }]
     **/
    var createClipPlayer = function(clips, callback) {
        //Clips must be sorted
        //TODO: Separate paused state from playing...
        var clipLoaded = _.after(clips.length, function(){
            var tickInterval = 200;
            var currentClip = clips[0];
            var clipSequencePlayer = _.extend(Backbone.Events, {
                cachedState : {
                    offsetMillis: 0,
                    progressPercent: 0,
                    playing: false
                },
                play: function(){
                    clearInterval(this.ticker);
                    this.ticker = setInterval(function(){
                        clipSequencePlayer.trigger('tick');
                    }, tickInterval);
                    
                    if(currentClip.idx < clips.length - 1){
                        currentClip.media.onStop = _.once(function(){
                            console.log("starting clip idx:", currentClip.idx + 1);
                            currentClip = clips[currentClip.idx + 1];
                            currentClip.media.seekTo(0);
                            clipSequencePlayer.play();
                        });
                    } else {
                        currentClip.media.onStop = _.once(function(){
                            clipSequencePlayer.stop();
                        });
                    }
                    currentClip.media.play();
                    console.log("Playing: ", currentClip.path);
                },
                pause: function(){
                    console.log("Pausing clip player...");
                    
                    currentClip.media.pause();
                    
                    clearInterval(this.ticker);
                    clipSequencePlayer.trigger('tick');
                    clipSequencePlayer.trigger('tick');
                },
                stop: function(){
                    console.log("Stopping clip player...");
                    currentClip.media.stop();
                    currentClip = clips[0];
                    currentClip.media.seekTo(0);
                    clearInterval(this.ticker);
                    clipSequencePlayer.trigger('tick');
                    clipSequencePlayer.trigger('tick');
                },
                getCurrentPosition: function(mediaSuccess, mediaError){
                    currentClip.media.getCurrentPosition(function(positionSeconds){
                        var priorClipDurationMillis = _.reduce(clips.slice(0, currentClip.idx),
                            function(memo, clip){ 
                                return memo + (clip.end - clip.start); 
                            }, 0);
                        mediaSuccess(positionSeconds + (priorClipDurationMillis / 1000));
                    }, mediaError);
                },
                getDuration: function(){
                    var audioDuration = _.reduce(clips, function(memo, clip){ 
                         return memo + clip.media.getDuration(); 
                    }, 0);
                    var timestampDuration = _.reduce(clips, function(memo, clip){ 
                         return memo + (clip.end - clip.start); 
                    }, 0);
                    console.log("Duration delta: ", timestampDuration - audioDuration);
                    return timestampDuration;
                },
                getActualDuration: function(){
                    return clips[clips.length - 1].end - clips[0].start;
                },
                seekTo: function(offsetMillis){
                    console.log("Seeking: " + offsetMillis);
                    var isPlaying = clipSequencePlayer.cachedState.playing;
                    var remainingOffset = offsetMillis;
                    var clipIdx = 0;
                    var clip, clipDuration;
                    while(clipIdx < clips.length){
                        clip = clips[clipIdx];
                        clipIdx++;
                        clipDuration = Number(clip.end) - Number(clip.start);
                        console.log("current clip duration:", clipDuration);
                        if(remainingOffset > clipDuration){
                            remainingOffset -= clipDuration; 
                        } else {
                            if(currentClip !== clip){
                                currentClip.media.pause();
                                console.log("starting clip:", clip);
                                currentClip = clip;
                                clip.media.seekTo(remainingOffset);
                                if(isPlaying){
                                    clipSequencePlayer.play();
                                }
                                //Ticks are triggered for faster UI feedback.
                                clipSequencePlayer.trigger('tick');
                            } else {
                                clip.media.seekTo(remainingOffset);
                                //Ticks are triggered for faster UI feedback.
                                clipSequencePlayer.trigger('tick');
                            }
                            return;
                        }
                    }
                },
                offsetToTimestamp: function(offset){
                    var remainingOffset = offset;
                    var clipIdx = 0;
                    var clip, clipDuration;
                    while(clipIdx < clips.length){
                        clip = clips[clipIdx];
                        clipIdx++;
                        clipDuration = Number(clip.end) - Number(clip.start);
                        if(remainingOffset > clipDuration){
                            remainingOffset -= clipDuration; 
                        } else {
                            return new Date(Number(clip.start) + remainingOffset);
                        }
                    }
                },
                timestampToOffset: function(timestamp){
                    var offset = 0;
                    var clipIdx = 0;
                    var clip;
                    while(clipIdx < clips.length){
                        clip = clips[clipIdx];
                        clipIdx++;
                        if(timestamp > clip.end){
                            offset += Number(clip.end) - Number(clip.start);
                        } else {
                            return offset + (Number(timestamp) - Number(clip.start));
                        }
                    }
                }
            });
            
            var lastOffset = 0;
            clipSequencePlayer.on('tick', function(){
                //This is for updating the cached state.
                clipSequencePlayer.getCurrentPosition(function(offsetSeconds){
                    var offsetMillis = offsetSeconds * 1000;
                    var isPlaying = offsetMillis !== lastOffset;
                    clipSequencePlayer.cachedState = {
                        offsetMillis: offsetMillis,
                        progressPercent: offsetMillis / clipSequencePlayer.getDuration(),
                        playing: isPlaying
                    };
                    /*
                    if(!isPlaying){
                        clipSequencePlayer.pause();
                    }
                    */
                    
                    lastOffset = offsetMillis;
                }, function(){
                    console.log("ERROR: cound not get current position");
                });
            });
            clipSequencePlayer.on('tick', function(){
                //This is needed if the clip's timestamps are shorter than the clip.
                currentClip.media.getCurrentPosition(function(offsetSeconds){
                    if((offsetSeconds * 1000) > (currentClip.end - currentClip.start)){
                        currentClip.media.stop();
                    }
                }, function(){
                    console.log("ERROR: cound not get current position");
                });

            });

            callback(clipSequencePlayer);
        });
        //We could probably lazy load clips if this takes too long.
        _.each(clips, function(clip, idx){
            clip.idx = idx;
            getMedia(clip.path, function(media){
                clip.media = media;
                clipLoaded();
            });
        });
    };
    
    var ControlsView = Backbone.View.extend({
        template: _.template(controlsTemplate),
        render: function() {
            this.$el.html(this.template(this.options.media.cachedState));
            return this;
        },
        events: {
            'click #play' : 'play',
            'click #pause' : 'pause',
            'click #stop' : 'stop',
            'click .seek-offset' : 'goback',
            'click #previous-marker' : 'seekToPrevLogItem',
            'click #next-marker' : 'seekToNextLogItem'
        },
        seekToPrevLogItem: function(evt){
            var media = this.options.media;
            var curTimestamp = media.offsetToTimestamp(media.cachedState.offsetMillis);
            var closestLogItem = this.options.logItems.at(0);
            this.options.logItems.each(function(logItem){
                if(logItem.get('_timestamp') < curTimestamp){
                    if(logItem.get('_timestamp') > closestLogItem.get('_timestamp')){
                        closestLogItem = logItem;
                    }
                }
            });
            console.log("closestLogItem:", closestLogItem);
            media.seekTo(media.timestampToOffset(closestLogItem.get('_timestamp')));
        },
        seekToNextLogItem: function(evt){
            var media = this.options.media;
            var curTimestamp = media.offsetToTimestamp(media.cachedState.offsetMillis);
            var closestLogItem = this.options.logItems.at(this.options.logItems.length - 1);
            this.options.logItems.each(function(logItem){
                if(logItem.get('_timestamp') > curTimestamp){
                    if(logItem.get('_timestamp') < closestLogItem.get('_timestamp')){
                        closestLogItem = logItem;
                    }
                }
            });
            console.log("closestLogItem:", closestLogItem);
            media.seekTo(media.timestampToOffset(closestLogItem.get('_timestamp')));
        },
        goback: function(evt){
            var $button = $(evt.target).closest(".seek-offset");
            var offsetSeconds = $button.data('offset');
            var media = this.options.media;
            var positionSeconds = media.cachedState.offsetMillis / 1000;
            var newTime = Math.max(0, positionSeconds + parseInt(offsetSeconds, 10));
            console.log("goback time:", newTime, offsetSeconds);
            if(_.isNaN(newTime)) return;
            media.seekTo(newTime * 1000);
            return this;
        },
        play: function(evt){
            console.log('play');
            this.options.media.play();
            return this;
        },
        pause: function(evt){
            console.log('pause');
            this.options.media.pause();
            return this;
        },
        stop: function(evt){
            console.log('stop');
            this.options.media.stop();
            return this;
        }
    });
    
    var FS_Timeline = function(options) {
        this.options = $.extend(this.defaults,options);
        if(this.options.media) this.options.duration = this.options.media.getDuration();
        console.log(this.options);
        this.create();
        
        this.interval_timer = null;
        $(this.options.media).on('play',{that:this},FS_Timeline.track);
        $(this.options.media).on('pause',{that:this},FS_Timeline.untrack);
        
        var that = this;
        // setup dragable timeline
        this.$timeline.on('mousedown touchstart', function (event) {
            if(event.type=="touchstart") {
            	event.preventDefault();
            	event = event.originalEvent.touches[0];
            }
            var orgX = event.pageX;
            var orgMS = that.getOffset().ms;
            var px_to_ms = that.options.grid.sm_tic_ms/(parseInt(that.$timeline.css('font-size'))*that.options.grid.em);
            $(window).on('mousemove touchmove', function (event) {
                if(event.type=="touchmove") {
                	event.preventDefault();
                	event = event.originalEvent.touches[0];
                }
                var delta_px = orgX-event.pageX;
                that.seekTo(delta_px*px_to_ms+orgMS);
                // console.log(delta_px,orgMS);
            });
            $(window).on('mouseup touchend', function (event) {
                if(event.type=="touchend") {
                	event.preventDefault();
                	console.log(event);
                	event = event.originalEvent.changedTouches[0];
                }
                var delta_px = orgX-event.pageX;
                //console.log(delta_px,px_to_ms,delta_px*px_to_ms+orgMS);
                that.options.media.seekTo(delta_px*px_to_ms+orgMS); 
                $(window).off('mousemove mouseup touchmove touchend');
            });
        });
        
        this.$active.parent().on('click touchstart', function (event) {
            if(event.type=="touchstart") {
                event.preventDefault();
                var touch = event.originalEvent.touches[0];
                event.offsetX = touch.pageX-parseInt($(touch.target).offset().left);
                console.log('touch',touch.pageX,$(touch.target).offset());
            }
            var px_to_ms = that.options.duration/parseInt(that.$active.parent().css('width'));
            var offset = event.offsetX;
            //console.log(offset,event.srcElement);
            if(!$(event.srcElement).hasClass('timeline-overview')){
                console.log(event.offsetX,$(that).children('.timeline-active').css('left'));
                
                offset = event.offsetX + parseInt(that.$active.css('left')) - parseInt(that.$active.css('width'))/2;
            }			
            console.log(that.$active.parent().css('width'),px_to_ms,that.options.duration,offset,offset*px_to_ms/1000);
            that.seekTo(offset*px_to_ms);
            that.options.media.seekTo(offset*px_to_ms);
        });
        
        this.options.media.on('tick', function() {
            that.seekTo(that.options.media.cachedState.offsetMillis);
        });
    }

    FS_Timeline.prototype = {
        defaults: {
        el:null,
        session:null,
        duration:60000, // in ms
        grid: {
            sm_tic_px: 50,
            sm_tic_ms: 5000,
            lg_tic_ms: 20000,
            em:5
        },
        delta_t:200, //ms
        },
    
        create : function() {
            this.$el = (this.options.el)?(this.options.el):$('<div class="timeline-holder">');
            this.$el.append($('<div class="timeline-overview"><div class="timeline-active"><div></div></div></div>\
        <div class="timeline-window"><div class="timeline"><div class="time-marks"></div></div><div class="current-time-maker"></div></div>\
        </div>'));
            this.$view_box = this.$el.find('.timeline-window');
            this.$active = this.$el.find('.timeline-active');
            this.$timeline = this.$el.find('.timeline');
            
            this.$timeline.children('.time-marks').append(this.createTimeMarks());
            this.$timeline.css('font-size',this.options.grid.sm_tic_px/this.options.grid.em+"px");
            this.$timeline.css('width',this.options.duration/this.options.grid.sm_tic_ms*this.options.grid.em+"em");
            this.$timeline.append(this.createLogMarks());
            //add elements into view box
            this.setActiveWidth();
        },
        
        createTimeMarks : function() {
            var n_marks = this.options.duration/this.options.grid.sm_tic_ms;
            //console.log(n_marks);
            var grids = [], times = [];
            for(var i=0; i<n_marks; i++) {
                grids.push($('<div class="grid" style="left:'+this.options.grid.em*i+'em"></div>'));
                times.push($('<div class="time-mark" style="left:'+(this.options.grid.em*i+.5)+'em">'+(this.options.grid.em*i)%60+'</div>'));
            }
            return $('<div></div>').append(grids,times);
        },
        
        createLogMarks : function() {
             if(!this.options.session) return;
             var logMarks = [];
             var that = this;
             var ms_to_em = this.options.grid.em/this.options.grid.sm_tic_ms;
             this.options.session.Log.each(function(item) {
                 var log_ms = that.options.media.timestampToOffset(item.get('_timestamp'));
                 logMarks.push($('<div class="log-mark" style="left:'+log_ms*ms_to_em+'em"><div class="top"></div><div class="bottom"></div></div>'));
             });
             return logMarks;
        },
        
        setActiveWidth : function() {
            var px_per_tic = parseInt(this.$timeline.css('font-size'))*this.options.grid.em;
            var view_ms = parseInt(this.$view_box.css('width'))*this.options.grid.sm_tic_ms/px_per_tic;
            this.$active.css('font-size',view_ms*parseInt(this.$view_box.css('width'))/this.options.duration+'px')
            console.log(this.options.duration,this.$view_box.css('width'),this.$active.css('font-size'));
        },
        
        
        /*
         * 
         */
        seekDelta : function(delta_x,units) {
            var cur_ms = this.getOffset().ms;
            delta_x = FS_Timeline.toMS(delta_x,units);
            var px_to_ms = (units=='px')?this.options.grid.sm_tic_ms/(parseInt(this.$timeline.css('font-size'))*this.options.grid.em):1;
            this.seekTo(cur_ms+px_to_ms*delta_x);
        },
        
        seekTo : function(delta_t,conversion_str) {
    
            var ms_2_em = this.options.grid.em/this.options.grid.sm_tic_ms;
            var ms_2_px = parseInt(this.$active.parent().css('width'))/this.options.duration;
            if (typeof delta_t == 'string') { //assume precentage if string
                delta_t = parseInt(delta_t,10);
                if (delta_t < 0) delta_t=0;
                if (delta_t > 100) delta_t=100;
                this.$timeline.css('left',ms_2_em*this.options.duration*-delta_t/100+'em');
                this.$active.css('left',ms_2_px*this.options.duration*delta_t/100);
            }
            else { // assume ms
                delta_t = FS_Timeline.toMS(delta_t,conversion_str);
                if(delta_t < 0) delta_t=0;
                if(delta_t > this.options.duration) delta_t=this.options.duration;
                this.$timeline.css('left',ms_2_em*-delta_t+'em');
                this.$active.css('left',ms_2_px*delta_t);
            }
        },
        
        getOffset : function() {
            var left_px = parseFloat(this.$timeline.css('left'));
            var px_to_ms = this.options.grid.sm_tic_ms/(parseInt(this.$timeline.css('font-size'))*this.options.grid.em);
            var ms = -left_px*px_to_ms;
            var percent = ms/this.options.duration;
            return {ms:ms,perecent:percent}
        }
    }

    /*
     *  Returns tm converted to milliseconds
     *    units in ['min','sec','hr']
     */
        FS_Timeline.toMS = function(tm,unit) {
        if (typeof unit != "number") {
            unit = ({sec:1000,min:60000,hr:3600000,s:1000,m:60000,h:3600000})[unit]
        }
        unit = (unit)?unit:1; // default to ms
        return tm*unit;
    }
    
    FS_Timeline.track = function (event) {
        var that = event.data.that;
        that.interval_timer = window.setInterval(function(){
            that.seekTo(that.options.media.currentTime,'sec');
            // console.log(that.options.media.currentTime);
        },that.options.delta_t);
    }
    
    FS_Timeline.untrack = function (event) {
        window.clearInterval(event.data.that.interval_timer);
    }
        
    var create = function(context){
        //TODO: Add parameter for creating a small player for the explorer.
        var startOffset = context.start || 0;
        var session = context.session;
        if(!session) {
            alert("No session id. Debug mode.");
            session = new Backbone.Model({
                startTime: new Date(0),
                endTime: 60000
            });
        }
        var logItems = session.Log;
        
        createClipPlayer(session.get('_clips'), function(media){
            if(!(media.getDuration() > 0)){
                alert("Could not get media duration, be sure it is loaded before passing it to player.create()");
            }
            if(media.getDuration() === Infinity) {
                alert("Media is infinately long?");
            }
            
            console.log("Start time: " + startOffset);
            media.seekTo(startOffset);
            

            
            $(context.el).html(playerLayout);
            
            var $timeline = $('#timeline');
           /*
           var $progress = $('<div class="progress">');
            var $bar = $('<div class="bar">');
            $progress.append($bar);
            $timeline.append($progress);
            $progress.click(function(evt){
                console.log('seek');
                if(window.chrome) console.log(evt);
                var $seeker = $(evt.currentTarget);
                //Problem: firefox doesn't have offsetX
                var progressPercentage = (evt.offsetX / $seeker.width());
                media.seekTo(progressPercentage * media.getDuration());
                return this;
            });
             
            var updateTimeline = function(){
                var progressPercent = media.cachedState.progressPercent;
                $bar.css('width', Math.floor(Math.min(progressPercent * 100, 100)) + "%");
            };
           */
            var selectedLogItem = null;
            var updateMarkers = function(){
                console.log("updateMarkers");
                var $markers = $('#logItemContainer');
                var $info = $('#logItemInfo');
                $markers.empty();
                //Track current log item in url for navigation?
                logItems.each(function(logItem){
                    var millisOffset = media.timestampToOffset(logItem.get('_timestamp'));
                    var logItemProgress = millisOffset / media.getDuration();
                    var $marker = $('<div class="logItemMarker">');
                    $marker.css("left", logItemProgress * 100 + '%');
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
                            media.seekTo(millisOffset);
                        });
                    }
                });
            };
            
            var controls = new ControlsView({
                media: media,
                logItems: logItems,
                el: $('#controls').get(0)
            });
            
            var timeline = new FS_Timeline({el:$('#timeline'),media:media,session:session})
            
            //updateMarkers();

            var wasPlaying;

            media.on('tick' ,function(){
               //updateTimeline();
                if(media.cachedState.playing !== wasPlaying){
                    controls.render();
                }
                wasPlaying = media.cachedState.playing;
            });
            media.trigger('tick');
            
            //It might be a good idea to lazy load the tag layers.
            session.fetchTagLayers({
                dirPath: config.appDir,
                success: function() {
                    console.log("Tag Layers:", session.tagLayers);
                }
            });
            
        });

        return this;
	};
    
	return {
        create: create
    };
    
});

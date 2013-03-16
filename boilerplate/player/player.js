define(['config', 'backbone', 'underscore','player/timeline', 'text!player/playerLayout.html', 'text!player/logItemTemplate.html', 'text!player/controlsTemplate.html', 'Popcorn'],
function(config,   Backbone,   _,FS_PlayerView,          playerLayout,                    logItemTemplate, controlsTemplate){

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
        "http://archive.org/download/KA-converted-c_8QQbVQKU0/c_8QQbVQKU0.mp4"];
        
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
                    myAudio.currentTime(millis/1000);
                    //myAudio.currentTime = Math.floor(millis / 1000);
                },
                release: function(){
                    //Do nothing?
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
        //TODO: Download media into temporairy fs if not present?
        //Maybe it is better to just sync everything up front for now.
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
     * [{start: timestamp, end: timestamp, path: pathToClipMediaFile}]
     **/
    var createClipPlayer = function(clips, callback) {
        //Clips must be sorted
        //TODO: Separate paused state from playing...
        var clipLoaded = _.after(clips.length, function(){
            var tickInterval = 200;
            var currentClip = clips[0];
            var clipSequencePlayer = _.extend({
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
                    console.log(audioDuration, timestampDuration);
                    
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
                                currentClip.media.onStop = function(){};
                                currentClip.media.stop();
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
                    return offset; // return the total length of clips if timestamp out of range
                },
                release: function(){
                    console.log("releasing...");
                    clearInterval(this.ticker);
                    var clipIdx = 0;
                    while(clipIdx < clips.length){
                        clips[clipIdx].media.onStop = function(){};
                        clips[clipIdx].media.stop();
                        clips[clipIdx].media.release();
                        clipIdx++;
                    }
                    console.log("released");
                }
            }, Backbone.Events);
            
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
        var clipSequencePlayer;
        createClipPlayer(session.get('_clips'), function(newClipSequencePlayer){
            clipSequencePlayer = newClipSequencePlayer;
            if(!(clipSequencePlayer.getDuration() > 0)){
                alert("Could not get media duration, be sure it is loaded before passing it to player.create()");
            }
            if(clipSequencePlayer.getDuration() === Infinity) {
                alert("Media is infinately long?");
            }
            
            console.log("Start time: " + startOffset);
            clipSequencePlayer.seekTo(startOffset);
            
            //It might be a good idea to lazy load the tag layers.
            session.fetchTagLayers({
                dirPath: config.appDir,
                success: function() {
                    console.log("Tag Layers:", session.tagLayers);
                    timeline = new FS_PlayerView({el:$('.player'),media:clipSequencePlayer,session:session})
                }
            });
            
        });
        
        Backbone.history.once("route", function(){
            //TODO: Undelegate events on views
            clipSequencePlayer.release();
        });
        
        return this;
    };
    
	return {
        create: create
    };
    
});
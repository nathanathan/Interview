define([ 'underscore', 'backbone', 'player/player', 'text!explorer/explorerTemplate.html', 'text!explorer/clipTemplate.html', 'Popcorn'],
function( _,            Backbone,   player,          explorerTemplate,                      clipTemplate ) {
    
    var compiledExplorerTemplate = _.template(explorerTemplate);
    var compiledClipTemplate = _.template(clipTemplate);
    
    var getMediaPhonegap = function(path, callback) {
        var media = new Media(path,
        function(){},
        function(err){
            console.error("Media error:");
            console.error(err);
        });
        media.seekTo(0);
        var attempts = 10;
        function waitForDuration(){
            if(attempts === 0) {
                alert("Could not get media duration");
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
    
    var getMediaDebug = function(path, callback) {
        var $audioContainer = $('<div style="height:400px" id="dbgAudioContainer">');
        $('body').append($audioContainer);
        /*
        var myAudio = Popcorn.youtube($audioContainer.get(0), 'http://www.youtube.com/watch?v=oozJH6jSr2U&width=0&height=0' );
        */
        
        var myAudio = Popcorn.smart(
         "#dbgAudioContainer",
         'http://cuepoint.org/dartmoor.mp4');
         
        window.audioDbg = myAudio;
        myAudio.on("loadedmetadata", function() {
            myAudio.off("loadedmetadata");
            callback({
                play: function(){
                    myAudio.play();
                },
                pause: function(){
                    myAudio.pause();
                },
                stop: function(){
                    myAudio.stop();
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
            });
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
    
    
    var ExplorerView = Backbone.View.extend({
        
        template: compiledExplorerTemplate,

        orderVar: 1,
        
        filter: function(){ return true; },

        sortIterator: function() {
            return 0;
        },

        initialize: function(options){
            var that = this;

            options.model.on("change", function(){
                console.log("page change");
                var page = that.model.get("page");
                var matcher = new RegExp(page);
                that.filter = function(logItem){
                    return matcher.test(logItem.get("page"));
                };
                console.log("sort change");
                var sortBy = that.model.get("sortBy");
                that.sortIterator = function(logItem){
                    return logItem.get(sortBy);
                };
                that.render();
            });
        },

        render: function() {
            this.$el.html(this.template({ data: this.model.toJSON() }));
            this.renderResults();
        },
        
        renderResults: function() {
            var that = this;
            var resultsList = this.$('#result-list');
            var sessions = this.options.sessions;
            _.chain(sessions.collectLogItems().models).tap(function(x){ console.log(x) })
            .filter(that.filter)
            .sortBy(that.sortIterator)
            .each(function(logItem){
                var $logItemDom;
                console.log(logItem);
                try {
                    $logItemDom = $(compiledClipTemplate({data: logItem.toJSON()}));
                } catch(e) {
                    console.log(logItem.toJSON());
                    alert("clipTemplate error");
                    return;
                }
                resultsList.append($logItemDom);
                $logItemDom.find('.play-btn').click(function(e){
                    if(window.chrome) console.log(e);
                    console.log('playClip');
                    console.log(logItem);
                    var $clipPlayArea = $(e.target).closest('.play-area');
                    
                    var $playerContainer = $('<div id="player-container">');
                    $clipPlayArea.empty();
                    $clipPlayArea.append($playerContainer);
                    var session = sessions.get(logItem.get('_sessionId'));
                    if(!session) {
                        alert("Could not get session");
                        console.error(logItem.get('_sessionId'));
                        return;
                    }

                    console.log("recordingPath: " + session.get('_recordingPath'));

                    getMedia(session.get('_recordingPath'), function(media){
                        console.log("Got media.");
                        var timestamp = logItem.get('_timestamp');
                        var recordingStart = logItem.get('_recordingStart');
                        
                        if(!_.isDate(timestamp)) {
                            console.error("String dates in model");
                            timestamp = new Date(timestamp);
                            recordingStart = new Date(recordingStart);
                        }
                        
                        player.create({
                            containerEl: $playerContainer.get(0),
                            media: media,
                            //TODO: Do a fetch here?
                            //This is just for playing the clip though.
                            //Maybe not needed.
                            logItems: new Backbone.Collection(),
                            //Where to store the recording's start time?
                            start: (timestamp - recordingStart),
                            session: session
                        });
                    });
                });
            });
        }
        
    });
	return ExplorerView;
});
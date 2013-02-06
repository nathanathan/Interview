define([
    'backbone',
    'underscore',
    'player/player',
    'Sessions',
    'text!explorer/clipTemplate.html',
    'text!explorer/resultsTemplate.html'
],
function(Backbone, _, player, Sessions,  clipTemplate, resultsTemplate){
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
    }
    
    var getMediaDebug = function(path, callback) {
        var $audioContainer = $('<div>');
        $('body').append($audioContainer);
        var myAudio = Popcorn.youtube($audioContainer.get(0), 'http://www.youtube.com/watch?v=HgzGwKwLmgM&width=0&height=0' );
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
                    
/*
    function getMediaAudioEl(callback) {
        var myAudio = new Audio();
        myAudio.src = 'http://www.html5rocks.com/en/tutorials/audio/quick/test.ogg';
        myAudio.addEventListener("loadedmetadata", function(evt) {
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
                    mediaSuccess(myAudio.currentTime);
                },
                getDuration: function(){
                    //return myAudio.duration;
                    return myAudio.duration;
                },
                seekTo: function(timeSeconds){
                    //myAudio.currentTime = timeSeconds;
                    myAudio.currentTime = timeSeconds;
                }
            });
        });
    }
*/
    
    var ListView = Backbone.View.extend({
        orderVar: 1,
        render: function() {
            console.log('render');
            var that = this;
            this.$el.html(resultsTemplate);
            var resultsList = this.$('#result-list');
            this.collection.each(function(logItem){
                var $logItemDom;
                try {
                    $logItemDom = $(compiledClipTemplate({data: logItem.toJSON()}));
                } catch(e) {
                    alert("clipTemplate error");
                }
                resultsList.append($logItemDom);
                $logItemDom.find('.play-btn').click(function(e){
                    if(window.chrome) console.log(e);
                    console.log('playClip');
                    console.log(logItem);
                    var $clipPlayArea = $(e.target).closest('.play-area');
                    //TODO: Not sure if this will work
                    //$mediaContainer.css("display", "none");
                    var $playerContainer = $('<div id="player-container">');
                    $clipPlayArea.empty();
                    $clipPlayArea.append($playerContainer);
                    var session = that.options.allSessions.get(logItem.get('_sessionId'));
                    if(!session) {
                        alert("Could not get session");
                        console.error(logItem.get('_sessionId'));
                    }
                    //Getting the session will also make it easier to get rid
                    //of the _recordingStart param.
                    var recordingPath = 'interviews/' +
                        logItem.get('_sessionId') +".amr";
                    console.log("recordingPath: " + recordingPath);

                    getMedia(recordingPath, function(media){
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
        },
        events: {
            'click .sort' : 'sort'
        },
        genComparator : function(cfunc, incr) {
            if(!incr) {
                incr = 1;
            }
            return function(Ain, Bin) {
                var A = cfunc(Ain);
                var B = cfunc(Bin);
                if(A < B) return -incr;
                if(A > B) return incr;
                if(A == B) return 0;
            };
        },
        sort: function(e) {
            console.log('sort');
            console.log(e);
            var sortParam = this.$('#sortParam');
            this.orderVar = -this.orderVar;
            this.collection.comparator = this.genComparator(function(entry) {
                return entry.get(sortParam);
            }, this.orderVar);
            this.collection.sort();
            this.render();
            return this;
        }
    });
	return ListView;
});

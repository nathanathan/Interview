define([
    'backbone',
    'underscore',
    'player/player',
    'Sessions',
    'text!explorer/clipTemplate.html',
    'text!explorer/resultsTemplate.html'
],
function(Backbone, _, player, Sessions,  clipTemplate, resultsTemplate){
    var ListView = Backbone.View.extend({
        orderVar: 1,
        render: function() {
            //TODO: Watch out for async
            var mySessions = new Sessions();
            mySessions.fetch();
            console.log('render');
            var that = this;
            this.$el.html(resultsTemplate);
            var resultsList = this.$('#result-list');
            this.collection.each(function(logItem){
                var $logItemDom = $(_.template(clipTemplate)({
                    logItem : logItem.toJSON(),
                    duration : 10 //Set this in the log stage?
                }));
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
                    var session = mySessions.get(logItem.get('_sessionId'));
                    if(!session) {
                        alert("Could not get session");
                        console.error(logItem.get('_sessionId'));
                    }
                    //Getting the session will also make it easier to get rid
                    //of the _recordingStart param.
                    var recordingPath = 'interviews/' +
                        session.get('interviewTitle') + '/'+
                        logItem.get('_sessionId') +".amr";
                    console.log("recordingPath: " + recordingPath);
                    
                    function getMediaCordova(callback){
                        var getMedia = function(path, callback) {
                            var media = new Media(path,
                            function(){},
                            function(err){
                                alert("error");
                                console.log(err);
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
                        getMedia(recordingPath, callback);
                    }
                    function getMediaPopcorn(callback) {
                        var $mediaContainer = $('<div id="media-container">');
                        $clipPlayArea.append($mediaContainer);
                        var myAudio = Popcorn.youtube($mediaContainer.get(0), 'http://www.youtube.com/watch?v=HgzGwKwLmgM&width=0&height=0');
                        console.log('loading popcorn content...');
                        myAudio.on("loadedmetadata", function(evt) {
                            console.log('loadedmetadata');
                            myAudio.off("loadedmetadata");
                            //We need to load metadata first so duration related computations work.
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
                                seekTo: function(timeSeconds){
                                    //myAudio.currentTime = timeSeconds;
                                    myAudio.currentTime(timeSeconds);
                                }
                            });
                        });
                    }
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
                    var getMedia;
                    if ('cordova' in window) {
                        getMedia = getMediaCordova;
                    } else {
                        getMedia = getMediaAudioEl;
                    }
                    getMedia(function(media){
                        console.log("Got media.");
                        player.create({
                            containerEl: $playerContainer.get(0),
                            media: media,
                            //TODO: Do a fetch here?
                            //This is just for playing the clip though.
                            //Maybe not needed.
                            logItems: new Backbone.Collection(),
                            //Where to store the recording's start time?
                            start: (logItem.get('_timestamp') - logItem.get('_recordingStart')) / 1000
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

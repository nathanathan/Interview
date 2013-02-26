define([ 'underscore', 'backbone', 'player/player', 'text!explorer/explorerTemplate.html', 'text!explorer/clipTemplate.html', 'Popcorn'],
function( _,            Backbone,   player,          explorerTemplate,                      clipTemplate ) {
    
    var compiledExplorerTemplate = _.template(explorerTemplate);
    var compiledClipTemplate = _.template(clipTemplate);
    
    var ExplorerView = Backbone.View.extend({
        
        template: compiledExplorerTemplate,

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

                    var timestamp = logItem.get('_timestamp');
                    var recordingStart = logItem.get('_recordingStart');
                    
                    if(!_.isDate(timestamp)) {
                        console.error("String dates in model");
                        timestamp = new Date(timestamp);
                        recordingStart = new Date(recordingStart);
                    }
                    
                    player.create({
                        el: $playerContainer.get(0),
                        //Where to store the recording's start time?
                        start: (timestamp - recordingStart),
                        session: session
                    });

                });
            });
        }
        
    });
	return ExplorerView;
});
define(['config', 'backbone', 'underscore','text!player/playerLayout.html'],
function(config,   Backbone,  _, playerLayout){

 
   /*
    *  View for player container
    */
    var FS_PlayerView = Backbone.View.extend({ 
        //default optionis
        id: 'player',
        tagName: 'div',
        options: {
            session:null,
            duration:60000, //in ms
        },
     
               
        initialize: function() {
            this.$el.html(playerLayout); // insert template
             
            if(this.options.media) this.options.duration = this.options.media.getDuration();
            
            // add controls and events
            this.controls = new FS_ControlsView({el:this.$el.find('#controls')});
            this.controls.on('play', this.play,this);
            this.controls.on('pause', this.pause,this);
            this.controls.on('seek-offset', function(event) {
                 var offset = $(event.target).closest(".seek-offset").data('offset');
                 this.seekDelta(offset,true,'sec');
            },this);
            this.controls.on('zoom', function(event) {
                 var zoom = $(event.target).closest(".zoom").data('zoom');
                 this.timeline.zoom(zoom);
            },this)
            this.controls.on('prevLogItem', function(event){
                console.log(this.timeline.getLogItem(-1));
                this.seekTo(this.timeline.getLogItem(-1).offset,true);
            },this);
            this.controls.on('nextLogItem', function(event){
                console.log(this.timeline.getLogItem(1));
                this.seekTo(this.timeline.getLogItem(1).offset,true);
            },this);
            
            //Create Overview and Timeline Views
            var log = this.getLog();
            this.overview = new FS_OverviewView({el:this.$el.find('.timeline-overview'),duration:this.options.duration,log:log});
            this.timeline = new FS_TimelineView({el:this.$el.find('.timeline-window'),duration:this.options.duration,log:log});
            this.timeline.addTagLayer(this.getTagLayer());
            this.setQuestion(log[0].page)
            
            // set callbacks
            this.timeline.on('dragStart',function(event){console.log('Remove');this.options.media.off('tick',null,this)},this); //remove seek on tick during drag
            this.timeline.on('drag',function(event){this.seekTo(event.ms)},this);
            this.timeline.on('dragDone',function(event){
                this.options.media.seekTo(event.ms)
                this.options.media.on('tick', function _mediaSeek() { //put seek back on tick
                    this.seekTo(this.options.media.cachedState.offsetMillis);
                },this);                
            },this);
            this.timeline.on('log-change',function(event){
                this.setQuestion(event.log.page);
            },this);
            
            this.overview.on('seekTo', function(event){
                 if(event.type=="touchstart") {
                    event.preventDefault();
                    var touch = event.originalEvent.touches[0];
                    event.offsetX = touch.pageX-parseInt($(touch.target).offset().left);
                    console.log('touch',touch.pageX,$(touch.target).offset());
                }
                var px_to_ms = this.options.duration/parseInt(this.overview.$el.css('width'));
                var offset = event.offsetX;
                if($(event.srcElement).hasClass('timeline-overview')==false){
                    offset += parseInt($(event.srcElement,10).css('left'))+5;
                }    
                this.seekTo(offset*px_to_ms,true);
            },this);
            
            // put seek on tick
            this.options.media.on('tick', function _mediaSeek() {
                this.seekTo(this.options.media.cachedState.offsetMillis);
            },this);
        },
        
        getLog: function() {
            var log = [];
            var that = this, count=0;
             this.options.session.Log.each( function(item) {
                    var offset = that.options.media.timestampToOffset(item.get('_timestamp')); 
                    log.push({
                        page:item.get('page'),
                        offset:offset,
                        duration:that.options.media.timestampToOffset(item.get('_endTimestamp'))-offset,
                        index:count,
                    }); 
                    count+=1;
              });
              log[0].offset = 0;
            return log;
        },
        
        getTagLayer: function(layer) {
            var that=this;
            layer = (layer)?layer:'base';
            var tags = this.options.session.tagLayers[layer].toJSON();
            console.log(tags);
            _.each(tags,function(tag){
               tag.offset = that.options.media.timestampToOffset(tag._timestamp); 
            });
            return {layer:layer,tags:tags};
        },
        
        seekDelta: function(delta_ms,media,conversion_str) {
            var cur_ms = this.timeline.getOffset().ms;
            delta_ms = toMS(delta_ms,conversion_str);
            this.seekTo(cur_ms+delta_ms,media);
            return this;
        },
        
        // seek timeline to ms (no error detection)
        seekTo: function(ms,media,conversion_str) {
            ms = toMS(ms,conversion_str);
            if(ms < 0) ms=0;
            if(ms > this.options.duration) ms=this.options.duration;
            this.timeline.seekTo(ms);
            this.overview.seekTo(ms);
            if(media==true)
                this.options.media.seekTo(ms);
            return this;
        },
    
        play: function(evt){
            console.log('play');
            this.options.media.play();
            this.controls.$el.find('#play').hide();
            this.controls.$el.find('#pause').show();
            return this;
        },
        pause: function(evt){
            console.log('pause');
            this.options.media.pause();
            this.controls.$el.find('#play').show();
            this.controls.$el.find('#pause').hide();
            return this;
        },
        
        setQuestion: function(page) {
           var curQuestion = _.find(jsonInterviewDef.annotatedFlatInterview,function(question){return question.name == page})
           this.$el.find('.log-item').html(curQuestion.label);  
       },
        
    });
    
    
    /*
    *  View for small overview bar
    */
    var FS_OverviewView = Backbone.View.extend({
        className: 'timeline-overview',
        tagName: 'div',
        
        options: {
            duration:60000, //default 1min
            log:null,
        }, 
        
        events: {
            'click *': function(event) {this.trigger('seekTo',event)},  
            'touchstart *': function(event) {this.trigger('seekTo',event)},  
        },
        
        initialize: function() {
             _.extend(this,Backbone.Events); // make the ControlsView a backbone events to enable triggering
            this.$el.append(this.createTimeMarks());
            this.$el.append(this.createLogMarks());
        },
        //create the time marks for the overview.
        createTimeMarks : function() {
            var n_marks = this.options.duration/60000;
            var min_to_precent = 6000000/this.options.duration; 
            var grids = [];
            for (var i=0; i<n_marks; i++){
                grids.push($('<div class="time-mark" style="left:'+min_to_precent*i+'%">'+'</div>'));
            }
            return grids;
        },
         createLogMarks : function() {
            var logMarks = [];
            var ms_to_precent = 100/this.options.duration; 
            for(var i=0; i<this.options.log.length; i++) {
                var log = this.options.log[i];
                var style = (i%2===0)?'even':'odd';
                //console.log(log);
                logMarks.push($('<div class="log-mark '+style +'" style="left:'+log.offset*ms_to_precent+'%;width:'+log.duration*ms_to_precent+'%">'+log.page+'</div>'));
             }
             return logMarks;
        },
        seekTo: function(delta_ms){
            this.$el.children('.current-time').css('left',100*delta_ms/this.options.duration+"%");
        },
        
    });
    
    
    /*
    *  View for main timeline
    */
    var FS_TimelineView = Backbone.View.extend({
        className: 'timeline-window',
        tagName: 'div',
        
        options : {
            sm_tic_px: 50, // initial px for small tic
            sm_tic_ms: 5000, // number of ms in small tic.  Should divide 60000 (1min)
            duration:60000, // default 1min
            log:null,
            currentLog:null,
        },
        
        events : {
            'mousedown .timeline-drag': function(event) {this.trigger('dragStart',event)},
            'touchstart .timeline-drag': function(event) {this.trigger('dragStart',event)},
        },
        
        initialize: function() {
            console.log('Timeline Initialized');
            _.extend(this,Backbone.Events); // make the ControlsView a backbone events to enable triggering
            this.options.currentLog = this.options.log[0];
            
            
            this.$timeline = this.$el.find('.timeline');
            this.time_display = {
                $start:this.$el.parent().find('#start-time').html(_.formatTime(0)),
                $end:this.$el.parent().find('#end-time').html(_.formatTime(this.options.duration))
             }
             
            this.$timeline.children('.time-marks').append(this.createTimeMarks());
            this.$timeline.children('.log-marks').append(this.createLogMarks());
            
            this.$timeline.css('font-size',this.options.sm_tic_px+"px");
            this.$timeline.css('width',this.options.duration/this.options.sm_tic_ms+"em");
            this.on('dragStart',this.drag_start,this);
        },
        
        createTimeMarks : function() {
            var n_marks = this.options.duration/this.options.sm_tic_ms;
            //console.log(n_marks);
            var grids = [];
            for(var i=0; i<n_marks; i++) {
                var grid_mark = $('<div class="grid" style="left:'+i+'em"></div>'); //set grid left to grid.em * i
                grid_mark.append($('<div class="time-mark">'+(this.options.sm_tic_ms*i/1000)%60+'</div>')); //add in the seconds 
                if((this.options.sm_tic_ms*i/1000)%60===0) { // if on a miniute division.
                    grid_mark.addClass('large');
                    grid_mark.children().html((this.options.sm_tic_ms*i/1000)/60);
                }
                grids.push(grid_mark);
            }
            return grids;
        },
        
         createLogMarks : function() {
            var logMarks = [];
            for(var i=0; i<this.options.log.length; i++) {
                var log = this.options.log[i];
                var style = (i%2===0)?'even':'odd';
               // console.log(log);
                logMarks.push($('<div class="log-mark '+style +'" style="left:'+log.offset/this.options.sm_tic_ms+'em;width:'+log.duration/this.options.sm_tic_ms+'em"><span>'+log.page+'</span></div>'));
             }
             return logMarks;
        },
        
        addTagLayer: function(tagLayer) {
            var $layer = $('<div id="'+tagLayer.layer+'"></div>');
            var that = this;
            _.each(tagLayer.tags,function(tag){
                var $tag = $('<i></i>');
                $tag.addClass('icon-'+tag.icon);
                $tag.css('color',tag.iconColor);
                $layer.append( $('<div class="tag"></div>').css('left',tag.offset/that.options.sm_tic_ms+'em').append($tag));
            });
            this.$timeline.find('.tags').append($layer);
            return this;
        },
        
        // seek timeline to ms (no error detection)
        seekTo: function(ms){
            var time_window = 100; 
           this.$timeline.css('left',-ms/this.options.sm_tic_ms+'em');
            this.time_display.$start.html(_.formatTime(ms));
            if(ms < this.options.currentLog.offset + time_window || this.options.currentLog.offset+this.options.currentLog.duration - time_window < ms){ //time not in current log
                this.options.currentLog = this.getLogFromOffset(ms);
                this.trigger('log-change',{log:this.options.currentLog});
            }
        },
        
        drag_start: function(event) {
             if(event.type=="touchstart") {
                event.preventDefault();
                event = event.originalEvent.touches[0];
            }
            var orgX = event.pageX;
            var orgMS = this.getOffset().ms;
            var px_to_ms = this.options.sm_tic_ms/parseInt(this.$timeline.css('font-size'),10);
            var that = this;
            $(window).on('mousemove touchmove', function (event) {
                if(event.type=="touchmove") {
                    event.preventDefault();
                	event = event.originalEvent.touches[0];
                }
                var delta_px = orgX-event.pageX;
                that.trigger('drag',{ms:delta_px*px_to_ms+orgMS})
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
                //that.options.media.seekTo(delta_px*px_to_ms+orgMS); 
                that.trigger('dragDone',{ms:delta_px*px_to_ms+orgMS})
                $(window).off('mousemove mouseup touchmove touchend');
            });  
        },
        
        zoom: function(direction,ratio) {
            var curFontSize = parseInt(this.$timeline.css('font-size'),10);
            ratio = (ratio)?ratio:.2;
            newFontSize = curFontSize+Math.ceil(curFontSize*ratio*direction/Math.abs(direction));
            if(newFontSize <= 15) this.$timeline.find('.grid').not('.large').hide();
            else this.$timeline.find('.grid').show();
            this.$timeline.css('font-size',newFontSize+'px');
            console.log(this.$timeline.css('font-size'));
            return this;
        },
        
        //get the offset in ms and %
        getOffset : function() {
            var left_px = parseFloat(this.$timeline.css('left'),10);
            var px_to_ms = this.options.sm_tic_ms/parseInt(this.$timeline.css('font-size'),10);
            var ms = -left_px*px_to_ms;
            var percent = ms/this.options.duration;
            return {ms:Math.floor(ms),perecent:percent}
        },
    
        //get the log item that contains offset (as ms)
        getLogFromOffset: function (offset) {
            var time_window = 100; 
            var cur = this.options.log[0];
            for(var i=1;  i<this.options.log.length; i++) {
                if(cur.offset + cur.duration - time_window >= offset) 
                    break;
                cur = this.options.log[i];
            }
            return cur;
        },
        
        getLogItem: function(offset) {
           var time_window = 100;
            var curOffset = this.getOffset().ms;
            //console.log(this.options.currentLog,this.getOffset().ms,this.options.currentLog.offset+this.options.currentLog.duration);
            if( offset == null || typeof(offset) != "number" || offset == 0 || (offset < 0 && (this.options.currentLog.offset + time_window < curOffset || this.options.currentLog.index===0))) { //if offset null or not an integer
                return this.options.currentLog; 
            }
            else if(offset < 0){
                 return this.options.log[this.options.currentLog.index-1];
            }
            else if(offset > 0){
                return this.options.log[this.options.currentLog.index+1];
            }
            else {
                return this.options.currentLog;
            }
        },
            
    });
    
    
    /*
    *  View for main controls
    */
    var FS_ControlsView = Backbone.View.extend({
       id: 'controls',
       tagName: 'div',
       
      
       initialize: function () {
            console.log("Controls Initialize");
            _.extend(this,Backbone.Events); // make the ControlsView a backbone events to enable triggering
            this.$el.find('#pause').hide();
       },
       
       events: {
            'click #play' : function(event) {this.trigger('play',event)}, 
            'click #pause' : function(event) {this.trigger('pause',event)},
            'click .zoom' : function(event) {this.trigger('zoom',event)},
            'click .seek-offset' : function(event){this.trigger('seek-offset',event)},
            'click #previous-marker' : function(event){this.trigger('prevLogItem',event)},
            'click #next-marker' : function(event){this.trigger('nextLogItem',event)},
       },
       
    });
    
    var toMS = function(tm,unit) {
        if (typeof unit != "number") {
            unit = ({sec:1000,min:60000,hr:3600000,s:1000,m:60000,h:3600000})[unit]
        }
        unit = (unit)?unit:1; // default to ms
        return tm*unit;
    }

return FS_PlayerView;

}); // End Define Function






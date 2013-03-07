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
        this.$timeline.parent().on('mousedown touchstart', function (event) {
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
            this.$el.append($('<div class="time-display" id="start-time"></div><div class="time-display" id="end-time"></div><div class="timeline-overview"><div class="timeline-active"><div></div></div></div>\
        <div class="timeline-window"><div class="timeline-drag"><div class="timeline"><div class="log-marks"></div><div class="time-marks"></div></div><div class="current-time-maker"></div></div></div></div>'));
            this.$view_box = this.$el.find('.timeline-window');
            this.$active = this.$el.find('.timeline-active');
            this.$timeline = this.$el.find('.timeline');
            
            this.$timeline.children('.time-marks').append(this.createTimeMarks());
            this.$timeline.css('font-size',this.options.grid.sm_tic_px/this.options.grid.em+"px");
            this.$timeline.css('width',this.options.duration/this.options.grid.sm_tic_ms*this.options.grid.em+"em");
            this.$timeline.children('.log-marks').append(this.createLogMarks());
            this.time_display = {$start:this.$el.find('#start-time').html(_.formatTime(0)),$end:this.$el.find('#end-time').html(_.formatTime(this.options.duration))};
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
            return grids.concat(times);
        },
        
        createLogMarks : function() {
             if(!this.options.session) return;
             var logMarks = [];
             var that = this, last_offset = null, count = 0;
             var ms_to_em = this.options.grid.em/this.options.grid.sm_tic_ms;
             this.options.session.Log.each(function(item) {
                 var log_ms = that.options.media.timestampToOffset(item.get('_timestamp'));
                 if (last_offset) {
                    //logMarks.push($('<div class="log-mark" style="left:'+log_ms*ms_to_em+'em"><div class="top"></div><div class="bottom"></div></div>')); // Bars
                    var style = (count%2==0)?'even':'odd';
                    logMarks.push($('<div class="log-mark '+style +'" style="left:'+last_offset*ms_to_em+'em;width:'+(log_ms-last_offset)*ms_to_em+'em"></div>'));
                 }
                 last_offset = log_ms, count+=1;
             });
             var style = (count%2==0)?'even':'odd';
             logMarks.push($('<div class="log-mark '+style +'" style="left:'+last_offset*ms_to_em+'em;width:'+(this.options.duration-last_offset)*ms_to_em+'em"></div>'));
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
                this.time_display.$start.html(_.formatTime(this.options.duration*delta_t/100));
            }
            else { // assume ms
                delta_t = FS_Timeline.toMS(delta_t,conversion_str);
                if(delta_t < 0) delta_t=0;
                if(delta_t > this.options.duration) delta_t=this.options.duration;
                this.$timeline.css('left',ms_2_em*-delta_t+'em');
                this.$active.css('left',ms_2_px*delta_t);
                this.time_display.$start.html(_.formatTime(delta_t));
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
define(['config', 'backbone', 'underscore'],
function(config,   Backbone,   _){


var FS_Timeline = function(options) {
    this.options = $.extend(this.defaults,options);
    if(this.options.media) this.options.duration = this.options.media.getDuration();
    console.log(this.options);
    this.create();
    console.log("Json",jsonInterviewDef);
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
    
    this.$overview.on('click touchstart', function (event) {
        if(event.type=="touchstart") {
            event.preventDefault();
            var touch = event.originalEvent.touches[0];
            event.offsetX = touch.pageX-parseInt($(touch.target).offset().left);
            console.log('touch',touch.pageX,$(touch.target).offset());
        }
        var px_to_ms = that.options.duration/parseInt(that.$overview.css('width'));
        var offset = event.offsetX;
        if($(event.srcElement).hasClass('timeline-overview')==false){
            console.log(offset, parseInt($(event.srcElement,10).css('left')),event.srcElement);
            offset += parseInt($(event.srcElement,10).css('left'))+5;
        }    
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
        sm_tic_px: 50, // initial px for small tic
        sm_tic_ms: 5000, // number of ms in small tic.  Should divide 60000 (1min)
        em:5 // number of 
    },
    delta_t:200, //ms
    },

    
    create : function() {
       // Create the DOM: This could come from a template.
       this.$el = (this.options.el)?(this.options.el):$('<div class="timeline-holder">');
        this.$el.append($('<div class="time-display" id="start-time"></div><div class="time-display" id="end-time"></div><div class="timeline-overview"><div class="current-time"></div></div>\
    <div class="timeline-window"><div class="timeline-drag"><div class="timeline"><div class="log-marks"></div><div class="time-marks"></div></div><div class="current-time"></div></div></div></div>'));
        
        // Get elements from the DOM
        this.$view_box = this.$el.find('.timeline-window');
        this.$overview = this.$el.find('.timeline-overview');
        this.$timeline = this.$el.find('.timeline');
        this.time_display = {$start:this.$el.find('#start-time').html(_.formatTime(0)),$end:this.$el.find('#end-time').html(_.formatTime(this.options.duration))};
         
        // Insert Marks
        var marks = this.createLogMarks();
        this.$timeline.children('.time-marks').append(this.createTimeMarks());
        this.$timeline.children('.log-marks').append(marks.timemarks);
        this.$timeline.append(this.createTagMarks([{icon:'star',color:'red',timestamp:1000},{icon:'star',color:'blue',timestamp:5000}]));
        this.$overview.append(marks.overviewMarks);
        this.$overview.append(this.createOverviewTimes());
        
        //Set CSS
        this.$timeline.css('font-size',this.options.grid.sm_tic_px/this.options.grid.em+"px");
        this.$timeline.css('width',this.options.duration/this.options.grid.sm_tic_ms*this.options.grid.em+"em");
        
        //Get Page Titles
        that = this;
      // $.getJSON(sfsf.joinPaths('interview_app/interview_data/','example', 'interview.json'),function(json){that.interview = json});
        console.log(this.interview);
    },
    
    //create the time marks for main timeline
    createTimeMarks : function() {
        var n_marks = this.options.duration/this.options.grid.sm_tic_ms;
        //console.log(n_marks);
        var grids = [];
        for(var i=0; i<n_marks; i++) {
            var grid_mark = $('<div class="grid" style="left:'+this.options.grid.em*i+'em"></div>'); //set grid left to grid.em * i
            grid_mark.append($('<div class="time-mark">'+(this.options.grid.em*i)%60+'</div>')); //add in the seconds 
            if((this.options.grid.em*i)%60===0) { // if on a miniute division.
                grid_mark.addClass('large');
                grid_mark.children().html(this.options.grid.em*i/60);
            }
            grids.push(grid_mark);
        }
        return grids;
    },
    
    //create the time marks for the overview.
    createOverviewTimes : function() {
        var n_marks = this.options.duration/60000;
        var min_to_precent = 6000000/this.options.duration; 
        var grids = [];
        for (var i=0; i<n_marks; i++){
            grids.push($('<div class="time-mark" style="left:'+min_to_precent*i+'%">'+'</div>'));
        }
        return grids;
    },
    
    //creates log marks for both timeline and overview
    createLogMarks : function() {
        if(!this.options.session) return {timemarks:null,overviewMarks:null};
        var timeMarks = [], viewMarks = [];
        var that = this, last_offset = null;
        var ms_to_em = this.options.grid.em/this.options.grid.sm_tic_ms;
        var ms_to_precent = 100/this.options.duration; 
        for(var i=0; i<this.options.session.Log.length; i++) {
            var log = this.options.session.Log.at(i);
            var log_ms = (log)?this.options.media.timestampToOffset(log.get('_timestamp')):this.options.duration;
            var style = (i%2==0)?'even':'odd';
            timeMarks.push($('<div class="log-mark '+style +'" style="left:'+log_ms*ms_to_em+'em;width:'+log.get('_duration')*ms_to_em+'em"><span>'+log.get('page')+'</span></div>'));
            viewMarks.push($('<div class="log-mark '+style+'" style="left:'+log_ms*ms_to_precent+'%;width:'+log.get('_duration')*ms_to_precent+'%">'+log.get('page')+'</div>'))
         }
         return {timemarks:timeMarks,overviewMarks:viewMarks};
    },
    
    createTagMarks : function(tags) {
        var tag_marks = $('<div></div>');
        var ms_to_em = this.options.grid.em/this.options.grid.sm_tic_ms;
        for(var i=0; i<tags.length;i++){
            var tag_em = tags[i].timestamp*ms_to_em;
            var tag = $('<div class="tag icon-'+tags[i].icon+'" style="color:'+tags[i].color+';left:'+tag_em+'em"></div>');
            tag.on('click',function(event){
               console.log(this); 
            });
            tag_marks.append(tag);
        }
        return tag_marks;
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
        var ms_2_px = parseInt(this.$overview.css('width'))/this.options.duration;
        if (typeof delta_t == 'string') { //assume precentage if string
            delta_t = parseInt(delta_t,10);
            if (delta_t < 0) delta_t=0;
            if (delta_t > 100) delta_t=100;
            this.$timeline.css('left',ms_2_em*this.options.duration*-delta_t/100+'em');
            this.$overview.children('.current-time').css('left',ms_2_px*this.options.duration*delta_t/100);
            this.time_display.$start.html(_.formatTime(this.options.duration*delta_t/100));
        }
        else { // assume ms
            delta_t = FS_Timeline.toMS(delta_t,conversion_str);
            if(delta_t < 0) delta_t=0;
            if(delta_t > this.options.duration) delta_t=this.options.duration;
            this.$timeline.css('left',ms_2_em*-delta_t+'em');
            this.$overview.children('.current-time').css('left',ms_2_px*delta_t);
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

var FS_tagcloud = function() {
    
    
}

/*
var icons = ['lightbulb','coffee','user-md','stethoscope','suitcase','medkit','asterisk','edit','envelope','signal','beaker','exclamation-sign','minus-sign','money','eye-close','eye-open',
    'bell-alt','music','book','film','ok-sign','star','bookmark','flag','pencil','bullhorn','plane','picture','tag','plus-sign','camera','calendar','food','print','thumbs-down','thumbs-up','time',
    'glass','globe','question-sign','tint','group','trash','truck','random','headphones','heart','umbrella','remove-sign','key','info-sign','comment','credit-card','legal','road','warning-sign',
    'wrench','lightbulb','lock','unlock','copy','cut','save','paper-clip','hand-down','hand-left','hand-right','hand-up'];
    
*/

return FS_Timeline;

}); // End Define Function






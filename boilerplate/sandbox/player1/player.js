function FS_Timeline(options) {
	this.options = $.extend(this.defaults,options);
	console.log(this.options);
	this.initialize();
	
	this.interval_timer = null;
	$(this.options.media).on('play',{that:this},this.track);
	$(this.options.media).on('pause',{that:this},this.untrack);
}

FS_Timeline.prototype.defaults = {
	ele:null,
	duration:60000, // in ms
	grid: {
		sm_tic_px: 50,
		sm_tic_ms: 5000,
		lg_tic_ms: 20000,
		em:5
	},
	delta_t:200, //ms
}

FS_Timeline.prototype.initialize = function() {
	this.$view_box = (this.options.ele)?$(this.options.ele):$('<div class="timeline-window"></div>');
	this.$timeline = $('<div class="timeline"><div class="time-marks"></div></div>');
	this.$timeline.children('.time-marks').append(this.createTimeMarks());
	this.$timeline.css('font-size',this.options.grid.sm_tic_px/this.options.grid.em+"px");
	this.$timeline.css('width',this.options.duration/this.options.grid.sm_tic_ms*this.options.grid.em+"em");
	//add elements into view box
	this.$view_box.append(this.$timeline,$('<div class="current-time-maker"></div>'));
	
}

FS_Timeline.prototype.createTimeMarks = function() {
	var n_marks = this.options.duration/this.options.grid.sm_tic_ms+1;
	console.log(n_marks);
	var grids = [];
	for(var i=0; i<n_marks; i++) {
		grids.push($('<div style="left:'+this.options.grid.em*i+'em"></div>'));
	}
	return grids;
}

FS_Timeline.prototype.track = function (event) {
	that = event.data.that;
	that.interval_timer = window.setInterval(function(){
		console.log(that.options.media.currentTime);
	},that.options.delta_t);
}

FS_Timeline.prototype.untrack = function (event) {
	window.clearInterval(event.data.that.interval_timer);
}
/*
 * 
 */
FS_Timeline.prototype.seekDelta = function(delta_x,units) {
	var cur_ms = this.getOffset().ms;
	delta_x = FS_Timeline.toMS(delta_x,units);
	var px_to_ms = (units=='px')?this.options.grid.sm_tic_ms/(parseInt(this.$timeline.css('font-size'))*this.options.grid.em):1;
	this.seekTo(cur_ms+px_to_ms*delta_x);
	//console.log(cur_ms,(cur_ms+delta_xx);
	//this.$timeline.css('left',(cur_+delta_x)+'px');
}

FS_Timeline.prototype.seekTo = function(delta_t,conversion_str) {
	
	var ms_2_em = this.options.grid.em/this.options.grid.sm_tic_ms;
	if (typeof delta_t == 'string') { //assume precentage if string
		delta_t = parseInt(delta_t,10);
		if (delta_t < 0) delta_t=0;
		if (delta_t > 100) delta_t=100;
		this.$timeline.css('left',ms_2_em*this.options.duration*-delta_t/100+'em')
	}
	else { // assume ms
		delta_t = FS_Timeline.toMS(delta_t,conversion_str);
		this.$timeline.css('left',ms_2_em*-delta_t+'em');
	}
}

FS_Timeline.prototype.getOffset = function() {
	var left_px = parseFloat(this.$timeline.css('left'));
	var px_to_ms = this.options.grid.sm_tic_ms/(parseInt(this.$timeline.css('font-size'))*this.options.grid.em)
	var ms = -left_px*px_to_ms;
	var percent = ms/this.options.duration;
	return {ms:ms,perecent:percent}
}

/*
 *  Returns tm converted to milliseconds
 * 		units in ['min','sec','hr']
 */
FS_Timeline.toMS = function(tm,unit) {
	if (typeof unit != "number") {
		unit = ({sec:1000,min:60000,hr:3600000,s:1000,m:60000,h:3600000})[unit]
	}
	unit = (unit)?unit:1; // default to ms
	return tm*unit;
}

$(function() {
	
	tmp_video = $('#test-video')[0];
	$('#play').click(function() {
		$('#play').hide();
		$('#pause').show();
		tmp_video.play();
	});
	
	$('#pause').click(function() {
		$('#play').show();
		$('#pause').hide();
		tmp_video.pause();
	});
	
	tmp_video.addEventListener('loadedmetadata',function() {
		timeline = new FS_Timeline({ele:$('.timeline-window'),duration:parseFloat(tmp_video.duration)*1000,media:tmp_video});
	});
});


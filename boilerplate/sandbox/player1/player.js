function FS_Timeline(options) {
	this.options = $.extend(this.defaults,options);
	this.initialize();
	
	this.interval_timer = null;
}

FS_Timeline.prototype.defaults = {
	ele:null,
	duration:60000, // in ms
	time_mark: {
		small_tic_px: 50,
		small_tic_ms: 5000,
		large_tic_ms: 20000,
	},
	delta_t:200, //ms
	delta_x:-2 //px
}

FS_Timeline.prototype.initialize = function() {
	this.$view_box = (this.options.ele)?$(this.options.ele):$('<div class="timeline-window"></div>');
	this.$timeline = $('<div class="timeline"><div class="time-marks"></div></div>');
	this.$timeline.children('.time-marks').append(this.createTimeMarks());
	this.$timeline.css('width',this.options.duration/this.options.time_mark.small_tic_ms*(this.options.time_mark.small_tic_px+1));
	//add elements into view box
	this.$view_box.append(this.$timeline,$('<div class="current-time-maker"></div>'));
	
}

FS_Timeline.prototype.createTimeMarks = function() {
	var n_marks = this.options.duration/this.options.time_mark.small_tic_ms;
	console.log(n_marks);
	var time_marks = [];
	for(var i=0; i<n_marks; i++) {
		time_marks.push($('<div style="width:'+this.options.time_mark.small_tic_px+'px"></div>'));
	}
	return time_marks;
}

FS_Timeline.prototype.start = function () {
	that = this;
	this.interval_timer = window.setInterval(function(){
		that.seekDelta(that.options.delta_x);
	},that.options.delta_t);
}

FS_Timeline.prototype.pause = function () {
	window.clearInterval(this.interval_timer);
}

FS_Timeline.prototype.seekDelta = function(delta_x) {
	var cur_x = parseFloat(this.$timeline.css('left'));
	console.log(cur_x,(cur_x+delta_x)+'px');
	this.$timeline.css('left',(cur_x+delta_x)+'px');
}

$(function() {
	timeline = new FS_Timeline({ele:$('.timeline-window'),duration:10000});
	
	$('#play').click(function() {
		$('#play').hide();
		$('#pause').show();
		timeline.start();
	});
	
	$('#pause').click(function() {
		$('#play').show();
		$('#pause').hide();
		timeline.pause();
	});
	
	
});

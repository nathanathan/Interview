(function( $ ){

  var methods = {
    init : function( options ) { 
		this.$timeline = this.find('.timeline').css('left','0px');
		this.$timer = methods.startTimer();
		$that = this;
		return this;
    },
    startTimer : function( ) {
      return window.setInterval(methods.delta,100);
    },
    pause : function () {
		clearInterval($that.$timer);
		return $that;
	},
    delta : function(delta_x) {
		$that.$timeline.css('left',parseInt($that.$timeline.css('left'))-10);
		console.log($that.$timeline.css('left'),parseInt($that.$timeline.css('left'))-10);
	} 
};

  $.fn.InterviewPlayer = function( method ) {
    
    // Method calling logic
    if ( methods[method] ) {
      return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jQuery.tooltip' );
    }    
  
  };

})( jQuery );

var $player;
$(function() {
	$player = $('#player').InterviewPlayer();
	setInterval(function(){$player.InterviewPlayer('pause')},5000);
});

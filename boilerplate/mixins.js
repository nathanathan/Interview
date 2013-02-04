define(['underscore'], function(_){
    _.mixin({
        formatTime: function(millis) {
            var seconds = Math.floor(millis / 1000) % 60;
            var minutes = Math.floor(millis / 60 / 1000);
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return minutes + ':' + seconds;
        }
    });
});
define(['underscore'], function(_){
    _.mixin({
        /**
         * Format a times in milliseconds as minutes:seconds
         **/
        formatTime: function(millis) {
            var seconds = Math.floor(millis / 1000) % 60;
            var minutes = Math.floor(millis / 60 / 1000);
            //if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return minutes + ':' + seconds;
        },
        /**
         * Create a copy of the object without keys beginning with an underscore
         **/
        omitUnderscored: function(obj) {
            var copy = {};
            _.forEach(_.keys(obj), function(key) {
                if (key[0] !== '_') copy[key] = obj[key];
            });
            return copy;
        }
    });
});
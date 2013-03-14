
        function hasClass(ele,cls) {
            return ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
        }
        function addClass(ele,cls) {
            if (!this.hasClass(ele,cls)) ele.className += " "+cls;
        }
        function removeClass(ele,cls) {
            if (hasClass(ele,cls)) {
                var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
                ele.className=ele.className.replace(reg,'');
            }
        }
        function tag_menu(){
            var menu_tag=document.getElementById("tag_btn");
            if(hasClass(menu_tag,"open"))
                removeClass(menu_tag,"open");
            else
                addClass(menu_tag,"open");
        }
        function start_pause_interview(){
            var btn=document.getElementById("start_stop_btn");
            var status=document.getElementById("time_status");
            if(btn.src=="http://cdn1.iconfinder.com/data/icons/Primo_Icons/PNG/48x48/button_blue_pause.png"){
                btn.src="http://cdn1.iconfinder.com/data/icons/Primo_Icons/PNG/48x48/button_blue_play.png";
                status.innerHTML="Paused";
            }
            else{
                btn.src="http://cdn1.iconfinder.com/data/icons/Primo_Icons/PNG/48x48/button_blue_pause.png"
                status.innerHTML="Recording.....";
            }
        }

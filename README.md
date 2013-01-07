Interview
=========

This is an app for conducting and recording interviews.

Interviews are structured using [FLP websites](https://github.com/nathanathan/FeelsLikePHP).

All the page transitions are logged making it possible to tell where in the recording a particular question is being answered.

The second half of this project will be a website that annotates the audio timeline with the page the interviewer is on,
and that makes it possible to search through recordings for responces to particular questions.

Technologies
------------

The app is currently being designed to run on mobile devices using Cordova.
It uses the Cordova Media object to capture audio.
The website for data exploration will probably be a couchapp.

Problems
--------

* I can't figure out how to upload a file from my Cordova app to my couchdb instance.
I think this is a CORS issue on couch's end.

For this reason I think I'll need to either make this a couchapp entirely,
or use Cordova storage and include the audio data explorer within the app.

Going the couchapp route, I could run the couchapp on the phone, and maybe use replication to get it onto a server. However, I don't think I would be able to use Phonegap build.

The Cordova storage route has the advantage of allowing everything to be done offline. However, I think a desktop would be preferable for the data exploration phase. The data would be safer online. This should be easier to implement, except when it comes to designing the marked-up audio tracker.

* I'm confused about how to handle audio across all platforms.

Cordova has a Media object that does everything I need, however it is not present in browsers.

http://chromium.googlecode.com/svn/trunk/samples/audio/index.html

https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/webrtc-integration.html

TODO:
-----

3. Get the backbone local storage working in player.
(see http://documentcloud.github.com/backbone/docs/todos.html)
4. Create full example interview.
5. Fix filter/sort in explorer
6. Refactor explorer.html
7. Make page links open a menu?

Notes on organization:
----------------------

Currently the app is designed to be built with a single interview definition.

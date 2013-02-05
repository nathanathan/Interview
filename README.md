Interview
=========

This is an app for conducting and recording interviews.

Interviews are structured using [FLP websites](https://github.com/nathanathan/FeelsLikePHP).

All the page transitions are logged making it possible to tell where in the recording a particular question is being answered.

The second half of this project will be a website that annotates the audio timeline with the page the interviewer is on,
and that makes it possible to search through recordings for responces to particular questions.


Storage
-------

My initial plan was to use CouchDB however I ran into CORS issues when trying to do remote submission, and if I were to try to make a couchapp for use with [Mobile Futon](https://github.com/daleharvey/Android-MobileFuton) I wouldn't be able to easily access the Cordova Media object from it.

Now I'm planning to use Dropbox, but there are a few different approaches:

A. Save everything to a folder that gets synced via [Dropsync](https://play.google.com/store/apps/details?id=com.ttxapps.dropsync&hl=en)
B. Do all the syncing through JavaScript code included in the application.

I'm leaning towards B because:
-Only one app needs to be installed, and operated, so it should be easier for the user.
-Syncing media files might be slightly harder, but I might find it useful to have more control over them.

However, saving to the filesystem could make it easier to move data around.

I'm thinking it will work something like this:
User clicks a Sync data on the main interview page.
A child window is created if necessairy to log in to dropbox.
A wait dialog is displayed.
Sessions are saved in individual files,
log items are saved as collections in files named by the session id (saving them individually would be a LOT of http requests).
Then the recording is saved if it's not already on the server.
I'm not quite sure how additional annotations should work.
Since they may be added and removed by multiple users there could be revision control problems.
If it is necessairy to delete items while offline, they will need to support
a `_deleted` property.

There is a [Backbone Dropbox Sync Adapter](http://coffeedoc.info/github/dropbox/dropbox-js/master/classes/Dropbox/Client.html) that could helpful.

[This documention for the Dropbox js client api should also help.](http://coffeedoc.info/github/dropbox/dropbox-js/master/classes/Dropbox/Client.html)


Media Capture
-------------

* I'm confused about how to handle audio across all platforms.

Cordova has a Media object that does everything I need, however it is not present in browsers.

http://chromium.googlecode.com/svn/trunk/samples/audio/index.html

https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/webrtc-integration.html

Audio playback
--------------

For playback from the cloud we'll probably need to download audio through the dropbox api
as data. I hope datauris are supported for audio.

Encryption
----------

If encryption turns out to be necessairy we can encrypt audio in JS prior to saving with [this library](http://crypto.stanford.edu/sjcl/).

TODO:
-----

1. Fix sort in explorer
2. Make page links open a menu in explorer, with options to view the original question or filter by it?
3. Introduce another type of marker beside log items for marking themes.*
4. Add way to generate guides without using html. Maybe something like xlsform?
(Also generate sidenav that shows where you are in the interview.*)
5. Add recording notice at start.
6. Older adroid device does not seem to be seeking correctly.

*Thanks to Beth K for these ideas.

Notes on organization:
----------------------

Currently the app is designed to be built with a single interview definition.

Other tools
------------

[Atlas.TI](http://www.atlasti.com/)

 * [Does everything](http://www.atlasti.com/features.html)
 * But no interview guide tool and does not appear to have cloud functionality. (This is useful because there will probably be multiple reviewers).
 * Expensive (500 euros and above, free version limits amount of data)

[Max QDA](http://www.maxqda.com)

 * [Mobile app but no apparent integration with interview guide](http://www.maxqda.com/products/maxqda11/mobile-app/maxapp-features)
 * About as expensive as Atlas

I think it would be a good idea to look into integrating with Atlas/Max for complex use cases, but to try to keep the core interviewing app simple enough for people to just pick up and use without having to spend time learning how it works.

ODK Collect with audio inputs

 * Each question must be recorded individually.
 
SmartPen

 * Pen may have some limitations in data exploration area.
 * It may also have benefits (full text search)
 * It has a greater cost if you already have a device.
 * The interaction seems very different. I think some amount of study would be necessairy for full comparison.

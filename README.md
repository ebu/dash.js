
# EBU-TT-D Subtitling within dash.js

This is a fork of dash.js with as purpose to *experiment* with the support for XML based subtitles like EBU-TT-D within dash.js
Please note the code has not been fully tested yet and no claims are made in terms of feature completeness or correctness of the implementation!

The current work focuses on an HTML/CSS overlay to replace the native approach. This solution allows dash.js to render the subtitles and its properties closer to the author's intentions. In fact, CSS properties are very close to the ones used in EBU-TT-D. The approach is also quite versatile as it allows us to reproduce properties that are not part of the CSS specification.

The core modifications can be found in the following javascript classes:

- TextSourceBuffer: uses for "fragmentedText" files, the new features instead of TextTrack and VTTCues;
- TTMLParser: An improved TTMLParser that parses the style and positioning information and provides the relevant data to the renderer;
- CustomCaptions (new): The renderer. Handles the rendering of the subtitles and controls their timings;
- CustomControls (new): Created in order to manage the overlay arrangement between the video, the subtitles and the controls.

To test it out:
- Create your EBU-TT-D document (https://tech.ebu.ch/docs/tech/tech3380.pdf)
- Package it in an ISOBMFF format as the DASH specification requires (you can use MP4Box for example: gpac.wp.mines-telecom.fr/2014/08/23/ebu-ttd-support-in-gpac/)
- Produce a manifest (you can also use MP4Box for this)
- Launch a server at the root of the project where dash.js can send HTTP requests to get the media chunks
- Launch index.html (samples/ebu-subtitling-demo) after setting the source value to your MPD address

For any questions, contact Solène Buet (EPFL) at the EBU.

# dash.js
<img src="https://cloud.githubusercontent.com/assets/2762250/7824984/985c3e76-03bc-11e5-807b-1402bde4fe56.png" width="400">

JSHint and Jasmine status: [![JSHint and Jasmine](http://img.shields.io/travis/Dash-Industry-Forum/dash.js/development.svg?style=flat-square)](https://travis-ci.org/Dash-Industry-Forum/dash.js)

A reference client implementation for the playback of MPEG DASH via JavaScript and compliant browsers. Learn more about DASH IF Reference Client on our [wiki](https://github.com/Dash-Industry-Forum/dash.js/wiki).

If your intent is to use the player code without contributing back to this project, then use the MASTER branch which holds the approved and stable public releases.

If your goal is to improve or extend the code and contribute back to this project, then you should make your changes in, and submit a pull request against, the DEVELOPMENT branch. Read through our wiki section on https://github.com/Dash-Industry-Forum/dash.js/wiki/How-to-Contribute for a walk-through of the contribution process.

All new work should be in the development branch. Master is now reserved for tagged builds.

## Quick Start for Users
If you just want a DASH player to use and don't need to see the code or commit to this project, then follow the instructions below. If you are a developer and want to work with this code base, then skip down to the "Quick Start for Developers" section.

Put the following code in your web page
```
<script src="http://cdn.dashjs.org/latest/dash.all.js"></script>
...
<body onLoad="Dash.createAll()">
   <div>
       <video class="dashjs-player" autoplay preload="none" controls="true">
              <source src="http://dash.edgesuite.net/envivio/dashpr/clear/Manifest.mpd" type="application/dash+xml"/>
       </video>
   </div>
</body>
```
Then place your page under a web server (do not try to run from the file system) and load it via http in a MSE-enabled browser. The video will start automatically. Switch out the manifest URL to your own manifest once you have everything working. If you prefer to use the latest code from this project (versus the last tagged release) then download dash.all.js file from the development/dist folder, mount it on a web server and change your script tag to refer to it.

View the /samples folder for many other examples of embedding and using the player. For help, join our [email list](https://groups.google.com/d/forum/dashjs) and read our [wiki](https://github.com/Dash-Industry-Forum/dash.js/wiki) .


## Quick Start for Developers

### Reference Player
1. Download 'master' or latest tagged release.
2. Extract dash.js and move the entire folder to localhost (or run any http server instance such as python's SimpleHTTPServer at the root of the dash.js folder).
3. Open samples/dash-if-reference-player/index.html in your MSE capable web browser.

### Install Dependencies
1. [install nodejs](http://nodejs.org/)
2. [install grunt](http://gruntjs.com/getting-started)
    * npm install -g grunt-cli

### Build / Run tests
1. Change directories to the build folder
    * cd build/
2. Install all Node Modules defined in package.json
    * npm install
3. Run all the GruntFile.js task (Complete Build and Test)
    * grunt
4. You can also target individual tasks:
    * grunt uglify
    * grunt jsdoc
    * grunt jshint

## Getting Started
Create a video element somewhere in your html. For our purposes, make sure to set the controls property to true.
```
<video id="videoPlayer" controls="true"></video>
```
Add dash.all.js to the end of the body.
```
<body>
  ...
  <script src="yourPathToDash/dash.all.js"></script>
</body>
```
Now comes the good stuff. We need to create a dash context. Then from that context we create a media player, initialize it, attach it to our "videoPlayer" and then tell it where to get the video from. We will do this in an anonymous self executing function, that way it will run as soon as the page loads. So, here is how we do it:
``` js
(function(){
    var url = "http://dash.edgesuite.net/dash264/TestCases/1c/qualcomm/2/MultiRate.mpd";
    var context = new Dash.di.DashContext();
    var player = new MediaPlayer(context);
    player.startup();
    player.attachView(document.querySelector("#videoPlayer"));
    player.attachSource(url);
})();
```

When it is all done, it should look similar to this:
```
<!doctype html>
<html>
    <head>
        <title>Dash.js Rocks</title>
    </head>
    <body>
        <div>
            <video id="videoPlayer" controls="true"></video>
        </div>
        <script src="yourPathToDash/dash.all.js"></script>
        <script>
            (function(){
                var url = "http://dash.edgesuite.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1.mpd";
                var context = new Dash.di.DashContext();
                var player = new MediaPlayer(context);
                player.startup();
                player.attachView(document.querySelector("#videoPlayer"));
                player.attachSource(url);
            })();
        </script>
    </body>
</html>
```


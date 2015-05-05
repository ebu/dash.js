/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

MediaPlayer.dependencies.TextSourceBufferExtensions = function () {
    "use strict";

    var cue,
        playlist,
        video;


    function addStyleToCaption(style) {
        var styleBlock = "";

        // Add each CSS property to a CSS block.
        for (var i = 0; i < style.length; i++){
            styleBlock += style[i] +';'+ "\n";
        }

        var styleElement = document.getElementsByTagName('style')[0];
        // We replace the current style with the new cue style.

        styleElement.innerHTML =
            ".container{\
            width:1280px;\
            height:720px;\
            position: relative;\
            margin: 0;\
            padding: 0;\
            display: block;\
            }\
            .video {\
            position: relative;\
            display:block;\
            height:100%;\
            width: 100%;\
            }\
            .caption-cues-container {\
            position: absolute;\
            left: 200px;\
            right: 0;\
            top: 200px;\
            color: #fff;\
            font-family: Segoe UI, Arial, Helvetica, sans-serif;\
            text-align: center;\
            z-index: 0;\
            }\
            .cue{\
            color: white; \
            font-family: Arial; \
            font-size: 36px; \
            text-shadow: none; \
            padding: 3px; \
            opacity: 0.7; \
            background-color: black; \
            display: table; \
            margin: auto;\
            }\
            .text{\
            margin: 0;\
            padding: 0;\
            border: 0;\
            }\
            " + styleBlock + "}";

    }

    function replaceContentInContainer(matchClass, content) {
        var elems = document.getElementsByTagName('*'), i;
        for (i in elems) {
            if((' ' + elems[i].className + ' ').indexOf(' ' + matchClass + ' ')
                > -1) {
                elems[i].innerHTML = content;
            }
        }
    }

    return {

        initialize: function (videoModel) {
            // Initialization of the videoModel, the playlist and we start listening the event we need.

            video = videoModel;
            this.listen();
            playlist = [];

        },

        listen: function(){

            // Check every ms which cue should be played.
            video.listen('timeupdate', this.onCaption);

        },

        addCaptionsToPlaylist: function (dts, duration, captions) {

            var newCues = {};
            // Record the cues Info for its parsing and displaying.
            newCues.decode = dts;
            newCues.duration = duration;
            newCues.data = captions;
            playlist.push(newCues);

        },


        onCaption: function() {
            // Check if we have a cue to play
            if (playlist.length !== 0) {
                var time = video.getCurrentTime();
                cue      = playlist[0];
                var diff = Math.abs(time - cue.data[0].start);
                // Function to determine the cue that should play at the video current time.
                for (var i = 0; i < playlist.length; i++) {
                    // Check that the start of the cue we test is at least after or equal to the current time
                    // So the cue chosen should always be the right one in the timeline, even when seeking
                    if (time >= playlist[i].data[0].start) {

                        var newDiff = Math.abs(time - playlist[i].data[0].start);

                        if (newDiff < diff) {
                            diff = newDiff;
                            cue  = playlist[i];
                        }
                        // When the cue is found, we apply its text, style and positioning.
                        replaceContentInContainer("text",cue.data[0].data);

                        if(cue.data[0].style) {
                            addStyleToCaption(cue.data[0].style);
                        }
                        // else use default

                    } else {
                        // We check for another cue in the list
                        continue;
                    }
                }
            } else {
                // Nothing to be played.
                return;
            }
        }
    };
};

MediaPlayer.dependencies.TextSourceBufferExtensions.prototype = {
    constructor: MediaPlayer.dependencies.TextSourceBufferExtensions
};
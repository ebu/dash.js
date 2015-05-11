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

MediaPlayer.dependencies.CustomCaptions = function () {
    "use strict";

    var cue,
        playlist,
        video;

    // Method which assign to the HTML the styling and positioning in the right containers for every cue.
    function addRenderingToCaption(data) {
        var bodyStyleProperties = "",
            divStyleProperties = "",
            divRegionProperties = "",
            paragraphStyleProperties = "",
            paragraphRegionProperties = "";

        // Add each CSS property to a CSS text block.
        if(data.bodyStyle){
            for (var i = 0; i < data.bodyStyle.length; i++) {
               bodyStyleProperties += data.bodyStyle[i] + "\n";
            }
        }
        if(data.divStyle) {
            for (var i = 0; i < data.divStyle.length; i++) {
                divStyleProperties += data.divStyle[i] + "\n";
            }
        }
        if(data.divRegion) {
            for (var i = 0; i < data.divRegion.length; i++) {
                if (data.divRegion[i].indexOf("vertical-align") > -1) {
                    document.getElementById('captionTextArea').style.cssText += data.divRegion[i] + "\n";
                    continue;
                }
                divRegionProperties += data.divRegion[i] + "\n";
            }
        }
        if(data.paragraphStyle) {
            for (var i = 0; i < data.paragraphStyle.length; i++) {
                paragraphStyleProperties += data.paragraphStyle[i] + "\n";
            }
        }
        if(data.paragraphRegion) {
            for (var i = 0; i < data.paragraphRegion.length; i++) {
                if (data.paragraphRegion[i].indexOf("vertical-align") > -1) {
                    document.getElementById('captionTextArea').style.cssText += data.paragraphRegion[i] + "\n";
                    continue;
                }
                paragraphRegionProperties += data.paragraphRegion[i] + "\n";
            }
        }

        // We set the region
        var regions = document.getElementsByClassName('captionRegion');
        for (var i = 0; i < regions.length; i++){
            if(divRegionProperties === ""){
                if(paragraphRegionProperties == ""){
                    regions[i].style.cssText = "top: 85%; left: 30%; width: 40%; height: 20%; padding: 0%; overflow: visible;";
                } else {
                    regions[i].style.cssText = paragraphRegionProperties;
                }
            } else {
                regions[i].style.cssText = divRegionProperties;
            }
        }

        // We set the style

        var textArea = document.getElementsByClassName('captionParagraph');
        if(paragraphStyleProperties === ""){
            if(divStyleProperties === ""){
                if(bodyStyleProperties === ""){
                    for (var i = 0; i < textArea.length; i++){
                        textArea[i].style.cssText = "font-size: 150%; line-height: 100%; text-align: center; color: rgb(255, 0, 0); font-style: normal; font-weight: normal; text-decoration: none; font-family: Helvetica; direction: ltr; unicode-bidi: normal; white-space: normal; vertical-align: top; background-color: rgb(255, 255, 0);";
                    }
                } else{
                    for (var i = 0; i < textArea.length; i++){
                        textArea[i].style.cssText = bodyStyleProperties;
                    }
                }
            } else{
                for (var i = 0; i < textArea.length; i++){
                    textArea[i].style.cssText = divStyleProperties;
                }
            }
        } else {
            for (var i = 0; i < textArea.length; i++) {
                textArea[i].style.cssText = paragraphStyleProperties;
            }
        }
    }

    // Replace the HTML content of elements of a certain class
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
            if (document.getElementById('captionRegion').style.display === 'none') {
                return;
            } else {
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
                            replaceContentInContainer("captionParagraph", cue.data[0].data);
                            addRenderingToCaption(cue.data[0]);

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
        }
    };
};

MediaPlayer.dependencies.CustomCaptions.prototype = {
    constructor: MediaPlayer.dependencies.CustomCaptions
};
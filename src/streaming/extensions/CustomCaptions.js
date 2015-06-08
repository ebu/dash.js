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
MediaPlayer.dependencies.CustomCaptions = function() {
    "use strict";
    var playlist, // Playlist containing all cues received
        video, // video from the VideoModel
        activeCue, // Active cue playing
        captionRegion = document.getElementById('captionRegion'), // container of the captionText, represent the region
        defaultRegion = "top: 85%; left: 30%; width: 40%; height: 20%; padding: 0%; overflow: visible; white-space:normal";

    /***** Method which assign to the HTML the positioning for every cue. *****/
    function addPositioningToCaption(cue) {

        // Affect the defined regions to the captionRegion container.
        if (cue.divRegion.length == 0) {
            if (cue.paragraphRegion.length == 0) {
                // If no region is defined, we set a default region
                captionRegion.style.cssText = defaultRegion;
            } else {
                captionRegion.style.cssText = cue.paragraphRegion.join(" ");
            }
        } else {
            captionRegion.style.cssText = cue.divRegion.join(" ");
        }
    }

    return {

        initialize: function(videoModel) {
            // Initialization of the videoModel, the playlist and we start listening the event we need.
            video = videoModel;
            this.listen();
            playlist = [];
        },

        listen: function() {
            // Check every ms which cue should be played.
            video.listen('timeupdate', this.onCaption);

        },

        addCueToPlaylist: function(cue) {
            // Add the cue to the playlist.
            playlist.push(cue);
            // Initialization of the first cue.
            if (playlist.length === 1) {
                activeCue = playlist[0];
                this.onCaption();
            }
        },

        /***** Function to determine the cue that should be played at the video current time. *****/
        onCaption: function() {

            // Check if we have a cue to play and if the cc is turned on.
            if (captionRegion.style.display === 'none' || playlist.length === 0) {
                return;
            }
            var time = video.getCurrentTime();
            var diff = Math.abs(time - activeCue.start);

            // Check if we need to change the active cue.
            if (time > activeCue.start && time < activeCue.end && captionRegion.childElementCount > 0) {
                return;
            }

            // Make sure the region is emptied before we add anything.
            while (captionRegion.firstChild) {
                captionRegion.removeChild(captionRegion.firstChild);
            }

            // Define if the region should be kept or not
            // if showBackground = "always":
            // he background color of a region is always rendered when performing presentation processing on a visual medium
            // if showBackground ="whenActive":
            // the background color of a region is rendered only when some content is flowed into the region
            if (!activeCue.showBackground) {
                captionRegion.style.cssText = "";
            }

            playlist.forEach(function(cue) {
                // Check that the start of the cue we test is at least after or equal to the current time
                // So the cue chosen should always be the right one in the timeline, even when seeking
                if (time >= cue.start && time <= cue.end) {
                    var newDiff = Math.abs(time - cue.start);
                    if (newDiff < diff) {
                        diff = newDiff;
                        activeCue = cue;
                    }

                    /*** When the cue is found, we apply its text, style and positioning. ***/

                    // Add the HTML elements to the captionText container.
                    if (activeCue.data) {
                        captionRegion.appendChild(activeCue.data);

                        // Apply the styling and positioning to our text.
                        addPositioningToCaption(activeCue);
                    }
                }
            });
        }
    };
};

MediaPlayer.dependencies.CustomCaptions.prototype = {
    constructor: MediaPlayer.dependencies.CustomCaptions
};
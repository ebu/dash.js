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
    var playlist = [], // Playlist containing all cues received
        video, // video from the VideoModel
        idShowBackground = [],
        activeCues = [], // Active cue playing

        // Return whether or not an array contains a certain text
        arrayContains = function(text, array) {
            for (var i = 0; i < array.length; i++) {
                if (array[i].indexOf(text) > -1) {
                    return true;
                }
            }
            return false;
        },

        // Return the whole value that contains "text"
        getPropertyFromArray = function(text, array) {
            for (var i = 0; i < array.length; i++) {
                if (array[i].indexOf(text) > -1) {
                    return array[i];
                }
            }
            return null;
        };

    return {

        initialize: function(videoModel) {
            // Initialization of the videoModel, the playlist and we start listening the event we need.
            video = videoModel;
            this.listen();
        },

        listen: function() {
            // Check every 200ms which cue should be played.
            video.listen('timeupdate', this.onCaption);

        },

        addCueToPlaylist: function(cue) {
            // Add the cue to the playlist.
            playlist.push(cue);
            // Initialization of the first cue.
            if (playlist.length === 1) {
                cue.regions.forEach(function(region) {
                    if(arrayContains("show-background", region)) {
                        if(getPropertyFromArray("show-background", region).slice(getPropertyFromArray("show-background", region).indexOf(':') + 1, getPropertyFromArray("regionID", region).length - 1) === "always") {
                            var captionRegion = document.createElement('div');
                            captionRegion.style.cssText = region.join(" ");
                            captionRegion.id = getPropertyFromArray("regionID", region).slice(getPropertyFromArray("regionID", region).indexOf(':') + 1, getPropertyFromArray("regionID", region).length - 1);
                            captionRegion.className = "captionRegion";
                            document.getElementById('container').insertBefore(captionRegion, document.getElementById('mycontrols'));
                            idShowBackground.push(getPropertyFromArray("regionID", region).slice(getPropertyFromArray("regionID", region).indexOf(':') + 1, getPropertyFromArray("regionID", region).length - 1));
                        }
                    }
                });
                activeCues.push(cue);
                //this.onCaption();
            }
        },

        /***** Function to determine the cue that should be played at the video current time. *****/
        onCaption: function() {
            // Check if we have a cue to play and if the cc is turned on.
            if (playlist.length === 0) {
                return;
            }

            playlist.forEach(function(cue) {
                // Check that the start of the cue we test is at least after or equal to the current time
                // So the cue chosen should always be the right one in the timeline, even when seeking
                var time = video.getCurrentTime();
                if (time >= cue.start && time <= cue.end) {
                    var duplicate = false;
                    activeCues.forEach(function(activeCue) {
                       if(activeCue.cueID === cue.cueID) {
                           duplicate = true;
                       }
                    });
                    if(!duplicate){
                        activeCues.push(cue);
                    }
                }
            });

            activeCues.forEach(function(activeCue, index) {
                var time = video.getCurrentTime();
                // Check if we need to change the active cue.
                if(document.getElementById(activeCue.regionID)) {
                    if (time > activeCue.start && time < activeCue.end && document.getElementById(activeCue.regionID).firstChild) {
                        return;
                    }
                }

                if(time < activeCue.start || time > activeCue.end) {
                    activeCues.splice(index, 1);
                    if(!arrayContains(activeCue.regionID, idShowBackground)) {
                        document.getElementById(activeCue.regionID).style.cssText = "";
                    }
                    document.getElementById(activeCue.regionID).innerHTML ="";
                    return;
                }

                // Add the HTML elements to the captionText container.
                if (activeCue.cueHTMLElement) {
                    if (document.getElementById(activeCue.regionID)) {
                        document.getElementById(activeCue.regionID).style.cssText = activeCue.cueRegion;
                        document.getElementById(activeCue.regionID).appendChild(activeCue.cueHTMLElement);
                    } else {
                        // Append the cue to the HTML caption layer.
                        var captionRegion = document.createElement('div');
                        // Apply the positioning to our text.
                        captionRegion.style.cssText = activeCue.cueRegion;
                        captionRegion.id            = activeCue.regionID;
                        captionRegion.className     = "captionRegion";
                        captionRegion.appendChild(activeCue.cueHTMLElement);
                        document.getElementById('container').insertBefore(captionRegion, document.getElementById('mycontrols'));
                    }
                }
            });
        }
    };
};

MediaPlayer.dependencies.CustomCaptions.prototype = {
    constructor: MediaPlayer.dependencies.CustomCaptions
};
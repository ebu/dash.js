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
        playButton = document.getElementById('playpause'),
        container = document.getElementById('container'),
        seekBar = document.getElementById('seekbar'),
        controls = document.getElementById('mycontrols'),
        scalingEvent = new CustomEvent('scaling'),
        actualWidth,
        actualHeight,

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
            document.addEventListener('scaling', this.onScaling, false);
            actualWidth = video.getElement().clientWidth;
            actualHeight = video.getElement().clientHeight;

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
                    if (arrayContains("show-background", region)) {
                        var showBackgroundValue = getPropertyFromArray("show-background", region)
                            .slice(getPropertyFromArray("show-background", region).indexOf(':') + 1, getPropertyFromArray("show-background",
                                region).length - 1);
                        if (showBackgroundValue === "always") {
                            var captionRegion = document.createElement('div');
                            captionRegion.style.cssText = region.join(" ");

                            var regionID = getPropertyFromArray("regionID", region)
                                .slice(getPropertyFromArray("regionID", region).indexOf(':') + 1,
                                getPropertyFromArray("regionID", region).length - 1);

                            captionRegion.id = regionID;
                            captionRegion.className = "captionRegion";
                            container.insertBefore(captionRegion, controls);
                            idShowBackground.push(regionID);
                        }
                    }
                });
                activeCues.push(cue);
            }
        },

        onScaling: function() {
            // Recover the video width and height displayed by the player.
            var videoWidth = video.getElement().clientWidth;
            var videoHeight = video.getElement().clientHeight;
            activeCues.forEach(function(activeCue) {
                var cellUnit = [videoWidth / activeCue.cellResolution[0], videoHeight / activeCue.cellResolution[1]];
                if (activeCue.linePadding) {
                    for (var key in activeCue.linePadding) {
                        if (activeCue.linePadding.hasOwnProperty(key)) {
                            var valueLinePadding = activeCue.linePadding[key];
                            var replaceValue = (valueLinePadding * cellUnit[0]).toString();
                            // Compute the CellResolution unit in order to process properties using sizing (fontSize, linePadding, etc).
                            var elements = document.getElementsByClassName('spanPadding');
                            for (var i = 0; i < elements.length; i++) {
                                elements[i].style.cssText = elements[i].style.cssText.replace(/(padding-left\s*:\s*)[\d.,]+(?=\s*px)/gi, "$1" + replaceValue);
                                elements[i].style.cssText = elements[i].style.cssText.replace(/(padding-right\s*:\s*)[\d.,]+(?=\s*px)/gi, "$1" + replaceValue);
                            }
                        }
                    }
                }

                for (var key in activeCue.fontSize) {
                    if (activeCue.fontSize.hasOwnProperty(key)) {
                        var valueFontSize = activeCue.fontSize[key] / 100;
                        var replaceValue = (valueFontSize * cellUnit[1]).toString();
                        if (key !== 'defaultFontSize') {
                            var elements = document.getElementsByClassName(key);
                        } else {
                            var elements = document.getElementsByClassName('paragraph');
                        }
                        for (var i = 0; i < elements.length; i++) {
                            elements[i].style.cssText = elements[i].style.cssText.replace(/(font-size\s*:\s*)[\d.,]+(?=\s*px)/gi, "$1" + replaceValue);
                        }
                    }
                }

                if (activeCue.lineHeight) {
                    for (var key in activeCue.lineHeight) {
                        if (activeCue.lineHeight.hasOwnProperty(key)) {
                            var valueLineHeight = activeCue.lineHeight[key] / 100;
                            var replaceValue = (valueLineHeight * cellUnit[1]).toString();
                            var elements = document.getElementsByClassName(key);
                            for (var i = 0; i < elements.length; i++) {
                                elements[i].style.cssText = elements[i].style.cssText.replace(/(line-height\s*:\s*)[\d.,]+(?=\s*px)/gi, "$1" + replaceValue);
                            }
                        }
                    }
                }
            });
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
                        if (activeCue.cueID === cue.cueID) {
                            duplicate = true;
                        }
                    });
                    if (!duplicate) {
                        activeCues.push(cue);
                    }
                }
            });

            if (actualHeight !== video.getElement().clientHeight) {
                document.dispatchEvent(scalingEvent);
                actualHeight = video.getElement().clientHeight;
                actualWidth = video.getElement().clientWidth;
            }

            activeCues.forEach(function(activeCue, index) {
                var activeCueElement = document.getElementById(activeCue.regionID);
                var time = video.getCurrentTime();
                // Check if we need to change the active cue.
                if (document.getElementById(activeCue.regionID)) {
                    if (time >= activeCue.start && time <= activeCue.end && activeCueElement.firstChild) {
                        return;
                    }
                }

                if (time <= activeCue.start || time >= activeCue.end) {
                    activeCues.splice(index, 1);
                    if (!arrayContains(activeCue.regionID, idShowBackground)) {
                        activeCueElement.style.cssText = "";
                    }
                    activeCueElement.innerHTML = "";
                    return;
                }

                // Add the HTML elements to the captionText container.
                if (activeCue.cueHTMLElement) {
                    if (activeCueElement) {
                        activeCueElement.appendChild(activeCue.cueHTMLElement);
                        activeCueElement.style.cssText = activeCue.cueRegion;
                    } else {
                        // Append the cue to the HTML caption layer.
                        var captionRegion = document.createElement('div');
                        // Apply the positioning to our text.
                        captionRegion.style.cssText = activeCue.cueRegion;
                        captionRegion.id = activeCue.regionID;
                        captionRegion.className = "captionRegion";
                        captionRegion.appendChild(activeCue.cueHTMLElement);
                        container.insertBefore(captionRegion, controls);

                        captionRegion.addEventListener('click', function() {
                            if (video.getElement().paused) {
                                video.getElement().play();
                                playButton.classList.add('icon-pause');
                                playButton.classList.remove('icon-play');
                                seekBar.classList.add('light');
                            } else {
                                video.getElement().pause();
                                playButton.classList.add('icon-play');
                                playButton.classList.remove('icon-pause');
                                seekBar.classList.remove('light');
                            }
                        }, false);
                    }
                }
            });
        }
    };
};

MediaPlayer.dependencies.CustomCaptions.prototype = {
    constructor: MediaPlayer.dependencies.CustomCaptions
};
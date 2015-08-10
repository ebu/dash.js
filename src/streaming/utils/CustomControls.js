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

MediaPlayer.utils.CustomControls = function () {
    "use strict";

    return {

        createControls: function (videoModel, streamController) {
            var video            = videoModel.getElement(),
                controls         = document.getElementById('mycontrols'),
                container        = document.getElementById('container'),
                playbutton       = document.getElementById('playpause'),
                mutebutton       = document.getElementById('mute'),
                fullscreenbutton = document.getElementById('fullscreen'),
                seek             = document.getElementById('seekbar'),
                volume           = document.getElementById('volumebar'),
                vval             = volume.value,
                progressbar      = document.getElementById('progressbar'),
                bufferbar        = document.getElementById('bufferbar'),
                captionButton    = document.getElementById('caption');

            if(streamController.getAutoPlay()){
                playbutton.classList.add('icon-pause');
                playbutton.classList.remove('icon-play');
            } else {
                playbutton.classList.add('icon-play');
                playbutton.classList.remove('icon-pause');
            }

            setTimeout(function(){
                controls.classList.add('controls-user-inactive');
                controls.classList.remove('controls-user-active');
            },3000);

            container.addEventListener('mousemove', function(){
                if(controls.classList.contains('controls-user-inactive')) {
                    controls.classList.add('controls-user-active');
                    controls.classList.remove('controls-user-inactive');
                    setTimeout(function () {
                        controls.classList.add('controls-user-inactive');
                        controls.classList.remove('controls-user-active');
                    }, 3000);
                }
            }, false);

            video.addEventListener('playing', function () {
                seek.classList.add('light');
            }, false);

            if (video.muted) {
                mutebutton.classList.add('icon-volume');
                mutebutton.classList.remove('icon-volume-2');
                volume.value = 0;
            }
            else {
                mutebutton.classList.add('icon-volume-2');
                mutebutton.classList.remove('icon-volume');
            }

            function playpause(e) {
                if (video.paused) {
                    video.play();
                    playbutton.classList.add('icon-pause');
                    playbutton.classList.remove('icon-play');
                    seek.classList.add('light');
                }
                else {
                    video.pause();
                    playbutton.classList.add('icon-play');
                    playbutton.classList.remove('icon-pause');
                    seek.classList.remove('light');
                }
            }

            playbutton.addEventListener('click', playpause, false);
            video.addEventListener('click', playpause, false);

            captionButton.addEventListener('click', function() {
                var regions = document.getElementsByClassName("captionRegion");
                if(regions) {
                    console.warn(regions);
                    [].forEach.call(regions, function(captionRegion) {
                        if(captionRegion.style.display === 'none') {
                            captionRegion.style.display = 'table';
                        } else {
                            captionRegion.style.display = 'none';
                        }
                    });
                }
            }, false);

            mutebutton.addEventListener('click', function () {
                if (video.muted) {
                    video.muted  = false;
                    mutebutton.classList.add('icon-volume-2');
                    mutebutton.classList.remove('icon-volume');
                    volume.value = vval;
                }
                else {
                    video.muted  = true;
                    volume.value = 0;
                    mutebutton.classList.add('icon-volume');
                    mutebutton.classList.remove('icon-volume-2');
                }
            }, false);

            var isFullscreen = false;
            fullscreenbutton.addEventListener('click', function () {
                if (!isFullscreen) {
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                    }
                    else if (video.mozRequestFullScreen) {
                        container.mozRequestFullScreen(); // Firefox
                    }
                    else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen(); // Chrome and Safari
                    }
                    isFullscreen = true;
                    fullscreenbutton.classList.remove('icon-fullscreen-alt');
                    fullscreenbutton.classList.add('icon-fullscreen-exit-alt');
                }
                else {

                    if (document.cancelFullScreen) {
                        document.cancelFullScreen();
                    }
                    else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    }
                    else if (document.webkitCancelFullScreen) {
                        document.webkitCancelFullScreen();
                    }
                    isFullscreen = false;
                    fullscreenbutton.classList.add('icon-fullscreen-alt');
                    fullscreenbutton.classList.remove('icon-fullscreen-exit-alt');
                }

            }, false);

            //change video time when e changes
            seek.addEventListener('change', function () {
                var time          = video.duration * (seek.value / 100);
                video.currentTime = time;
            }, false);

            seek.addEventListener('mousedown', function () {
                video.pause();
            }, false);
            seek.addEventListener('mouseup', function () {
                video.play();
                //if the user plays the video without clicking play, by starting directly with specifying a point of time on the seekbar, make sure the play button becomes a pause button
                playbutton.classList.remove('icon-play');
                playbutton.classList.add('icon-pause');
            }, false);

            //change seek position as video plays
            video.addEventListener('timeupdate', function () {
                var value  = (100 / video.duration) * video.currentTime;
                seek.value = value;
            }, false);

            //update progress bar as video plays
            video.addEventListener('timeupdate', function() {
                var percent = Math.floor((100 / video.duration) * video.currentTime);
                progressbar.value = percent;
                progressbar.getElementsByTagName('span')[0].innerHTML = percent;
            }, false);

            volume.addEventListener('change', function () {
                video.volume = this.value;
                vval         = this.value;
                if (this.value === 0) {
                    video.muted = true;
                    mutebutton.classList.add('icon-volume');
                    mutebutton.classList.remove('icon-volume-2');
                }
                else if (this.value !== 0) {
                    video.muted = false;
                    mutebutton.classList.add('icon-volume-2');
                    mutebutton.classList.remove('icon-volume');
                }
            }, false);

            video.addEventListener('ended', function () {
                video.pause();
                video.currentTime = 0;
                playbutton.classList.add('icon-play');
                playbutton.classList.remove('icon-pause');
                seek.classList.remove('light');
            });
        },
    }
};
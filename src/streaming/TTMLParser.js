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
MediaPlayer.utils.TTMLParser = function() {
    "use strict";

    /*
     * This TTML parser follows "TTML Simple Delivery Profile for Closed Captions (US)" spec - http://www.w3.org/TR/ttml10-sdp-us/
     * */
    var SECONDS_IN_HOUR = 60 * 60,
        SECONDS_IN_MIN = 60,
        // R0028 - A document must not contain a <timeExpression> value that does not conform to the subset of clock-time that
        // matches either of the following patterns: hh:mm:ss.mss or hh:mm:ss:ff, where hh denotes hours (00-23),
        // mm denotes minutes (00-59), ss denotes seconds (00-59), mss denotes milliseconds (000-999), and ff denotes frames (00-frameRate - 1).
        // R0030 - For time expressions that use the hh:mm:ss.mss format, the following constraints apply:
        // - Exactly 2 digits must be used in each of the hours, minutes, and second components (include leading zeros).
        // - Exactly 3 decimal places must be used for the milliseconds component (include leading zeros).
        // R0031 -For time expressions that use the hh:mm:ss:ff format, the following constraints apply:
        // - Exactly 2 digits must be used in each of the hours, minutes, second, and frame components (include leading zeros).
        timingRegex = /^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])((\.[0-9][0-9][0-9])|(:[0-9][0-9]))$/,
        ttml,
        ttmlStylings,
        ttmlLayout,

        parseTimings = function(timingStr) {
            var test = timingRegex.test(timingStr),
                timeParts,
                parsedTime,
                frameRate;

            if (!test) {
                return NaN;
            }

            timeParts = timingStr.split(":");

            parsedTime = (parseFloat(timeParts[0]) * SECONDS_IN_HOUR +
            parseFloat(timeParts[1]) * SECONDS_IN_MIN +
            parseFloat(timeParts[2]));

            // R0031 -For time expressions that use the hh:mm:ss:ff format, the following constraints apply:
            //  - A ttp:frameRate attribute must be present on the tt element.
            //  - A ttp:frameRateMultiplier attribute may be present on the tt element.
            if (timeParts[3]) {
                frameRate = ttml['tt@ttp:frameRate'];
                if (frameRate && !isNaN(frameRate)) {
                    parsedTime += parseFloat(timeParts[3]) / frameRate;
                } else {
                    return NaN;
                }
            }
            return parsedTime;
        },

        passStructuralConstraints = function() {
            var passed = false,
                hasTt = ttml.hasOwnProperty("tt"),
                hasHead = hasTt ? ttml.tt.hasOwnProperty("head") : false,
                hasLayout = hasHead ? ttml.tt.head.hasOwnProperty("layout") : false,
                hasStyling = hasHead ? ttml.tt.head.hasOwnProperty("styling") : false,
                hasBody = hasTt ? ttml.tt.hasOwnProperty("body") : false;

            // R001 - A document must contain a tt element.
            // R002 - A document must contain both a head and body element.
            // R003 - A document must contain both a styling and a layout element.
            if (hasTt && hasHead && hasLayout && hasStyling && hasBody) {
                passed = true;
            }
            return passed;
        },

        getNamespacePrefix = function(json, ns) {
            var r = Object.keys(json)
                .filter(function(k) {
                    return k.split(":")[0] === "tt@xmlns" && json[k] === ns;
                }).map(function(k) {
                    return k.split(":")[1];
                });
            if (r.length != 1) {
                return null;
            }
            return r[0];
        },

        camelCaseToDash = function(key) {
            return key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        },

        // Get the style set by comparing the style IDs available.
        getStyle = function(ttmlStylings, cueStyleID) {
            // For every styles available.
            for (var j = 0; j < ttmlStylings.length; j++) {
                var currStyle = ttmlStylings[j];
                if (currStyle['style@xml:id'] === cueStyleID) {
                    // Return the style corresponding to the ID in parameter.
                    return currStyle;
                }
            }
        },

        // Get the region set by comparing the region IDs available.
        getRegion = function(ttmlLayout, cueRegionID) {
            // For every region available.
            for (var j = 0; j < ttmlLayout.length; j++) {
                var currReg = ttmlLayout[j];
                if (currReg['region@xml:id'] === cueRegionID) {
                    // Return the region corresponding to the ID in parameter.
                    return currReg;
                }
            }
        },

        // Compute the style properties to return an array with the cleaned properties
        computeStyle = function(cueStyle) {
            var properties = [];

            for (var key in cueStyle) {
                if (cueStyle.hasOwnProperty(key)) {
                    var property = cueStyle[key];
                    var result;

                    //Clean the properties from the parsing
                    key = key.replace("style@tts:", "");
                    key = key.replace("style@xml:", "");
                    // Clean the properties' names
                    key = camelCaseToDash(key);
                    // Not needed to add these.
                    if (key === 'style' || key === 'id') {
                        continue;
                    }
                    // Add quotes for font-family
                    if (key === "font-family") {
                        result = key + ":'" + property + "';";
                    } else {
                        result = key + ":" + property + ";";
                    }
                    properties.push(result);
                }
            }
            return properties;
        },

        // Compute the region properties to return an array with the cleaned properties
        computeRegion = function(ttmlStylings, cueRegion) {
            var properties = [];

            for (var key in cueRegion) {
                if (!cueRegion.hasOwnProperty(key)) {
                    continue;
                }

                var property = cueRegion[key];

                //Clean the properties from the parsing
                key = key.replace("region@tts:", "");
                key = key.replace("region@xml:", "");
                // Clean the properties' names
                key = camelCaseToDash(key);
                // Not needed to add these.
                if (key === "writing-mode" || key === "show-background" || key === "region" || key === "id") {
                    continue;
                }
                /***
                 * - Extent property corresponds to width and height
                 * - Origin property corresponds to top and left
                 * - DisplayAlign property corresponds to vertical-align
                 * - WritingMode is not yet implemented (for CSS3, to come)
                 * - Style will give to the region the style properties from the style selected
                 * ***/
                if (key === "extent") {
                    var coords = property.split(/\s/);
                    properties.push("width: " + coords[0] + ';');
                    properties.push("height :" + coords[1] + ';');
                } else if (key === "origin") {
                    var coords = property.split(/\s/);
                    properties.push("left: " + coords[0] + ';');
                    properties.push("top :" + coords[1] + ';');
                } else if (key === "display-align") {
                    var displayAlign = {
                        before: "vertical-align: top;",
                        center: "vertical-align: middle;",
                        after: "vertical-align: bottom"
                    };
                    properties.push(displayAlign[property]);
                } else if (key === "style") {
                    var styleFromID = getStyleFromID(property);
                    properties.push(styleFromID);
                } else {
                    var result;
                    result = key + ':' + property + ';';
                    properties.push(result);
                }
            }
            return properties;
        },

        // Return the computed style from a certain ID
        getStyleFromID = function(id) {
            var cueStyle = getStyle(ttmlStylings, id);
            if (cueStyle) {
                // Compute the style for the cue in CSS form
                return computeStyle(cueStyle);
            }
        },

        // Return the computed region from a certain ID
        getRegionFromID = function(ttmlLayout, ttmlStylings, id) {
            var cueRegion = getRegion(ttmlLayout, id);
            if (cueRegion) {
                // Compute the style for the cue in CSS form
                return computeRegion(ttmlStylings, cueRegion);
            }
        },

        internalParse = function(data) {
            var captionArray = [],
                errorMsg,
                cues,
                startTime,
                endTime,
                cueStyleID,
                cueRegionID,
                bodyStyleProperties = [],
                divStyleProperties = [],
                divRegionProperties = [],
                paragraphStyleProperties = [],
                paragraphRegionProperties = [],
                nsttp,
                cellResolution,
                cellUnit,
                videoHeight,
                videoWidth,
                textData;

            // **** Check the document Structure ***
            // Parse the TTML in a JSON object.
            ttml = JSON.parse(xml2json_hi(parseXml(data), ""));
            ttmlLayout = ttml.tt.head.layout;
            ttmlStylings = ttml.tt.head.styling;

            if (!passStructuralConstraints()) {
                errorMsg = "TTML document has incorrect structure";
                throw errorMsg;
            }

            cellResolution = ttml["tt@ttp:cellResolution"].split(" ").map(parseFloat);

            videoWidth = document.getElementById('videoPlayer').offsetWidth;
            videoHeight = document.getElementById('videoPlayer').offsetHeight;

            cellUnit = [videoWidth / cellResolution[0], videoHeight / cellResolution[1]];

            ttmlLayout = [].concat(ttmlLayout);
            ttmlStylings = [].concat(ttmlStylings);

            // Get the namespace prefixe.
            nsttp = getNamespacePrefix(ttml, "http://www.w3.org/ns/ttml#parameter");

            // Set the framerate.
            if (ttml.hasOwnProperty("tt@" + nsttp + ":frameRate")) {
                ttml.frameRate = parseInt(ttml["tt@" + nsttp + ":frameRate"], 10);
            }
            cues = (ttml.tt.body.div) ? ttml.tt.body.div : ttml.tt.body;

            // If only one cue, put it in an array
            cues = [].concat(cues);

            // If body has a style
            var bodyStyleID = ttml.tt['body@style'];
            if (bodyStyleID) {
                bodyStyleProperties = getStyleFromID(bodyStyleID);
            }

            // If div has a style
            var divStyleID = ttml.tt.body['div@style'];
            if (divStyleID) {
                divStyleProperties = getStyleFromID(divStyleID);
            }
            // If div has a region
            var divRegionID = ttml.tt.body['div@region'];
            if (divRegionID) {
                divRegionProperties = getRegionFromID(ttmlLayout, ttmlStylings, divRegionID);
            }

            // Check if cues is not empty or undefined
            if (!cues || cues.length === 0) {
                errorMsg = "TTML document does not contain any cues";
                throw errorMsg;
            }

            // Parsing of every cue
            cues.forEach(function(cue) {
                // Obtain the start and end time of the cue
                startTime = parseTimings(cue['p@begin']);
                endTime = parseTimings(cue['p@end']);
                // Obtain the style and region assigned to the cue if there is
                cueStyleID = cue['p@style'];
                cueRegionID = cue['p@region'];

                // Error if timing is not specified
                if (isNaN(startTime) || isNaN(endTime)) {
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                // Find the right style for our cue
                if (cueStyleID) {
                    paragraphStyleProperties = getStyleFromID(cueStyleID);
                }

                // Find the right region for our cue
                if (cueRegionID) {
                    paragraphRegionProperties = getRegionFromID(ttmlLayout, ttmlStylings, cueRegionID);
                }

                // Line padding
                paragraphStyleProperties.forEach(function(d, index) {
                    if (d.indexOf("line-padding") > -1) {
                        var value = parseFloat(d.slice(d.indexOf(":") + 1, d.indexOf('c')));
                        var valuePx = value * cellUnit[0] + "px;";
                        paragraphStyleProperties.splice(index, 1);
                        paragraphStyleProperties.push("padding-left:" + valuePx);
                        paragraphStyleProperties.push("padding-right:" + valuePx);
                    }
                });

                if (cue["smpte:backgroundImage"] !== undefined) {
                    var images = ttml.tt.head.metadata.image_asArray;
                    for (var j = 0; j < images.length; j += 1) {
                        if (("#" + images[j]["p@xml:id"]) == cue["smpte:backgroundImage"]) {
                            captionArray.push({
                                start: startTime,
                                end: endTime,
                                id: images[j]["p@xml:id"],
                                data: "data:image/" + images[j].imagetype.toLowerCase() + ";base64, " + images[j].__text,
                                type: "image",
                                bodyStyle: bodyStyleProperties,
                                divStyle: divStyleProperties,
                                divRegion: divRegionProperties,
                                paragraphRegion: paragraphRegionProperties
                            });
                        }
                    }
                }
                // If cues are not SMPTE images, extract the text
                else {
                    cue.p = [].concat(cue.p);

                    textData = cue.p.map(function(caption) {
                        // Add a <br/> element for a new line
                        if (caption.hasOwnProperty('br')) {
                            return document.createElement('br');
                        }
                        // Create the inline span element
                        else if (caption.hasOwnProperty('span')) {
                            var inlineSpan = document.createElement('span');
                            // Set the id of the span
                            if (caption.hasOwnProperty('span@id')) {
                                inlineSpan.id = caption['span@id'];
                            }
                            // Compute the style of the span
                            if (caption.hasOwnProperty('span@style')) {
                                var styleBlock = getStyleFromID(caption['span@style']);
                                inlineSpan.style.cssText = styleBlock.join(" ");
                            }
                            inlineSpan.innerHTML = caption['span'];

                            // Create a div that will wrap around the span to control the text alignment.
                            var wrapper = document.createElement('div');
                            styleBlock.forEach(function(d) {
                                if (d.indexOf('text-align') > -1) {
                                    wrapper.style.cssText = d;
                                    wrapper.appendChild(inlineSpan);
                                }
                            });
                            if (!wrapper.style.cssText) {
                                return inlineSpan
                            } else {
                                return wrapper;
                            }

                        }
                        // If it is only text in a <p>
                        else {
                            var spanElem = document.createElement('span');
                            spanElem.className = 'text';

                            spanElem.style.cssText = paragraphStyleProperties.join(" ");
                            spanElem.innerHTML = caption;

                            // Create a div that will wrap around the span to control the text alignment.
                            var wrapper = document.createElement('div');
                            paragraphStyleProperties.forEach(function(d) {
                                if (d.indexOf('text-align') > -1) {
                                    wrapper.style.cssText = d;
                                    wrapper.appendChild(spanElem);
                                }
                            });


                            if (!wrapper.style.cssText) {
                                return spanElem;
                            } else {
                                return wrapper;
                            }

                        }
                    });

                    captionArray.push({
                        start: startTime,
                        end: endTime,
                        data: textData,
                        type: "text",
                        bodyStyle: bodyStyleProperties,
                        divStyle: divStyleProperties,
                        divRegion: divRegionProperties,
                        paragraphRegion: paragraphRegionProperties
                    });
                }
            });

            return captionArray;
        };

    return {
        parse: internalParse
    };
};
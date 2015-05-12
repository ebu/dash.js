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
MediaPlayer.utils.TTMLParser = function () {
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

        passStructuralConstraints = function () {
            var passed = false,
                hasTt = ttml.hasOwnProperty("tt"),
                hasHead = hasTt ? ttml.tt.hasOwnProperty("head") : false,
                hasLayout = hasHead ? ttml.tt.head.hasOwnProperty("layout") : false,
                hasStyling = hasHead ? ttml.tt.head.hasOwnProperty("styling") : false,
                hasBody = hasTt ? ttml.tt.hasOwnProperty("body") : false;
            /* extend the support to other profiles
             hasProfile = hasHead ? ttml.tt.head.hasOwnProperty("profile") : false;
             */

            // R001 - A document must contain a tt element.
            // R002 - A document must contain both a head and body element.
            // R003 - A document must contain both a styling and a layout element.
            if (hasTt && hasHead && hasLayout && hasStyling && hasBody) {
                passed = true;
            }

            // R0008 - A document must contain a ttp:profile element where the use attribute of that element is specified as http://www.w3.org/ns/ttml/profile/sdp-us.
            /* extend the support to other profiles
             if (passed) {
             passed = hasProfile && (ttml.tt.head.profile.use === "http://www.w3.org/ns/ttml/profile/sdp-us");
             }*/
            return passed;
        },

        getNamespacePrefix = function(json, ns) {
            var r = Object.keys(json)
                .filter(function(k){
                    return k.split(":")[0] === "tt@xmlns" && json[k] === ns;
                }).map(function(k){
                    return k.split(":")[1];
                });
            if (r.length != 1) {
                return null;
            }
            return r[0];
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
        computeStyle = function(cueStyle){
            var properties = [];

            for (var key in cueStyle) {
                if (cueStyle.hasOwnProperty(key)) {
                    var property = cueStyle[key];
                    var result;

                    //Clean the properties from the parsing
                    key = key.replace("style@tts:", "");
                    key = key.replace("style@xml:", "");
                    key = key.toLowerCase();

                    // Clean the properties' names
                    if (key.indexOf("font") > -1 || key.indexOf("line") > -1 || key.indexOf("text") > -1) {
                        key = key.substr(0, 4) + "-" + key.substr(4);
                    } else if (key.indexOf("background") > -1) {
                        key = key.substr(0, 10) + "-" + key.substr(10);
                    } else if (key.indexOf("unicode") > -1) {
                        key = key.substr(0, 7) + "-" + key.substr(7);
                    } else if (key.indexOf('style') > -1 || key.indexOf('id') > -1) {
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
        computeRegion = function(ttmlStylings, cueRegion){
            var properties = [];

            for (var key in cueRegion) {
                if (cueRegion.hasOwnProperty(key)) {
                    var property = cueRegion[key];

                    //Clean the properties from the parsing
                    key = key.replace("region@tts:", "");
                    key = key.replace("region@xml:", "");
                    key = key.toLowerCase();

                    // Extent property corresponds to width and height
                    // Origin property corresponds to top and left
                    // DisplayAlign property corresponds to vertical-align
                    // WritingMode is not yet implemented (for CSS3, to come)
                    // Style will give to the region the style properties from the style selected
                    if (key.indexOf("extent") > -1) {
                        var coords = property.split(/\s/);
                        properties.push("width: " + coords[0] + ';');
                        properties.push("height :" + coords[1] + ';');
                    } else if (key.indexOf("origin") > -1) {
                        var coords = property.split(/\s/);
                        properties.push("left: " + coords[0] + ';');
                        properties.push("top :" + coords[1] + ';');
                    } else if(key.indexOf("displayalign") > -1){
                        switch(property){
                            case "before":
                                properties.push("vertical-align: top;");
                                break;
                            case "center":
                                properties.push("vertical-align: middle;");
                                break;
                            case "after":
                                properties.push("vertical-align: bottom;");
                                break;
                        }
                    } else if(key.indexOf("writingmode") > -1 || key.indexOf("showbackground") > -1){
                        continue;
                    } else if(key.indexOf("region") > -1 || key.indexOf("id") > -1){
                        continue;
                    } else if(key.indexOf("style") > -1){
                        var styleFromID = computeStyle(getStyle(ttmlStylings, property));
                        for(var i = 0; i<styleFromID.length; i++){
                            properties.push(styleFromID[i]);
                        }
                        continue;
                    } else {
                        var result;
                        result = key + ':' + property + ';';
                        properties.push(result);
                    }
                }
            }

            return properties;
        },

        internalParse = function(data) {
            var captionArray = [],
                errorMsg,
                cues,
                cue,
                startTime,
                endTime,
                cueStyleID,
                cueRegionID,
                cueStyle,
                cueRegion,
                bodyStyleProperties = [],
                divStyleProperties = [],
                divRegionProperties = [],
                paragraphStyleProperties = [],
                paragraphRegionProperties = [],
                nsttp,
                textData;


            // **** Check the document Structure ***
            // Parse the TTML in a JSON object.
            ttml = JSON.parse(xml2json_hi(parseXml(data), ""));
            ttmlLayout = ttml.tt.head.layout;
            ttmlStylings = ttml.tt.head.styling;

            // If only one item, transform into an array
            ttmlLayout = [].concat(ttmlLayout);
            ttmlStylings = [].concat(ttmlStylings);

            //Check that the document follow the proper constraints.
            if (!passStructuralConstraints()) {
                errorMsg = "TTML document has incorrect structure";
                throw errorMsg;
            }

            //Get the namespace prefixe.
            nsttp = getNamespacePrefix(ttml, "http://www.w3.org/ns/ttml#parameter");

            // Set the framerate.
            if (ttml.hasOwnProperty("tt@" + nsttp + ":frameRate")) {
                ttml.frameRate = parseInt(ttml["tt@" + nsttp + ":frameRate"], 10);
            }

            // *** Extract the cues ***

            if(ttml.tt.body.div){
                cues = ttml.tt.body.div;
            }else{
                cues = ttml.tt.body;
            }

            cues = [].concat(cues);

            // If body has a style
            if(ttml.tt['body@style']){
                var bodyStyleID = ttml.tt['body@style'];
                if(bodyStyleID) {
                    // Get the corresponding style array
                    var bodyStyle = getStyle(ttmlStylings, bodyStyleID);
                    if(bodyStyle) {
                        // Compute the style from the selected set
                        bodyStyleProperties = computeStyle(bodyStyle);
                    }
                }
                // If div has a style
            } else if (ttml.tt.body['div@style']){
                var divStyleID = ttml.tt.body['div@style'];
                if(divStyleID) {
                    // Get the corresponding style array
                    var divStyle = getStyle(ttmlStylings, divStyleID);
                    if (divStyle) {
                        // Compute the style from the selected set
                        divStyleProperties = computeStyle(divStyle);
                    }
                }
            }

            // If div has a region
            if(ttml.tt.body['div@region']){
                var divRegionID = ttml.tt.body['div@region'];
                if(divRegionID) {
                    // Get the corresponding region array
                    var divRegion = getRegion(ttmlLayout, divRegionID);
                    if (divRegion) {
                        // Compute the region from the selected set
                        divRegionProperties = computeRegion(ttmlStylings, divRegion);
                    }
                }
            }

            // Check if cues is not empty or undefined
            if (!cues || cues.length === 0) {
                errorMsg = "TTML document does not contain any cues";
                throw errorMsg;
            }

            // Parsing of every cue
            for (var i = 0; i < cues.length; i += 1) {
                cue = cues[i];
                // Obtain the start and end time of the cue
                startTime = parseTimings(cue['p@begin']);
                endTime = parseTimings(cue['p@end']);
                // Obtain the style and region assigned to the cue if there is
                cueStyleID = cue['p@style'];
                cueRegionID = cue['p@region'];

                // Error if timing is not specified
                // TODO: EBU-TT-D accept this situation
                if (isNaN(startTime) || isNaN(endTime)) {
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                // Find the right style for our cue
                if(cueStyleID) {
                    cueStyle = getStyle(ttmlStylings, cueStyleID);
                    if(cueStyle) {
                        // Compute the style for the cue in CSS form
                        paragraphStyleProperties = computeStyle(cueStyle);
                    }
                }

                // Find the right region for our cue
                if(cueRegionID) {
                    cueRegion = getRegion(ttmlLayout, cueRegionID);
                    if(cueRegion) {
                        // Compute the region style for the cue in CSS form
                        paragraphRegionProperties = computeRegion(ttmlStylings, cueRegion);
                    }
                }

                //TODO adapt images cues with the new parser.
                if(cue["smpte:backgroundImage"]!== undefined)
                {
                    var images = ttml.tt.head.metadata.image_asArray;
                    for (var j = 0; j < images.length; j += 1) {
                        if(("#"+images[j]["p@xml:id"]) == cue["smpte:backgroundImage"]) {
                            captionArray.push({
                                start: startTime,
                                end: endTime,
                                id:images[j]["p@xml:id"],
                                data: "data:image/"+images[j].imagetype.toLowerCase()+";base64, " + images[j].__text,
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

                    textData = [];
                    for(var k = 0; k < cue.p.length; k += 1){
                        // Add a <br/> element for a new line
                        if(cue.p[k].hasOwnProperty('br')){
                            textData.push(document.createElement('br'));
                            continue;
                        }
                        // Create the inline span element
                        else if(cue.p[k].hasOwnProperty('span')){
                            var inlineSpan = document.createElement('span');
                            // Set the id of the span
                            if(cue.p[k].hasOwnProperty('span@id')){
                                inlineSpan.id = cue.p[k]['span@id'];
                            }
                            // Compute the style of the span
                            if(cue.p[k].hasOwnProperty('span@style')){
                                // Get the style set from the span@style ID
                                var spanStyle = getStyle(ttmlStylings, cue.p[k]['span@style']);
                                if(spanStyle){
                                    // Compute the style from the style ID
                                    var styleBlock = computeStyle(spanStyle);

                                    // Insert into the text the style computed.
                                    inlineSpan.style.cssText = styleBlock.join(" ");
                                }
                            }
                            inlineSpan.innerHTML = cue.p[k]['span'];
                            textData.push(inlineSpan);
                            continue;
                        }
                        // If it is only text in a <p>
                        else {
                            var spanElem = document.createElement('span');
                            spanElem.className = 'text';
                            spanElem.style.cssText = paragraphStyleProperties.join(" ");
                            spanElem.innerHTML = cue.p[k];
                            textData.push(spanElem);
                        }
                    }
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
            }

            return captionArray;
        };

    return {
        parse: internalParse
    };
};

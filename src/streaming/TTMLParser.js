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
     * This TTML parser follows "EBU-TT-D SUBTITLING DISTRIBUTION FORMAT - tech3380" spec - https://tech.ebu.ch/docs/tech/tech3380.pdf.
     * */
    var SECONDS_IN_HOUR = 60 * 60,
        SECONDS_IN_MIN = 60,
        timingRegex = /^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])((\.[0-9][0-9][0-9])|(\.[0-9][0-9]))$/,
        ttml,
        ttmlStylings,
        ttmlLayout,
        cellResolution,
        cellUnit,
        showBackground,

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
                if (currStyle['style@xml:id'] === cueStyleID || currStyle['style@id'] === cueStyleID) {
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
                if (currReg['region@xml:id'] === cueRegionID || currReg['region@id'] === cueRegionID) {
                    // Return the region corresponding to the ID in parameter.
                    return currReg;
                }
            }
        },

        // Compute the style properties to return an array with the cleaned properties.
        computeStyle = function(cueStyle) {
            var properties = [];
            for (var key in cueStyle) {
                if (cueStyle.hasOwnProperty(key)) {
                    var property = cueStyle[key];

                    //Clean the properties from the parsing.
                    key = key.replace("style@tts:", "");
                    key = key.replace("style@xml:", "");
                    key = key.replace("style@ebutts:", "");
                    key = key.replace("style@", "");

                    // Clean the properties' names.
                    key = camelCaseToDash(key);
                    // Not needed to add these.
                    if (key === 'style' || key === 'id') {
                        continue;
                    }
                    // Check for line-padding and font-family properties.
                    if (key === 'line-padding') {
                        // Use padding-left/right for line-padding.
                        var value = parseFloat(property.slice(property.indexOf(":") + 1, property.indexOf('c')));
                        var valuePx = value * cellUnit[0] + "px;";
                        properties.push("padding-left:" + valuePx + " padding-right:" + valuePx);
                    } else if (key === "font-family") {
                        var font;
                        switch (property){
                            case "monospace":
                                font = 'font-family: monospace;' ;
                                break;
                            case "sansSerif":
                                font = 'font-family: sans-serif;';
                                break;
                            case "serif":
                                font = 'font-family: serif;';
                                break;
                            case "monospaceSansSerif":
                                font = 'font-family: monospace, sans-serif;';
                                break;
                            case "monospaceSerif":
                                font = 'font-family: monospace, serif;';
                                break;
                            case "proportionalSansSerif":
                                font = 'font-family: Arial;';
                                break;
                            case "proportionalSerif":
                                font = 'font-family: Times New Roman;';
                                break;
                            case "default":
                                font = 'font-family: monospace, sans-serif;';
                                break;
                            default:
                                font = 'font-family: '+ property + ';';
                                break;
                        }
                        properties.push(font);
                    } else if (key === 'wrap-option'){
                        var wrapOption = {
                            wrap: "white-space: normal;",
                            noWrap: "white-space: nowrap;"
                        };
                        properties.push(wrapOption[property]);
                    } else if(key === "unicode-bidi") {
                        var unicodeBidi = {
                            normal: "unicode-bidi: normal;",
                            embed: "unicode-bidi: embed;",
                            bidiOverride: "unicode-bidi: bidi-override;"
                        };
                        properties.push(unicodeBidi[property]);
                    } else {
                        properties.push(key + ":" + property + ";");
                    }
                }
            }
            return properties;
        },

        // Compute the region properties to return an array with the cleaned properties.
        computeRegion = function(ttmlStylings, cueRegion) {
            var properties = [];
            for (var key in cueRegion) {
                if (!cueRegion.hasOwnProperty(key)) {
                    continue;
                }

                var property = cueRegion[key];

                //Clean the properties from the parsing.
                key = key.replace("region@tts:", "");
                key = key.replace("region@xml:", "");
                key = key.replace("region@:", "");
                // Clean the properties' names.
                key = camelCaseToDash(key);
                // Not needed to add these.
                if (key === "region" || key === "id") {
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
                        after: "vertical-align: bottom;"
                    };
                    properties.push(displayAlign[property]);
                } else if(key === 'writing-mode'){
                        var writingMode = {
                            lrtb: "-ms-writing-mode: lr-tb;\
                                   -webkit-writing-mode: horizontal-tb;\
                                   -moz-writing-mode: horizontal-tb;\
                                   -ms-writing-mode: horizontal-tb;\
                                   writing-mode: horizontal-tb;",
                            rltb: "-ms-writing-mode: rl-tb;\
                                   -webkit-writing-mode: horizontal-tb;\
                                   -moz-writing-mode: horizontal-tb;\
                                   -ms-writing-mode: horizontal-tb;\
                                   writing-mode: horizontal-tb;\
                                   direction: rtl;\
                                   unicode-bidi: bidi-override;",
                            tbrl: "-ms-writing-mode: tb-rl; /* old syntax. IE */ \
                                   -webkit-writing-mode: vertical-rl;\
                                   -moz-writing-mode: vertical-rl;\
                                   -ms-writing-mode: vertical-rl;\
                                   writing-mode: vertical-rl; /* new syntax */\
                                   -webkit-text-orientation: upright;\
                                   -moz-text-orientation: upright;\
                                   -ms-text-orientation: upright;\
                                   text-orientation: upright;",
                            tblr: "-ms-writing-mode: tb-lr; /* old syntax. IE */ \
                                   -webkit-writing-mode: vertical-lr;\
                                   -moz-writing-mode: vertical-lr;\
                                   -ms-writing-mode: vertical-lr;\
                                   writing-mode: vertical-lr; /* new syntax */\
                                   -webkit-text-orientation: upright;\
                                   -moz-text-orientation: upright;\
                                   -ms-text-orientation: upright;\
                                   text-orientation: upright;",
                            lr: "-ms-writing-mode: lr-tb;\
                                 -webkit-writing-mode: horizontal-tb;\
                                 -moz-writing-mode: horizontal-tb;\
                                 -ms-writing-mode: horizontal-tb;\
                                 writing-mode: horizontal-tb;",
                            rl: "-ms-writing-mode: rl-tb;\
                                 -webkit-writing-mode: horizontal-tb;\
                                 -moz-writing-mode: horizontal-tb;\
                                 -ms-writing-mode: horizontal-tb;\
                                 writing-mode: horizontal-tb;\
                                 direction: rtl;",
                            tb: "-ms-writing-mode: tb-rl; /* old syntax. IE */ \
                                 -webkit-writing-mode: vertical-rl;\
                                 -moz-writing-mode: vertical-rl;\
                                 -ms-writing-mode: vertical-rl;\
                                 writing-mode: vertical-rl; /* new syntax */\
                                 -webkit-text-orientation: upright;\
                                 -moz-text-orientation: upright;\
                                 -ms-text-orientation: upright;\
                                 text-orientation: upright;"
                        };
                        properties.push(writingMode[property]);
                } else if (key === "style") {
                    var styleFromID = getStyleFromID(property);
                    styleFromID.forEach(function(prop){
                        properties.push(prop);
                    });
                } else if (key === "show-background"){
                    showBackground = (property === "always")? true : false;
                } else {
                    var result;
                    result = key + ':' + property + ';';
                    properties.push(result);
                }
            }
            if (showBackground === undefined){
              showBackground = false;
            }
            return properties;
        },

        // Return the computed style from a certain ID.
        getStyleFromID = function(id) {
            var cueStyle = getStyle(ttmlStylings, id);
            if (cueStyle) {
                // Compute the style for the cue in CSS form.
                return computeStyle(cueStyle);
            }
        },

        // Return the computed region from a certain ID.
        getRegionFromID = function(ttmlLayout, ttmlStylings, id) {
            var cueRegion = getRegion(ttmlLayout, id);
            if (cueRegion) {
                // Compute the style for the cue in CSS form.
                return computeRegion(ttmlStylings, cueRegion);
            }
        },

        arrayContains = function(text, array){
            var res = false;
            array.forEach(function(str){
                if(str.indexOf(text) > -1){
                    res = true;
                }
            });
            return res;
        },

        indexOfProperty = function(text, array){
            return array.indexOf(text);
        },

        propertyFromArray = function(text, array){
            var res = '';
            array.forEach(function(str){
                if(str.indexOf(text) > -1){
                    res = str;
                }
            });
            return res;
        },

        internalParse = function(data) {
            var captionArray = [],
                errorMsg,
                cues,
                pStartTime,
                pEndTime,
                pStyleID,
                pRegionID,
                divRegionProperties = [],
                paragraphStyleProperties = [],
                paragraphRegionProperties = [],
                nsttp,
                videoHeight,
                videoWidth;

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
            // Extract the cues.
            cues = (ttml.tt.body.div) ? ttml.tt.body.div : ttml.tt.body;


            // If only one cue, put it in an array.
            cues = [].concat(cues);

            // Check if cues is not empty or undefined.
            if (!cues || cues.length === 0) {
                errorMsg = "TTML document does not contain any cues";
                throw errorMsg;
            }

            // If body has a style.
            var bodyStyleID = ttml.tt['body@style'];

            // If div has a style.
            var divStyleID = ttml.tt.body['div@style'];

            // If div has a region.
            var divRegionID = ttml.tt.body['div@region'];
            if (divRegionID) {
                divRegionProperties = getRegionFromID(ttmlLayout, ttmlStylings, divRegionID);
            }

            // TODO: Parse timings on span elements.
            // Parsing of every cue.
            cues.forEach(function(cue) {
                // Obtain the start and end time of the cue.
                pStartTime = parseTimings(cue['p@begin']);
                pEndTime = parseTimings(cue['p@end']);

                // TODO: check for span, if yes, check for timings information

                // Obtain the style and region assigned to the cue if there is one.
                pStyleID = cue['p@style'];
                pRegionID = cue['p@region'];

                // Error if timing is not specified.
                if (isNaN(pStartTime) || isNaN(pEndTime)) {
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                /*** If p specify a style and / or a region. ***/

                // Find the right region for our cue.
                var outerSpanVH = '';
                if (pRegionID) {
                    paragraphRegionProperties = getRegionFromID(ttmlLayout, ttmlStylings, pRegionID);
                }
                if (divRegionID) {
                    paragraphRegionProperties = paragraphRegionProperties.concat(getRegionFromID(ttmlLayout, ttmlStylings, pRegionID));
                }

                // Find the right style for our cue.
                if (pStyleID) {
                    paragraphStyleProperties = getStyleFromID(pStyleID);
                }
                if (divStyleID ) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getStyleFromID(divStyleID));
                }
                if (bodyStyleID ) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getStyleFromID(bodyStyleID));
                }

                // Line-height of outerSpan needs to be set so that inner content
                // can be vertically aligned to something.
                var height = 'height';
                if(arrayContains(height, paragraphRegionProperties)){
                    var value = propertyFromArray(height, paragraphRegionProperties);
                    // TODO: Change so it is dynamic and elegant!
                    // videoHeight in 16:9 display, in vh unit.
                    var videoHeightVH = 90;
                    value = Number(value.match(/(\d+)/)[0]);
                    value = value/100 * videoHeightVH;
                    outerSpanVH = "line-height: " + value + "vh;";
                }

                // Text Align needs to be set at the region level (outerSpan).
                var textAlign = 'text-align';
                if(arrayContains(textAlign, paragraphStyleProperties)){
                    var value = propertyFromArray(textAlign, paragraphStyleProperties);
                    var idTxtAl = indexOfProperty(value, paragraphStyleProperties);
                    paragraphRegionProperties.push(value);
                    paragraphStyleProperties.splice(idTxtAl,1);
                }

                // Vertical Align needs to be set at the paragraph level (innerSpan).
                var verticalAlign = 'vertical-align';
                if(arrayContains(verticalAlign, paragraphRegionProperties)){
                    var value = propertyFromArray(verticalAlign, paragraphRegionProperties);
                    var idVerAl = indexOfProperty(value, paragraphRegionProperties);
                    paragraphStyleProperties.push(value);
                    paragraphRegionProperties.splice(idVerAl,1);
                }

                if(arrayContains("padding", paragraphStyleProperties)) {

                }

                // Create an outer span element: needed so that inner content
                // can be vertically aligned to something.
                var outerSpan = document.createElement('span');
                outerSpan.className = 'outerSpan';
                // TODO: find the correct value for default line-height.
                outerSpan.style.cssText = outerSpanVH? outerSpanVH: "18vh";

                // Create an inner Span containing the cue and its children if there are.
                var innerSpan = document.createElement('span');
                innerSpan.className = 'innerSpan';

                /*** Create the cue element
                 * 1) The cues are SMPTE images
                 * 2) The cues are text only:
                 *      i) The cue contains a 'br' element
                 *      ii) The cue contains a span element
                 *      iii) The cue contains text
                 * ***/
                // If cues are SMPTE images.
                if (cue["smpte:backgroundImage"] !== undefined) {
                    var images = ttml.tt.head.metadata.image_asArray;
                    for (var j = 0; j < images.length; j += 1) {
                        if (("#" + images[j]["p@xml:id"]) == cue["smpte:backgroundImage"]) {
                            captionArray.push({
                                start: pStartTime,
                                end: pEndTime,
                                id: images[j]["p@xml:id"],
                                data: "data:image/" + images[j].imagetype.toLowerCase() + ";base64, " + images[j].__text,
                                type: "image",
                                divRegion: divRegionProperties,
                                paragraphRegion: paragraphRegionProperties,
                                showBackground: showBackground
                            });
                        }
                    }
                }
                /*** Parse every cue in the ttml document and create elements accordingly.
                 * If cues are not SMPTE images:
                 * We need to treat every inline element inside the cue (span or br)
                 ***/
                else {
                    // If the cue has only one element, it needs to be put in an array.
                    cue.p = [].concat(cue.p);

                    // For each element, we add it properly in the cue.
                    cue.p.forEach(function(caption) {
                        /*** Create a br element if there is one in the cue. ***/
                        if (caption.hasOwnProperty('br')) {
                            innerSpan.appendChild(document.createElement('br'));
                        }

                        /*** Create the inline span element if there is one in the cue. ***/
                        else if (caption.hasOwnProperty('span')) {
                            // If span comprises several elements (text lines and br elements for example).
                            caption['span'] = [].concat(caption['span']);
                            // Create the inline span.
                            var inlineSpan = document.createElement('span');

                            // Extract the style of the span.
                            if (caption.hasOwnProperty('span@style')) {
                                var styleBlock = getStyleFromID(caption['span@style']);
                                if(arrayContains('padding', paragraphStyleProperties) && caption['span'].length == 1) {
                                    styleBlock.push(propertyFromArray('padding', paragraphStyleProperties));
                                }
                                inlineSpan.style.cssText = styleBlock.join(" ");
                            }

                            // If the span has <br/> elements, add them as child nodes.
                            if (caption['span'].length > 1) {
                                caption['span'].forEach(function(el) {
                                    if (typeof el == 'string' || el instanceof String) {
                                        if(arrayContains('padding', paragraphStyleProperties)){
                                            var linePaddingSpan = document.createElement('span');
                                            var style = propertyFromArray('padding', paragraphStyleProperties);
                                            linePaddingSpan.style.cssText = style;
                                            linePaddingSpan.innerHTML = el;
                                            inlineSpan.appendChild(linePaddingSpan);
                                        } else {
                                            var textNode = document.createTextNode(el);
                                            inlineSpan.appendChild(textNode);
                                        }
                                    } else if (el.hasOwnProperty('br')) {
                                        // Create a br element if it is one.
                                        inlineSpan.appendChild(document.createElement('br'));
                                    }
                                });
                                innerSpan.appendChild(inlineSpan);
                            } else {
                                // Affect the style and text to the inline span.
                                inlineSpan.innerHTML = caption['span'];
                                innerSpan.appendChild(inlineSpan);
                            }
                        }
                        /*** Add the text that is not in any inline element ***/
                        else {
                            // Affect the text to the inner span.
                            var textNode = document.createTextNode(caption);
                            innerSpan.appendChild(textNode);
                        }
                    });

                    if(paragraphStyleProperties){
                        innerSpan.style.cssText = paragraphStyleProperties.join(" ");
                    }

                    outerSpan.appendChild(innerSpan);

                    captionArray.push({
                        start: pStartTime,
                        end: pEndTime,
                        data: outerSpan,
                        type: "text",
                        divRegion: divRegionProperties,
                        paragraphRegion: paragraphRegionProperties,
                        showBackground: showBackground
                    });
                }
            });

            return captionArray;
        };

    return {
        parse: internalParse
    };
};
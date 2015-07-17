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
        ttml, // contains the whole ttml document received
        ttmlStylings, // contains the styling information from the document
        ttmlLayout, // contains the positioning information from the document
        cellResolution, // Expresses a virtual visual grid composed of horizontal and vertical cells
        cellUnit, // cellReprensentation represented as a unit in pixels
        showBackground, // constraints on when the background color of a region is intended to be presented.

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

        // backgroundColor = background-color
        camelCaseToDash = function(key) {
            return key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        },

        convertRGBA = function(rgba){
            var c = rgba.slice(1);
            c = c.match(/.{2}/g);

            var a, rgb=[];

            a = parseFloat(parseInt((parseInt(c[3], 16)/255)*1000)/1000);

            c.slice(0,3).forEach(function(i){
                rgb.push(parseInt(i, 16));});

            return 'rgba(' + rgb.join(',') +',' + a + ');';
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
            var value;
            var valueInPx;
            var rgbaValue;
            var textAlign;
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
                        value = parseFloat(property.slice(property.indexOf(":") + 1, property.indexOf('c')));
                        valueInPx = value * cellUnit[0] + "px;";
                        properties.push("padding-left:" + valueInPx + " padding-right:" + valueInPx);
                    } else if(key === 'font-size' || key === 'line-height'){
                        if(property !== 'normal'){
                            value = parseFloat(property.slice(property.indexOf(":") + 1, property.indexOf('%')));
                            valueInPx = value/100 * cellUnit[1] + "px;";
                            properties.push(key + ':' + valueInPx);
                        } else {
                            properties.push(key + ":" + property + ";");
                        }
                    } else if (key === "font-family") {
                        var font;
                        switch (property) {
                            case "monospace":
                                font = 'font-family: monospace;';
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
                                font = 'font-family: ' + property + ';';
                                break;
                        }
                        properties.push(font);
                    } else if (key === 'text-align') {
                        if(arrayContains('text-align', properties)){
                            textAlign = {
                                right: "justify-content: flex-end;",
                                start: "justify-content: flex-start;",
                                center: "justify-content: center;",
                                end: "justify-content: flex-end;",
                                left: "justify-content: flex-start;"
                            };
                            properties.push(textAlign[property]);
                        } else {
                            textAlign = {
                                right: ["justify-content: flex-end;", "text-align: right;"],
                                start: ["justify-content: flex-start;", "text-align: start;"],
                                center: ["justify-content: center;", "text-align: center;"],
                                end: ["justify-content: flex-end;", "text-align: end;"],
                                left: ["justify-content: flex-start;", "text-align: left;"]
                            };

                            properties.push(textAlign[property][0]);
                            properties.push(textAlign[property][1]);
                        }
                    } else if (key === 'multi-row-align') {
                        if(arrayContains('text-align', properties)) {
                            deletePropertyFromArray('text-align', properties);
                        }
                        var multiRowAlign = {
                            start: "text-align: start;",
                            center: "text-align: center;",
                            end: "text-align: end;",
                            auto: ""
                        };
                        properties.push(multiRowAlign[property]);

                    } else if (key === 'background-color') {
                        if(property.indexOf('#') > -1 && (property.length - 1) === 8){
                            rgbaValue = convertRGBA(property);
                            properties.push('background-color: ' + rgbaValue);
                        } else {
                            properties.push(key + ":" + property + ";");
                        }
                    } else if (key === 'color') {
                        if(property.indexOf('#') > -1 && (property.length - 1) === 8){
                            rgbaValue = convertRGBA(property);
                            properties.push('color: ' + rgbaValue);
                        } else {
                            properties.push(key + ":" + property + ";");
                        }
                    } else if (key === 'wrap-option') {
                        var wrapOption = {
                            wrap: "white-space: normal;",
                            noWrap: "white-space: nowrap;"
                        };
                        properties.push(wrapOption[property]);
                    } else if (key === "unicode-bidi") {
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
                key = key.replace("region@id:", "");
                key = key.replace("region@", "");

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
                    properties.push("height: " + coords[1] + ';');
                } else if (key === "origin") {
                    var coords = property.split(/\s/);
                    properties.push("left: " + coords[0] + ';');
                    properties.push("top: " + coords[1] + ';');
                } else if (key === "display-align") {
                    var displayAlign = {
                        before: "align-items: flex-start;",
                        center: "align-items: center;",
                        after: "align-items: flex-end;"
                    };
                    properties.push(displayAlign[property]);
                } else if (key === 'writing-mode') {
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
                    styleFromID.forEach(function(prop) {
                        properties.push(prop);
                    });
                } else if (key === "show-background") {
                    showBackground = (property === "always");
                } else {
                    var result;
                    result = key + ':' + property + ';';
                    properties.push(result);
                }
            }

            if (!objectContains('showBackground', cueRegion)) {
                showBackground = true;
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

        // Return whether or not an array contains a certain text
        arrayContains = function(text, array) {
            var res = false;
            array.forEach(function(str) {
                if (str.indexOf(text) > -1) {
                    res = true;
                }
            });
            return res;
        },

        // Return whether or not an array contains a certain text
        objectContains = function(text, object) {
            var res = false;
            for (var key in object) {
                if(object.hasOwnProperty(key)) {
                    if (key.indexOf(text) > -1) {
                        res = true;
                        break;
                    }
                }
            }
            return res;
        },

        deletePropertyFromArray = function(property, array) {
            array.splice(indexOfProperty(propertyFromArray(property,array), array), 1);
        },

        // Return the index of text in the array (must be exact term)
        indexOfProperty = function(text, array) {
            return array.indexOf(text);
        },

        // Return the whole value that contains "text"
        propertyFromArray = function(text, array) {
            var res = '';
            array.forEach(function(str) {
                if (str.indexOf(text) > -1) {
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
                spanStartTime,
                spanEndTime,
                pStyleID,
                pRegionID,
                paragraphStyleProperties,
                paragraphRegionProperties,
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

            cellResolution = ttml["tt@ttp:cellResolution"].split(" ").map(parseFloat) || [32, 15];

            videoWidth = document.getElementById('videoPlayer').clientWidth;
            videoHeight = document.getElementById('videoPlayer').clientHeight;

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

            /*** Parsing of every cue.
             *
             * cues: List of the cues found in the ttml parsing.
             *       We iterate on this list.
             * cue: Every cue is parsed individually and creates an HTML element with its style and children.
             *
             * ***/


            cues.forEach(function(cue) {
                // Obtain the start and end time of the cue.
                if (cue.hasOwnProperty('p@begin') && cue.hasOwnProperty('p@end')) {
                    pStartTime = parseTimings(cue['p@begin']);
                    pEndTime   = parseTimings(cue['p@end']);
                } else{
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }
                paragraphStyleProperties = []; // to be put in "paragraph"
                paragraphRegionProperties = []; // to be put in "captionRegion"

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
                if (divRegionID) {
                    paragraphRegionProperties = getRegionFromID(ttmlLayout, ttmlStylings, divRegionID);
                }

                if (pRegionID) {
                    paragraphRegionProperties = paragraphRegionProperties.concat(getRegionFromID(ttmlLayout, ttmlStylings, pRegionID))
                        || getRegionFromID(ttmlLayout, ttmlStylings, pRegionID);
                }

                // Add initial values to what's not set:
                if(!arrayContains('align-items', paragraphRegionProperties)){
                    paragraphRegionProperties.push('align-items: flex-start;');
                }
                if(!arrayContains('overflow', paragraphRegionProperties)){
                    paragraphRegionProperties.push('overflow: hidden;');
                }

                if(!arrayContains('writingMode', paragraphRegionProperties)){
                    paragraphRegionProperties.push('-ms-writing-mode: lr-tb;\
                                   -webkit-writing-mode: horizontal-tb;\
                                   -moz-writing-mode: horizontal-tb;\
                                   -ms-writing-mode: horizontal-tb;\
                                   writing-mode: horizontal-tb;');
                }

                // Find the right style for our cue.
                if (bodyStyleID) {
                    paragraphStyleProperties = getStyleFromID(bodyStyleID);
                }
                if (divStyleID) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getStyleFromID(divStyleID))
                        || getStyleFromID(divStyleID);
                }
                if (pStyleID) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getStyleFromID(pStyleID))
                        || getStyleFromID(pStyleID);
                }

                // Add initial values to what's not set:
                if(!arrayContains('background-color', paragraphStyleProperties)){
                    paragraphStyleProperties.push('background-color: rgba(0,0,0,0);');
                }
                if(!arrayContains('color', paragraphStyleProperties)){
                    paragraphStyleProperties.push('color: rgba(255,255,255,1);');
                }
                if(!arrayContains('direction',paragraphStyleProperties)){
                    paragraphStyleProperties.push('direction: ltr;');
                }
                if(!arrayContains('font-family', paragraphStyleProperties)){
                    paragraphStyleProperties.push('font-family: monospace, sans-serif;');
                }
                if(!arrayContains('font-size', paragraphStyleProperties)){
                    paragraphStyleProperties.push('font-size:' +  cellUnit[1] + 'px;');
                }
                if(!arrayContains('font-style', paragraphStyleProperties)){
                    paragraphStyleProperties.push('font-style: normal;');
                }
                if (!arrayContains('line-height', paragraphStyleProperties)){
                    paragraphStyleProperties.push('line-height: normal;');
                }
                if (!arrayContains('font-weight', paragraphStyleProperties)){
                    paragraphStyleProperties.push('font-weight: normal;')
                }
                if (!arrayContains('text-align', paragraphStyleProperties)){
                    paragraphStyleProperties.push('text-align: start; justify-content: flex-start;');
                }
                if (!arrayContains('text-decoration', paragraphStyleProperties)){
                    paragraphStyleProperties.push('text-decoration: none;');
                }
                if (!arrayContains('unicode-bidi', paragraphStyleProperties)){
                    paragraphStyleProperties.push('unicode-bidi: normal;');
                }
                if (!arrayContains('white-space', paragraphStyleProperties)){
                    paragraphStyleProperties.push('white-space: normal;');
                }

                // Create an outer span element: needed so that inner content
                // can be vertically aligned to something.
                var paragraph = document.createElement('div');
                paragraph.className = 'paragraph';

                // Create an inner Span containing the cue and its children if there are.
                var innerContainer = document.createElement('div');
                innerContainer.className = 'innerContainer';

                if(arrayContains('unicode-bidi', paragraphStyleProperties) || arrayContains('direction', paragraphStyleProperties)){
                    innerContainer.style.cssText += propertyFromArray('unicode-bidi',paragraphStyleProperties);
                    innerContainer.style.cssText += propertyFromArray('direction',paragraphStyleProperties);

                    deletePropertyFromArray('unicode-bidi', paragraphStyleProperties);
                    deletePropertyFromArray('direction', paragraphStyleProperties);
                }

                /*** Create the cue element
                 * I. The cues are text only:
                 *      i) The cue contains a 'br' element
                 *      ii) The cue contains a span element
                 *      iii) The cue contains text
                 * ***/

                    // If the cue has only one element, it needs to be put in an array.
                cue.p = [].concat(cue.p);

                // For each element, we add it properly in the cue.
                cue.p.forEach(function(caption) {
                    // Create a br element if there is one in the cue.
                    if (caption.hasOwnProperty('br')) {
                        innerContainer.appendChild(document.createElement('br'));
                    }

                    // Create the inline span element if there is one in the cue.
                    else if (caption.hasOwnProperty('span')) {
                        if (caption.hasOwnProperty('span@begin')) {
                            spanStartTime = parseTimings(caption['span@begin']);
                            spanEndTime = parseTimings(caption['span@end']);
                        }
                        // If span comprises several elements (text lines and br elements for example).
                        caption['span'] = [].concat(caption['span']);
                        // Create the inline span.
                        var inlineSpan = document.createElement('span');

                        // Extract the style of the span.
                        if (caption.hasOwnProperty('span@style')) {
                            var styleBlock = getStyleFromID(caption['span@style']);
                            // If line padding has to be applied to the span.
                            // We must apply it to the inline span and not to inner span.
                            if (arrayContains('padding', paragraphStyleProperties) && caption['span'].length == 1) {
                                styleBlock.push(propertyFromArray('padding', paragraphStyleProperties));
                            }
                            inlineSpan.style.cssText = styleBlock.join(" ");
                        }

                        // If the span has <br/> elements, add them as child nodes.
                        if (caption['span'].length > 1) {
                            caption['span'].forEach(function(el) {
                                // If the element is a string
                                if (typeof el == 'string' || el instanceof String) {
                                    // If line padding has to be applied to the inline span.
                                    // We must apply it to each line in a span.
                                    // For that we have to create a new span containing the style info.
                                    if (arrayContains('padding', paragraphStyleProperties)) {
                                        var linePaddingSpan = document.createElement('span');
                                        var style = propertyFromArray('padding', paragraphStyleProperties);
                                        linePaddingSpan.style.cssText = style;
                                        linePaddingSpan.innerHTML = el;
                                        inlineSpan.appendChild(linePaddingSpan);
                                    } else {
                                        var textNode = document.createElement('span');
                                        textNode.innerHTML = el;
                                        inlineSpan.appendChild(textNode);
                                    }
                                    // If the element is a 'br' tag
                                } else if (el.hasOwnProperty('br')) {
                                    // Create a br element.
                                    inlineSpan.appendChild(document.createElement('br'));
                                }
                            });
                            innerContainer.appendChild(inlineSpan);
                        } else {
                            // Affect the style and text to the inline span.
                            inlineSpan.innerHTML = caption['span'];
                            innerContainer.appendChild(inlineSpan);
                        }
                    }
                    // Add the text that is not in any inline element
                    else {
                        // Affect the text to the inner span.
                        var textNode = document.createElement('span');
                        textNode.innerHTML = caption;
                        if (arrayContains('padding', paragraphStyleProperties)) {
                            var style = propertyFromArray('padding', paragraphStyleProperties);
                            textNode.style.cssText = style;
                        }
                        innerContainer.appendChild(textNode);

                    }
                });

                if (arrayContains('padding', paragraphStyleProperties)) {
                    deletePropertyFromArray('padding', paragraphStyleProperties);
                }

                    // Finally we set the style to the cue.
                if (paragraphStyleProperties) {
                    paragraph.style.cssText = paragraphStyleProperties.join(" ");
                }

                // We then place the cue inside the outer span that controls the vertical alignment.
                paragraph.appendChild(innerContainer);

                captionArray.push({
                    start: spanStartTime || pStartTime,
                    end: spanEndTime || pEndTime,
                    data: paragraph,
                    type: "text",
                    paragraphRegion: paragraphRegionProperties,
                    showBackground: showBackground
                });

            });

            return captionArray;
        };

    return {
        parse: internalParse
    };
};
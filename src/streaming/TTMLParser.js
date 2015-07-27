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
    var SECONDS_IN_HOUR = 60 * 60, // Expression of an hour in seconds
        SECONDS_IN_MIN = 60, // Expression of a minute in seconds
        timingRegex = /^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])((\.[0-9][0-9][0-9])|(\.[0-9][0-9]))$/, // Regex defining the time
        ttml,// contains the whole ttml document received
        ttmlStyling, // contains the styling information from the document
        ttmlLayout, // contains the positioning information from the document

        parseTimings = function(timingStr) {
            // Test if the time provided by the caption is valid.
            var test = timingRegex.test(timingStr),
                timeParts,
                parsedTime,
                frameRate;

            if (!test) {
                // Return NaN so it will throw an exception at internalParse if the time is incorrect.
                return NaN;
            }

            timeParts = timingStr.split(":");

            // Process the timings by decomposing it and converting it in numbers.
            parsedTime = (parseFloat(timeParts[0]) * SECONDS_IN_HOUR +
            parseFloat(timeParts[1]) * SECONDS_IN_MIN +
            parseFloat(timeParts[2]));

            // In case a frameRate is provided, we adjust the parsed time.
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

                // Check if the ttml document provide all the necessary elements.
                hasTt = ttml.hasOwnProperty("tt"),
                hasHead = hasTt ? ttml.tt.hasOwnProperty("head") : false,
                hasLayout = hasHead ? ttml.tt.head.hasOwnProperty("layout") : false,
                hasStyling = hasHead ? ttml.tt.head.hasOwnProperty("styling") : false,
                hasBody = hasTt ? ttml.tt.hasOwnProperty("body") : false;

            // Check if the document contains all the nececessary information
            if (hasTt && hasHead && hasLayout && hasStyling && hasBody) {
                passed = true;
            }

            return passed;
        },

        getNamespacePrefix = function(json, ns) {
            // Obtain the namespace prefix.
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

        // backgroundColor = background-color, convert from camelCase to dash.
        camelCaseToDash = function(key) {
            return key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        },

        // Convert an RGBA value written in Hex to rgba(v,v,v,a).
        convertHexToRGBA = function(rgba){
            // Get the hexadecimal value without the #.
            var hex = rgba.slice(1);
            // Separate the values in pairs.
            var hexMatrice = hex.match(/.{2}/g);
            // Convert the alpha value in decimal between 0 and 1.
            var alpha = parseFloat(parseInt((parseInt(hexMatrice[3], 16)/255)*1000)/1000);
            // Get the standard RGB value.
            var rgb = hexMatrice.slice(0,3).map(function() {
                return parseInt(i, 16);
            });
            // Return the RGBA value for CSS.
            return 'rgba(' + rgb.join(',') +',' + alpha + ');';
        },

        // Return whether or not an array contains a certain text
        arrayContains = function(text, array) {
            for (var i = 0; i < array.length; i++){
                if(array[i].indexOf(text) > -1){
                    return true;
                }
            }
            return false;
        },

        // Return the whole value that contains "text"
        getPropertyFromArray = function(text, array) {
            for(var i = 0; i < array.length; i++){
                if(array[i].indexOf(text) > -1){
                    return array[i];
                }
            }
            return null;
        },

        // Delete a a property from an array.
        deletePropertyFromArray = function(property, array) {
            array.splice(array.indexOf(getPropertyFromArray(property,array)), 1);
        },

        /**
         * Processing of styling information:
         * - processStyle: return an array of strings with the cue style under a CSS style form.
         * - findStyleFromID: Return the unprocessed style from TTMLStyling corresponding to the ID researched.
         * - getProcessedStyle: Return the processed style(s) from the ID(s) received in entry.
         * **/


        // Compute the style properties to return an array with the cleaned properties.
        processStyle = function(cueStyle, cellUnit) {
            var properties = [];

            // Clean the "@" from the xml2json parsing:
            for (var key in cueStyle) {
                if (cueStyle.hasOwnProperty(key)) {
                    //Clean the properties from the parsing.
                    var newKey = key.replace("style@tts:", "");
                    newKey = newKey.replace("style@xml:", "");
                    newKey = newKey.replace("style@ebutts:", "");
                    newKey = newKey.replace("style@", "");

                    // Clean the properties' names.
                    newKey = camelCaseToDash(newKey);
                    cueStyle[newKey] = cueStyle[key];
                    delete cueStyle[key];
                }
            }

            // Line padding is computed from the cellResolution.
            if('line-padding' in cueStyle){
                var valuePadding = parseFloat(cueStyle['line-padding'].slice(cueStyle['line-padding'].indexOf(":") + 1,
                    cueStyle['line-padding'].indexOf('c')));
                var valuePaddingInPx = valuePadding * cellUnit[0] + "px;";
                properties.push("padding-left:" + valuePaddingInPx + " padding-right:" + valuePaddingInPx);
            }
            // Font size is computed from the cellResolution.
            if('font-size' in cueStyle){
                var valueFtSize = parseFloat(cueStyle['font-size'].slice(cueStyle['font-size'].indexOf(":") + 1,
                    cueStyle['font-size'].indexOf('%')));
                var valueFtSizeInPx = valueFtSize/100 * cellUnit[1] + "px;";
                properties.push('font-size:' + valueFtSizeInPx);
            }
            // Line height is computed from the cellResolution.
            if('line-heigt' in cueStyle){
                if(cueStyle['line-height'] === 'normal'){
                    properties.push('line-heigth: normal;');
                } else {
                    var valueFtSize     = parseFloat(cueStyle['line-heigt'].slice(cueStyle['line-heigt'].indexOf(":") + 1,
                        cueStyle['line-heigt'].indexOf('%')));
                    var valueFtSizeInPx = valueFtSize / 100 * cellUnit[1] + "px;";
                    properties.push(key + ':' + valueFtSizeInPx);
                }
            }
            // Font-family can be specified by a generic family name or a custom family name.
            if('font-family' in cueStyle){
                var fontFamilies = {
                    monospace: 'font-family: monospace;',
                    sansSerif: 'font-family: sans-serif;',
                    serif: 'font-family: serif;',
                    monospaceSansSerif: 'font-family: monospace, sans-serif;',
                    monospaceSerif:     'font-family: monospace, serif;',
                    proportionalSansSerif: 'font-family: Arial;',
                    proportionalSerif: 'font-family: Times New Roman;',
                    'default': 'font-family: monospace, sans-serif;'
                };
                if(cueStyle['font-family'] in fontFamilies){
                    properties.push(fontFamilies[cueStyle['font-family']]);
                } else {
                    properties.push('font-family:' + cueStyle['font-family'] + ';');
                }
            }

            // Text align needs to be set from two properties:
            // The standard text-align CSS property.
            // The justify-content property as we use flex boxes.
            if ('text-align'in cueStyle) {
                var textAlign = {
                    right: ["justify-content: flex-end;", "text-align: right;"],
                    start: ["justify-content: flex-start;", "text-align: start;"],
                    center: ["justify-content: center;", "text-align: center;"],
                    end: ["justify-content: flex-end;", "text-align: end;"],
                    left: ["justify-content: flex-start;", "text-align: left;"]
                };
                if(cueStyle['text-align'] in textAlign) {
                    properties.push(textAlign[cueStyle['text-align']][0]);
                    properties.push(textAlign[cueStyle['text-align']][1]);
                }
            }

            // Multi Row align is set only by the text-align property.
            // TODO: TO CHECK
            if('multi-row-align' in cueStyle){
                if(arrayContains('text-align', properties)) {
                    deletePropertyFromArray('text-align', properties);
                }
                var multiRowAlign = {
                    start: "text-align: start;",
                    center: "text-align: center;",
                    end: "text-align: end;",
                    auto: ""
                };
                if(cueStyle['multi-row-align'] in multiRowAlign) {
                    properties.push(multiRowAlign[cueStyle['multi-row-align']]);
                } else {
                    properties.push('text-align:' + cueStyle['multi-row-align']);
                }
            }
            // Background color can be specified from hexadecimal (RGB or RGBA) value.
            if('background-color' in cueStyle){
                if(cueStyle['background-color'].indexOf('#') > -1 && (cueStyle['background-color'].length - 1) === 8){
                    var rgbaValue = convertHexToRGBA(cueStyle['background-color']);
                    properties.push('background-color: ' + rgbaValue);
                } else {
                    properties.push('background-color:' + cueStyle['background-color'] + ";");
                }
            }
            // Color can be specified from hexadecimal (RGB or RGBA) value.
            if('color' in cueStyle) {
                if(cueStyle['color'].indexOf('#') > -1 && (cueStyle['color'].length - 1) === 8){
                    var rgbaValue = convertHexToRGBA(cueStyle['color']);
                    properties.push('color: ' + rgbaValue);
                } else {
                    properties.push('color:' + cueStyle['color'] + ";");
                }
            }
            // Wrap ption is determined by the white-space CSS property.
            if('wrap-option' in cueStyle) {
                var wrapOption = {
                    wrap: "white-space: normal;",
                    noWrap: "white-space: nowrap;"
                };
                if(cueStyle['wrap-option'] in wrapOption){
                    properties.push(wrapOption[cueStyle['wrap-option']]);
                } else {
                    properties.push('white-space:' + cueStyle['wrap-option'])
                }
            }
            // Unicode bidi is determined by the unicode-bidi CSS property.
            if ('unicode-bidi' in cueStyle) {
                var unicodeBidi = {
                    normal: "unicode-bidi: normal;",
                    embed: "unicode-bidi: embed;",
                    bidiOverride: "unicode-bidi: bidi-override;"
                };
                if(cueStyle['unicode-bidi'] in unicodeBidi){
                    properties.push(unicodeBidi[cueStyle['unicode-bidi']]);
                } else {
                    properties.push('unicode-bidi:' + cueStyle['unicode-bidi'])
                }
            }

            // Standard properties identical to CSS.

            if('font-style' in cueStyle){
                properties.push('font-style:' + cueStyle['font-style'] + ';');
            }
            if('font-weight' in cueStyle){
                properties.push('font-weight:' + cueStyle['font-weight'] + ';');
            }
            if('direction' in cueStyle){
                properties.push('direction:' + cueStyle['direction'] + ';');
            }
            if('text-decoration' in cueStyle){
                properties.push('text-decoration:' + cueStyle['text-decoration'] + ';');
            }
            return properties;
        },

        // Find the style set by comparing the style IDs available.
        // Return null if no style is found
        findStyleFromID = function(ttmlStyling, cueStyleID) {
            // For every styles available, search the corresponding style in ttmlStyling.
            for (var j = 0; j < ttmlStyling.length; j++) {
                var currStyle = ttmlStyling[j];
                if (currStyle['style@xml:id'] === cueStyleID || currStyle['style@id'] === cueStyleID) {
                    // Return the style corresponding to the ID in parameter.
                    return currStyle;
                }
            }
        },
        // Return the computed style from a certain ID.
        getProcessedStyle = function(reference, cellUnit) {
            var styles = [];
            var ids = reference.match(/\S+/g);
            ids.forEach(function(id){
                // Find the style for each id received.
                var cueStyle = findStyleFromID(ttmlStyling, id);
                if (cueStyle) {
                    // Process the style for the cue in CSS form.
                    var stylesFromId = processStyle(cueStyle, cellUnit);
                    styles = styles.concat(stylesFromId);
                }
            });
            return styles;
        },

        /**
         * Processing of layout information:
         * - processRegion: return an array of strings with the cue region under a CSS style form.
         * - findRegionFromID: Return the unprocessed region from TTMLLayout corresponding to the ID researched.
         * - getProcessedRegion: Return the processed region(s) from the ID(s) received in entry.
         * **/

        // Compute the region properties to return an array with the cleaned properties.
        processRegion = function(cueRegion, cellUnit) {
            var properties = [];

            for (var key in cueRegion) {
            //Clean the properties from the parsing.
                var newKey = key.replace("region@tts:", "");
                newKey = newKey.replace("region@xml:", "");
                newKey = newKey.replace("region@id:", "");
                newKey = newKey.replace("region@", "");

                // Clean the properties' names.
                newKey = camelCaseToDash(newKey);
                cueRegion[newKey] = cueRegion[key];
                delete cueRegion[key];
            }
            // Extent property corresponds to width and height
            if('extent' in cueRegion){
                var coords = cueRegion['extent'].split(/\s/);
                properties.push("width: " + coords[0] + ';');
                properties.push("height: " + coords[1] + ';');
            }
            // Origin property corresponds to top and left
            if('origin' in cueRegion) {
                var coords = cueRegion['origin'].split(/\s/);
                properties.push("left: " + coords[0] + ';');
                properties.push("top: " + coords[1] + ';');
            }
            // DisplayAlign property corresponds to vertical-align
            if('display-align' in cueRegion) {
                var displayAlign = {
                    before: "align-items: flex-start;",
                    center: "align-items: center;",
                    after: "align-items: flex-end;"
                };
                properties.push(displayAlign[cueRegion['display-align']]);
            }
            // WritingMode is not yet implemented (for CSS3, to come)
            if('writing-mode' in cueRegion){
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
                properties.push(writingMode[cueRegion['writing-mode']]);
            }
            // Style will give to the region the style properties from the style selected
            if('style' in cueRegion){
                var styleFromID = getProcessedStyle(cueRegion['style'], cellUnit);
                properties.concat(styleFromID);
            }

            // Standard properties identical to CSS.

            if('padding' in cueRegion){
                properties.push('padding:' + cueRegion['padding'] +';');
            }
            if('overflow' in cueRegion){
                properties.push('overflow:' + cueRegion['overflow'] +';');
            }

            return properties;
        },

        // Find the region set by comparing the region IDs available.
        // Return null if no region is found
        findRegionFromID = function(ttmlLayout, cueRegionID) {
            // For every region available, search the corresponding style in ttmlLayout.
            for (var j = 0; j < ttmlLayout.length; j++) {
                var currReg = ttmlLayout[j];
                if (currReg['region@xml:id'] === cueRegionID || currReg['region@id'] === cueRegionID) {
                    // Return the region corresponding to the ID in parameter.
                    return currReg;
                }
            }
        },

        // Return the computed region from a certain ID.
        getProcessedRegion = function(reference, cellUnit) {
            var regions = [];
            var ids = reference.match(/\S+/g);
            ids.forEach(function(id){
                // Find the region for each id received.
                var cueRegion = findRegionFromID(ttmlLayout, id);
                if (cueRegion) {
                    // Process the region for the cue in CSS form.
                    var regionsFromId = processRegion(cueRegion, cellUnit);
                    regions = regions.concat(regionsFromId);
                }
            });
            return regions;
        },

        /**
         * Parse the raw data and process it to return the HTML element representing the cue.
         * Return the region to be processed and controlled (hide/show) by the caption controller.
         * @param data: raw data received from the TextSourceBuffer
         * @returns {Array} - captionArray containing all the cue information
         *          - start time
         *          - end time
         *          - cue data (HTML element)
         *          - cue region
         *          - type 'text'
         */

        internalParse = function(data) {
            var captionArray = [],
                errorMsg;

            // Parse the TTML in a JSON object.
            ttml = JSON.parse(xml2json_hi(parseXml(data), ""));

            // Extract styling and layout from the document.
            ttmlLayout = ttml.tt.head.layout;
            ttmlStyling = ttml.tt.head.styling;

            // Check if the document is conform to the specification.
            if (!passStructuralConstraints()) {
                errorMsg = "TTML document has incorrect structure";
                throw errorMsg;
            }

            // Extract the cellResolution information
            var cellUnitDefault = [32, 15]; // Default cellResolution.
            var cellResolution = ttml["tt@ttp:cellResolution"].split(" ").map(parseFloat) || cellUnitDefault;

            // Recover the video width and height displayed by the player.
            // TODO: Make it dynamic by the controller.
            var videoWidth = document.getElementById('videoPlayer').clientWidth;
            var videoHeight = document.getElementById('videoPlayer').clientHeight;

            // Compute the CellResolution unit in order to process properties using sizing (fontSize, linePadding, etc).
            var cellUnit = [videoWidth / cellResolution[0], videoHeight / cellResolution[1]];

            // Stock ttmlLayout and ttmlStyling in an array (in case there are only one value).
            ttmlLayout = [].concat(ttmlLayout);
            ttmlStyling = [].concat(ttmlStyling);

            // Get the namespace prefixe.
            var nsttp = getNamespacePrefix(ttml, "http://www.w3.org/ns/ttml#parameter");

            // Set the framerate.
            if (ttml.hasOwnProperty("tt@" + nsttp + ":frameRate")) {
                ttml.frameRate = parseInt(ttml["tt@" + nsttp + ":frameRate"], 10);
            }
            // Extract the cues.
            var cues = (ttml.tt.body.div) ? ttml.tt.body.div : ttml.tt.body;


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
                // TODO: this foreach should be a map.
                // var x = []
                // array.forEach(function(d) {
                //    var y = ...
                //    x.push(y)
                // })
                // is equivalent to:
                // var x = array.map(function(d) {
                //    var y = ...
                //    return
                // })

                // Obtain the start and end time of the cue.
                if (cue.hasOwnProperty('p@begin') && cue.hasOwnProperty('p@end')) {
                    var pStartTime = parseTimings(cue['p@begin']);
                    var pEndTime   = parseTimings(cue['p@end']);
                } else if(cue.p.hasOwnProperty('span@begin') && cue.p.hasOwnProperty('span@end')) {
                    var spanStartTime = parseTimings(cue.p['span@begin']);
                    var spanEndTime   = parseTimings(cue.p['span@end']);
                } else{
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                // Error if timing is not specified.
                // TODO: check with the specification what is allowed.
                if ((isNaN(pStartTime) || isNaN(pEndTime)) && (isNaN(spanStartTime) || isNaN(spanEndTime))) {
                    errorMsg = "TTML document has incorrect timing value";
                    throw errorMsg;
                }

                var paragraphStyleProperties = []; // properties to be put in the "paragraph" HTML element
                var paragraphRegionProperties = []; // properties to be put in the "captionRegion" HTML element

                // Obtain the style and region IDs assigned to the cue.
                var pStyleID = cue['p@style'];
                var pRegionID = cue['p@region'];

                /**
                 * Find the region defined for the cue.
                 */

                // If the div element reference a region.
                if (divRegionID) {
                    paragraphRegionProperties = getProcessedRegion(divRegionID, cellUnit);
                }
                // If the p element reference a region.
                if (pRegionID) {
                    paragraphRegionProperties = paragraphRegionProperties.concat(getProcessedRegion(pRegionID, cellUnit));
                }

                // Add initial/default values to what's not defined in the layout:
                var defaultLayoutProperties ={
                    'top': '85%;',
                    'left': '5%;',
                    'width': '90%;',
                    'height': '10%;',
                    'align-items': 'flex-start;',
                    'overflow': 'visible;',
                    '-ms-writing-mode': 'lr-tb, horizontal-tb;;',
                    '-webkit-writing-mode': 'horizontal-tb;',
                    '-moz-writing-mode': 'horizontal-tb;',
                    'writing-mode': 'horizontal-tb;'
                };

                for(var key in defaultLayoutProperties) {
                    if (!arrayContains(key, paragraphRegionProperties)) {
                        paragraphRegionProperties.push(key + ':' + defaultLayoutProperties[key]);

                    }
                }

                /**
                 * Find the style defined for the cue.
                 */

                // If the body element reference a style.
                if (bodyStyleID) {
                    paragraphStyleProperties = getProcessedStyle(bodyStyleID, cellUnit);
                }
                // If the div element reference a style.
                if (divStyleID) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getProcessedStyle(divStyleID, cellUnit));
                }
                // If the p element reference a style.
                if (pStyleID) {
                    paragraphStyleProperties = paragraphStyleProperties.concat(getProcessedStyle(pStyleID, cellUnit));
                }

                // Add initial/default values to what's not defined in the styling:
                var defaultStyleProperties ={
                    'background-color': 'rgba(0,0,0,0);',
                    'color': 'rgba(255,255,255,1);',
                    'direction': 'ltr;',
                    'font-family': 'monospace, sans-serif;',
                    'font-size': cellUnit[1] + 'px;',
                    'font-style': 'normal;',
                    'line-height': 'normal;',
                    'font-weight': 'normal;',
                    'text-align': 'start;',
                    'justify-content': 'flex-start;',
                    'text-decoration': 'none;',
                    'unicode-bidi': 'normal;',
                    'white-space': 'normal;'
                };

                for(var key in defaultStyleProperties) {
                    if (!arrayContains(key, paragraphStyleProperties)) {
                        paragraphStyleProperties.push(key + ':' + defaultStyleProperties[key]);

                    }
                }

                /**
                 * /!\ Create the cue HTML Element containing the whole cue.
                 */

                var paragraph = document.createElement('div');
                paragraph.className = 'paragraph';

                // Create an inner Span containing the cue and its children if they exist.
                // innerContainer will contain the direction and unicode-bidi information if they exist
                // as they need to be defined on at this level.
                var innerContainer = document.createElement('div');
                innerContainer.className = 'innerContainer';

                // If the properties define these two properties, we place them in innerContainer.
                if(arrayContains('unicode-bidi', paragraphStyleProperties) || arrayContains('direction', paragraphStyleProperties)){
                    innerContainer.style.cssText += getPropertyFromArray('unicode-bidi',paragraphStyleProperties);
                    innerContainer.style.cssText += getPropertyFromArray('direction',paragraphStyleProperties);

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

                // For each child of the paragraph we add it in the cue depending of its kind (span, br, text).
                cue.p.forEach(function(caption) {
                    // Create a br element if there is one in the cue.
                    if (caption.hasOwnProperty('br')) {
                        innerContainer.appendChild(document.createElement('br'));
                    }

                    // Create the inline span element if there is one in the cue.
                    else if (caption.hasOwnProperty('span')) {
                        // If span comprises several elements (text lines and br elements for example).
                        caption['span'] = [].concat(caption['span']);
                        // Create the inline span.
                        var inlineSpan = document.createElement('span');

                        // Extract the style of the span.
                        if (caption.hasOwnProperty('span@style')) {
                            var styleBlock = getProcessedStyle(caption['span@style'], cellUnit);
                            // If line padding has to be applied to the span.
                            // We must apply it to the inline span and not to inner span.
                            if (arrayContains('padding', paragraphStyleProperties) && caption['span'].length == 1) {
                                styleBlock.push(getPropertyFromArray('padding', paragraphStyleProperties));
                            }
                            inlineSpan.style.cssText = styleBlock.join(" ");
                        }

                        // If the span has <br/> elements, add them as child nodes.
                        if (caption['span'].length > 1) { // TODO: is >1 necessary?
                            caption['span'].forEach(function(el) {
                                // If the element is a string
                                if (typeof el === 'string' || el instanceof String) {
                                    // If line padding has to be applied to the inline span.
                                    // We must apply it to each line in a span.
                                    // For that we have to create a new span containing the style info.
                                    if (arrayContains('padding', paragraphStyleProperties)) {
                                        var linePaddingSpan = document.createElement('span');
                                        linePaddingSpan.style.cssText = getPropertyFromArray('padding', paragraphStyleProperties);
                                        linePaddingSpan.innerHTML = el;
                                        inlineSpan.appendChild(linePaddingSpan);
                                    } else {
                                        var textNode = document.createElement('span');
                                        textNode.innerHTML = el;
                                        inlineSpan.appendChild(textNode);
                                    }
                                    // If the element is a 'br' tag
                                } else if (el.hasOwnProperty('br')) { // TODO: 'br' in el
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

                            textNode.style.cssText = getPropertyFromArray('padding', paragraphStyleProperties);
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
                    paragraphRegion: paragraphRegionProperties
                });

            });

            return captionArray;
        };

    return {
        parse: internalParse
    };
};
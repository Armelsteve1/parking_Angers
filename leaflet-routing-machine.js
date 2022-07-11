(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
    function corslite(url, callback, cors) {
        var sent = false;
    
        if (typeof window.XMLHttpRequest === 'undefined') {
            return callback(Error('Browser not supported'));
        }
    
        if (typeof cors === 'undefined') {
            var m = url.match(/^\s*https?:\/\/[^\/]*/);
            cors = m && (m[0] !== location.protocol + '//' + location.hostname +
                    (location.port ? ':' + location.port : ''));
        }
    
        var x = new window.XMLHttpRequest();
    
        function isSuccessful(status) {
            return status >= 200 && status < 300 || status === 304;
        }
    
        if (cors && !('withCredentials' in x)) {
            // IE8-9
            x = new window.XDomainRequest();
    
            // Ensure callback is never called synchronously, i.e., before
            // x.send() returns (this has been observed in the wild).
            // See https://github.com/mapbox/mapbox.js/issues/472
            var original = callback;
            callback = function() {
                if (sent) {
                    original.apply(this, arguments);
                } else {
                    var that = this, args = arguments;
                    setTimeout(function() {
                        original.apply(that, args);
                    }, 0);
                }
            }
        }
    
        function loaded() {
            if (
                // XDomainRequest
                x.status === undefined ||
                // modern browsers
                isSuccessful(x.status)) callback.call(x, null, x);
            else callback.call(x, x, null);
        }
    
        // Both `onreadystatechange` and `onload` can fire. `onreadystatechange`
        // has [been supported for longer](http://stackoverflow.com/a/9181508/229001).
        if ('onload' in x) {
            x.onload = loaded;
        } else {
            x.onreadystatechange = function readystate() {
                if (x.readyState === 4) {
                    loaded();
                }
            };
        }
    
        // Call the callback with the XMLHttpRequest object as an error and prevent
        // it from ever being called again by reassigning it to `noop`
        x.onerror = function error(evt) {
            // XDomainRequest provides no evt parameter
            callback.call(this, evt || true, null);
            callback = function() { };
        };
    
        // IE9 must have onprogress be set to a unique function.
        x.onprogress = function() { };
    
        x.ontimeout = function(evt) {
            callback.call(this, evt, null);
            callback = function() { };
        };
    
        x.onabort = function(evt) {
            callback.call(this, evt, null);
            callback = function() { };
        };
    
        // GET is the only supported HTTP Verb by XDomainRequest and is the
        // only one supported here.
        x.open('GET', url, true);
    
        // Send the request. Sending data is not supported.
        x.send(null);
        sent = true;
    
        return x;
    }
    
    if (typeof module !== 'undefined') module.exports = corslite;
    
    },{}],2:[function(_dereq_,module,exports){
    'use strict';
    
    /**
     * Based off of [the offical Google document](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)
     *
     * Some parts from [this implementation](http://facstaff.unca.edu/mcmcclur/GoogleMaps/EncodePolyline/PolylineEncoder.js)
     * by [Mark McClure](http://facstaff.unca.edu/mcmcclur/)
     *
     * @module polyline
     */
    
    var polyline = {};
    
    function py2_round(value) {
        // Google's polyline algorithm uses the same rounding strategy as Python 2, which is different from JS for negative values
        return Math.floor(Math.abs(value) + 0.5) * Math.sign(value);
    }
    
    function encode(current, previous, factor) {
        current = py2_round(current * factor);
        previous = py2_round(previous * factor);
        var coordinate = current - previous;
        coordinate <<= 1;
        if (current - previous < 0) {
            coordinate = ~coordinate;
        }
        var output = '';
        while (coordinate >= 0x20) {
            output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
            coordinate >>= 5;
        }
        output += String.fromCharCode(coordinate + 63);
        return output;
    }
    
    /**
     * Decodes to a [latitude, longitude] coordinates array.
     *
     * This is adapted from the implementation in Project-OSRM.
     *
     * @param {String} str
     * @param {Number} precision
     * @returns {Array}
     *
     * @see https://github.com/Project-OSRM/osrm-frontend/blob/master/WebContent/routing/OSRM.RoutingGeometry.js
     */
    polyline.decode = function(str, precision) {
        var index = 0,
            lat = 0,
            lng = 0,
            coordinates = [],
            shift = 0,
            result = 0,
            byte = null,
            latitude_change,
            longitude_change,
            factor = Math.pow(10, precision || 5);
    
        // Coordinates have variable length when encoded, so just keep
        // track of whether we've hit the end of the string. In each
        // loop iteration, a single coordinate is decoded.
        while (index < str.length) {
    
            // Reset shift, result, and byte
            byte = null;
            shift = 0;
            result = 0;
    
            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
    
            latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    
            shift = result = 0;
    
            do {
                byte = str.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
    
            longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    
            lat += latitude_change;
            lng += longitude_change;
    
            coordinates.push([lat / factor, lng / factor]);
        }
    
        return coordinates;
    };
    
    /**
     * Encodes the given [latitude, longitude] coordinates array.
     *
     * @param {Array.<Array.<Number>>} coordinates
     * @param {Number} precision
     * @returns {String}
     */
    polyline.encode = function(coordinates, precision) {
        if (!coordinates.length) { return ''; }
    
        var factor = Math.pow(10, precision || 5),
            output = encode(coordinates[0][0], 0, factor) + encode(coordinates[0][1], 0, factor);
    
        for (var i = 1; i < coordinates.length; i++) {
            var a = coordinates[i], b = coordinates[i - 1];
            output += encode(a[0], b[0], factor);
            output += encode(a[1], b[1], factor);
        }
    
        return output;
    };
    
    function flipped(coords) {
        var flipped = [];
        for (var i = 0; i < coords.length; i++) {
            flipped.push(coords[i].slice().reverse());
        }
        return flipped;
    }
    
    /**
     * Encodes a GeoJSON LineString feature/geometry.
     *
     * @param {Object} geojson
     * @param {Number} precision
     * @returns {String}
     */
    polyline.fromGeoJSON = function(geojson, precision) {
        if (geojson && geojson.type === 'Feature') {
            geojson = geojson.geometry;
        }
        if (!geojson || geojson.type !== 'LineString') {
            throw new Error('Input must be a GeoJSON LineString');
        }
        return polyline.encode(flipped(geojson.coordinates), precision);
    };
    
    /**
     * Decodes to a GeoJSON LineString geometry.
     *
     * @param {String} str
     * @param {Number} precision
     * @returns {Object}
     */
    polyline.toGeoJSON = function(str, precision) {
        var coords = polyline.decode(str, precision);
        return {
            type: 'LineString',
            coordinates: flipped(coords)
        };
    };
    
    if (typeof module === 'object' && module.exports) {
        module.exports = polyline;
    }
    
    },{}],3:[function(_dereq_,module,exports){
    var languages = _dereq_('./languages');
    var instructions = languages.instructions;
    var grammars = languages.grammars;
    var abbreviations = languages.abbreviations;
    
    module.exports = function(version) {
        Object.keys(instructions).forEach(function(code) {
            if (!instructions[code][version]) { throw 'invalid version ' + version + ': ' + code + ' not supported'; }
        });
    
        return {
            capitalizeFirstLetter: function(language, string) {
                return string.charAt(0).toLocaleUpperCase(language) + string.slice(1);
            },
            ordinalize: function(language, number) {
                // Transform numbers to their translated ordinalized value
                if (!language) throw new Error('No language code provided');
    
                return instructions[language][version].constants.ordinalize[number.toString()] || '';
            },
            directionFromDegree: function(language, degree) {
                // Transform degrees to their translated compass direction
                if (!language) throw new Error('No language code provided');
                if (!degree && degree !== 0) {
                    // step had no bearing_after degree, ignoring
                    return '';
                } else if (degree >= 0 && degree <= 20) {
                    return instructions[language][version].constants.direction.north;
                } else if (degree > 20 && degree < 70) {
                    return instructions[language][version].constants.direction.northeast;
                } else if (degree >= 70 && degree <= 110) {
                    return instructions[language][version].constants.direction.east;
                } else if (degree > 110 && degree < 160) {
                    return instructions[language][version].constants.direction.southeast;
                } else if (degree >= 160 && degree <= 200) {
                    return instructions[language][version].constants.direction.south;
                } else if (degree > 200 && degree < 250) {
                    return instructions[language][version].constants.direction.southwest;
                } else if (degree >= 250 && degree <= 290) {
                    return instructions[language][version].constants.direction.west;
                } else if (degree > 290 && degree < 340) {
                    return instructions[language][version].constants.direction.northwest;
                } else if (degree >= 340 && degree <= 360) {
                    return instructions[language][version].constants.direction.north;
                } else {
                    throw new Error('Degree ' + degree + ' invalid');
                }
            },
            laneConfig: function(step) {
                // Reduce any lane combination down to a contracted lane diagram
                if (!step.intersections || !step.intersections[0].lanes) throw new Error('No lanes object');
    
                var config = [];
                var currentLaneValidity = null;
    
                step.intersections[0].lanes.forEach(function (lane) {
                    if (currentLaneValidity === null || currentLaneValidity !== lane.valid) {
                        if (lane.valid) {
                            config.push('o');
                        } else {
                            config.push('x');
                        }
                        currentLaneValidity = lane.valid;
                    }
                });
    
                return config.join('');
            },
            getWayName: function(language, step, options) {
                var classes = options ? options.classes || [] : [];
                if (typeof step !== 'object') throw new Error('step must be an Object');
                if (!language) throw new Error('No language code provided');
                if (!Array.isArray(classes)) throw new Error('classes must be an Array or undefined');
    
                var wayName;
                var name = step.name || '';
                var ref = (step.ref || '').split(';')[0];
    
                // Remove hacks from Mapbox Directions mixing ref into name
                if (name === step.ref) {
                    // if both are the same we assume that there used to be an empty name, with the ref being filled in for it
                    // we only need to retain the ref then
                    name = '';
                }
                name = name.replace(' (' + step.ref + ')', '');
    
                // In attempt to avoid using the highway name of a way,
                // check and see if the step has a class which should signal
                // the ref should be used instead of the name.
                var wayMotorway = classes.indexOf('motorway') !== -1;
    
                if (name && ref && name !== ref && !wayMotorway) {
                    var phrase = instructions[language][version].phrase['name and ref'] ||
                        instructions.en[version].phrase['name and ref'];
                    wayName = this.tokenize(language, phrase, {
                        name: name,
                        ref: ref
                    }, options);
                } else if (name && ref && wayMotorway && (/\d/).test(ref)) {
                    wayName = options && options.formatToken ? options.formatToken('ref', ref) : ref;
                } else if (!name && ref) {
                    wayName = options && options.formatToken ? options.formatToken('ref', ref) : ref;
                } else {
                    wayName = options && options.formatToken ? options.formatToken('name', name) : name;
                }
    
                return wayName;
            },
    
            /**
             * Formulate a localized text instruction from a step.
             *
             * @param  {string} language           Language code.
             * @param  {object} step               Step including maneuver property.
             * @param  {object} opts               Additional options.
             * @param  {string} opts.legIndex      Index of leg in the route.
             * @param  {string} opts.legCount      Total number of legs in the route.
             * @param  {array}  opts.classes       List of road classes.
             * @param  {string} opts.waypointName  Name of waypoint for arrival instruction.
             *
             * @return {string} Localized text instruction.
             */
            compile: function(language, step, opts) {
                if (!language) throw new Error('No language code provided');
                if (languages.supportedCodes.indexOf(language) === -1) throw new Error('language code ' + language + ' not loaded');
                if (!step.maneuver) throw new Error('No step maneuver provided');
                var options = opts || {};
    
                var type = step.maneuver.type;
                var modifier = step.maneuver.modifier;
                var mode = step.mode;
                // driving_side will only be defined in OSRM 5.14+
                var side = step.driving_side;
    
                if (!type) { throw new Error('Missing step maneuver type'); }
                if (type !== 'depart' && type !== 'arrive' && !modifier) { throw new Error('Missing step maneuver modifier'); }
    
                if (!instructions[language][version][type]) {
                    // Log for debugging
                    console.log('Encountered unknown instruction type: ' + type); // eslint-disable-line no-console
                    // OSRM specification assumes turn types can be added without
                    // major version changes. Unknown types are to be treated as
                    // type `turn` by clients
                    type = 'turn';
                }
    
                // Use special instructions if available, otherwise `defaultinstruction`
                var instructionObject;
                if (instructions[language][version].modes[mode]) {
                    instructionObject = instructions[language][version].modes[mode];
                } else {
                  // omit side from off ramp if same as driving_side
                  // note: side will be undefined if the input is from OSRM <5.14
                  // but the condition should still evaluate properly regardless
                    var omitSide = type === 'off ramp' && modifier.indexOf(side) >= 0;
                    if (instructions[language][version][type][modifier] && !omitSide) {
                        instructionObject = instructions[language][version][type][modifier];
                    } else {
                        instructionObject = instructions[language][version][type].default;
                    }
                }
    
                // Special case handling
                var laneInstruction;
                switch (type) {
                case 'use lane':
                    laneInstruction = instructions[language][version].constants.lanes[this.laneConfig(step)];
                    if (!laneInstruction) {
                        // If the lane combination is not found, default to continue straight
                        instructionObject = instructions[language][version]['use lane'].no_lanes;
                    }
                    break;
                case 'rotary':
                case 'roundabout':
                    if (step.rotary_name && step.maneuver.exit && instructionObject.name_exit) {
                        instructionObject = instructionObject.name_exit;
                    } else if (step.rotary_name && instructionObject.name) {
                        instructionObject = instructionObject.name;
                    } else if (step.maneuver.exit && instructionObject.exit) {
                        instructionObject = instructionObject.exit;
                    } else {
                        instructionObject = instructionObject.default;
                    }
                    break;
                default:
                    // NOOP, since no special logic for that type
                }
    
                // Decide way_name with special handling for name and ref
                var wayName = this.getWayName(language, step, options);
    
                // Decide which instruction string to use
                // Destination takes precedence over name
                var instruction;
                if (step.destinations && step.exits && instructionObject.exit_destination) {
                    instruction = instructionObject.exit_destination;
                } else if (step.destinations && instructionObject.destination) {
                    instruction = instructionObject.destination;
                } else if (step.exits && instructionObject.exit) {
                    instruction = instructionObject.exit;
                } else if (wayName && instructionObject.name) {
                    instruction = instructionObject.name;
                } else if (options.waypointName && instructionObject.named) {
                    instruction = instructionObject.named;
                } else {
                    instruction = instructionObject.default;
                }
    
                var destinations = step.destinations && step.destinations.split(': ');
                var destinationRef = destinations && destinations[0].split(',')[0];
                var destination = destinations && destinations[1] && destinations[1].split(',')[0];
                var firstDestination;
                if (destination && destinationRef) {
                    firstDestination = destinationRef + ': ' + destination;
                } else {
                    firstDestination = destinationRef || destination || '';
                }
    
                var nthWaypoint = options.legIndex >= 0 && options.legIndex !== options.legCount - 1 ? this.ordinalize(language, options.legIndex + 1) : '';
    
                // Replace tokens
                // NOOP if they don't exist
                var replaceTokens = {
                    'way_name': wayName,
                    'destination': firstDestination,
                    'exit': (step.exits || '').split(';')[0],
                    'exit_number': this.ordinalize(language, step.maneuver.exit || 1),
                    'rotary_name': step.rotary_name,
                    'lane_instruction': laneInstruction,
                    'modifier': instructions[language][version].constants.modifier[modifier],
                    'direction': this.directionFromDegree(language, step.maneuver.bearing_after),
                    'nth': nthWaypoint,
                    'waypoint_name': options.waypointName
                };
    
                return this.tokenize(language, instruction, replaceTokens, options);
            },
            grammarize: function(language, name, grammar) {
                if (!language) throw new Error('No language code provided');
                // Process way/rotary name with applying grammar rules if any
                if (name && grammar && grammars && grammars[language] && grammars[language][version]) {
                    var rules = grammars[language][version][grammar];
                    if (rules) {
                        // Pass original name to rules' regular expressions enclosed with spaces for simplier parsing
                        var n = ' ' + name + ' ';
                        var flags = grammars[language].meta.regExpFlags || '';
                        rules.forEach(function(rule) {
                            var re = new RegExp(rule[0], flags);
                            n = n.replace(re, rule[1]);
                        });
    
                        return n.trim();
                    }
                }
    
                return name;
            },
            abbreviations: abbreviations,
            tokenize: function(language, instruction, tokens, options) {
                if (!language) throw new Error('No language code provided');
                // Keep this function context to use in inline function below (no arrow functions in ES4)
                var that = this;
                var startedWithToken = false;
                var output = instruction.replace(/\{(\w+)(?::(\w+))?\}/g, function(token, tag, grammar, offset) {
                    var value = tokens[tag];
    
                    // Return unknown token unchanged
                    if (typeof value === 'undefined') {
                        return token;
                    }
    
                    value = that.grammarize(language, value, grammar);
    
                    // If this token appears at the beginning of the instruction, capitalize it.
                    if (offset === 0 && instructions[language].meta.capitalizeFirstLetter) {
                        startedWithToken = true;
                        value = that.capitalizeFirstLetter(language, value);
                    }
    
                    if (options && options.formatToken) {
                        value = options.formatToken(tag, value);
                    }
    
                    return value;
                })
                .replace(/ {2}/g, ' '); // remove excess spaces
    
                if (!startedWithToken && instructions[language].meta.capitalizeFirstLetter) {
                    return this.capitalizeFirstLetter(language, output);
                }
    
                return output;
            }
        };
    };
    
    },{"./languages":4}],4:[function(_dereq_,module,exports){
    // Load all language files explicitly to allow integration
    // with bundling tools like webpack and browserify
    var instructionsDa = _dereq_('./languages/translations/da.json');
    var instructionsDe = _dereq_('./languages/translations/de.json');
    var instructionsEn = _dereq_('./languages/translations/en.json');
    var instructionsEo = _dereq_('./languages/translations/eo.json');
    var instructionsEs = _dereq_('./languages/translations/es.json');
    var instructionsEsEs = _dereq_('./languages/translations/es-ES.json');
    var instructionsFi = _dereq_('./languages/translations/fi.json');
    var instructionsFr = _dereq_('./languages/translations/fr.json');
    var instructionsHe = _dereq_('./languages/translations/he.json');
    var instructionsId = _dereq_('./languages/translations/id.json');
    var instructionsIt = _dereq_('./languages/translations/it.json');
    var instructionsKo = _dereq_('./languages/translations/ko.json');
    var instructionsMy = _dereq_('./languages/translations/my.json');
    var instructionsNl = _dereq_('./languages/translations/nl.json');
    var instructionsNo = _dereq_('./languages/translations/no.json');
    var instructionsPl = _dereq_('./languages/translations/pl.json');
    var instructionsPtBr = _dereq_('./languages/translations/pt-BR.json');
    var instructionsPtPt = _dereq_('./languages/translations/pt-PT.json');
    var instructionsRo = _dereq_('./languages/translations/ro.json');
    var instructionsRu = _dereq_('./languages/translations/ru.json');
    var instructionsSv = _dereq_('./languages/translations/sv.json');
    var instructionsTr = _dereq_('./languages/translations/tr.json');
    var instructionsUk = _dereq_('./languages/translations/uk.json');
    var instructionsVi = _dereq_('./languages/translations/vi.json');
    var instructionsZhHans = _dereq_('./languages/translations/zh-Hans.json');
    
    // Load all grammar files
    var grammarFr = _dereq_('./languages/grammar/fr.json');
    var grammarRu = _dereq_('./languages/grammar/ru.json');
    
    // Load all abbreviations files
    var abbreviationsBg = _dereq_('./languages/abbreviations/bg.json');
    var abbreviationsCa = _dereq_('./languages/abbreviations/ca.json');
    var abbreviationsDa = _dereq_('./languages/abbreviations/da.json');
    var ebbreviationsDe = _dereq_('./languages/abbreviations/de.json');
    var abbreviationsEn = _dereq_('./languages/abbreviations/en.json');
    var abbreviationsEs = _dereq_('./languages/abbreviations/es.json');
    var abbreviationsFr = _dereq_('./languages/abbreviations/fr.json');
    var abbreviationsHe = _dereq_('./languages/abbreviations/he.json');
    var abbreviationsHu = _dereq_('./languages/abbreviations/hu.json');
    var abbreviationsLt = _dereq_('./languages/abbreviations/lt.json');
    var abbreviationsNl = _dereq_('./languages/abbreviations/nl.json');
    var abbreviationsRu = _dereq_('./languages/abbreviations/ru.json');
    var abbreviationsSl = _dereq_('./languages/abbreviations/sl.json');
    var abbreviationsSv = _dereq_('./languages/abbreviations/sv.json');
    var abbreviationsUk = _dereq_('./languages/abbreviations/uk.json');
    var abbreviationsVi = _dereq_('./languages/abbreviations/vi.json');
    
    // Create a list of supported codes
    var instructions = {
        'da': instructionsDa,
        'de': instructionsDe,
        'en': instructionsEn,
        'eo': instructionsEo,
        'es': instructionsEs,
        'es-ES': instructionsEsEs,
        'fi': instructionsFi,
        'fr': instructionsFr,
        'he': instructionsHe,
        'id': instructionsId,
        'it': instructionsIt,
        'ko': instructionsKo,
        'my': instructionsMy,
        'nl': instructionsNl,
        'no': instructionsNo,
        'pl': instructionsPl,
        'pt-BR': instructionsPtBr,
        'pt-PT': instructionsPtPt,
        'ro': instructionsRo,
        'ru': instructionsRu,
        'sv': instructionsSv,
        'tr': instructionsTr,
        'uk': instructionsUk,
        'vi': instructionsVi,
        'zh-Hans': instructionsZhHans
    };
    
    // Create list of supported grammar
    var grammars = {
        'fr': grammarFr,
        'ru': grammarRu
    };
    
    // Create list of supported abbrevations
    var abbreviations = {
        'bg': abbreviationsBg,
        'ca': abbreviationsCa,
        'da': abbreviationsDa,
        'de': ebbreviationsDe,
        'en': abbreviationsEn,
        'es': abbreviationsEs,
        'fr': abbreviationsFr,
        'he': abbreviationsHe,
        'hu': abbreviationsHu,
        'lt': abbreviationsLt,
        'nl': abbreviationsNl,
        'ru': abbreviationsRu,
        'sl': abbreviationsSl,
        'sv': abbreviationsSv,
        'uk': abbreviationsUk,
        'vi': abbreviationsVi
    };
    module.exports = {
        supportedCodes: Object.keys(instructions),
        instructions: instructions,
        grammars: grammars,
        abbreviations: abbreviations
    };
    
    },{"./languages/abbreviations/bg.json":5,"./languages/abbreviations/ca.json":6,"./languages/abbreviations/da.json":7,"./languages/abbreviations/de.json":8,"./languages/abbreviations/en.json":9,"./languages/abbreviations/es.json":10,"./languages/abbreviations/fr.json":11,"./languages/abbreviations/he.json":12,"./languages/abbreviations/hu.json":13,"./languages/abbreviations/lt.json":14,"./languages/abbreviations/nl.json":15,"./languages/abbreviations/ru.json":16,"./languages/abbreviations/sl.json":17,"./languages/abbreviations/sv.json":18,"./languages/abbreviations/uk.json":19,"./languages/abbreviations/vi.json":20,"./languages/grammar/fr.json":21,"./languages/grammar/ru.json":22,"./languages/translations/da.json":23,"./languages/translations/de.json":24,"./languages/translations/en.json":25,"./languages/translations/eo.json":26,"./languages/translations/es-ES.json":27,"./languages/translations/es.json":28,"./languages/translations/fi.json":29,"./languages/translations/fr.json":30,"./languages/translations/he.json":31,"./languages/translations/id.json":32,"./languages/translations/it.json":33,"./languages/translations/ko.json":34,"./languages/translations/my.json":35,"./languages/translations/nl.json":36,"./languages/translations/no.json":37,"./languages/translations/pl.json":38,"./languages/translations/pt-BR.json":39,"./languages/translations/pt-PT.json":40,"./languages/translations/ro.json":41,"./languages/translations/ru.json":42,"./languages/translations/sv.json":43,"./languages/translations/tr.json":44,"./languages/translations/uk.json":45,"./languages/translations/vi.json":46,"./languages/translations/zh-Hans.json":47}],5:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "Ð¼ÐµÐ¶Ð´ÑƒÐ½Ð°Ñ€Ð¾Ð´ÐµÐ½": "ÐœÐµÐ¶Ð´",
            "ÑÑ‚Ð°Ñ€ÑˆÐ¸": "Ð¡Ñ‚Ñ€Ñˆ",
            "Ð²ÑŠÐ·ÐµÐ»": "Ð’ÑŠÐ·",
            "Ð¿Ð°Ð·Ð°Ñ€": "Mkt",
            "ÑÐ²ÐµÑ‚Ð¸ÑÐ²ÐµÑ‚Ð¸": "Ð¡Ð²Ð¡Ð²",
            "ÑÐµÑÑ‚Ñ€Ð°": "ÑÐµÑ",
            "ÑƒÐ¸Ð»ÑÐ¼": "Ð£Ð¼",
            "Ð°Ð¿Ð°Ñ€Ñ‚Ð°Ð¼ÐµÐ½Ñ‚Ð¸": "Ð°Ð¿",
            "ÐµÐ·ÐµÑ€Ð¾": "Ð•Ð·",
            "ÑÐ²ÐµÑ‚Ð¸": "Ð¡Ð²",
            "Ñ†ÐµÐ½Ñ‚ÑŠÑ€": "Ð¦-Ñ€",
            "Ð¿Ð°Ñ€Ðº": "ÐŸÐº",
            "Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚": "Ðœ-Ñ‚",
            "Ð¿Ð»Ð¾Ñ‰Ð°Ð´": "ÐŸÐ»",
            "Ð½Ð°Ñ†Ð¸Ð¾Ð½Ð°Ð»ÐµÐ½": "ÐÐ°Ñ†",
            "ÑƒÑ‡Ð¸Ð»Ð¸Ñ‰Ðµ": "Ð£Ñ‡",
            "Ñ€ÐµÐºÐ°": "Ð ÐµÐº",
            "Ð¿Ð¾Ñ‚Ð¾Ðº": "ÐŸ-Ðº",
            "Ñ€Ð°Ð¹Ð¾Ð½": "Ð -Ð½",
            "ÐºÑ€ÐµÐ¿Ð¾ÑÑ‚": "Ðš-Ñ‚",
            "Ð¿Ð°Ð¼ÐµÑ‚Ð½Ð¸Ðº": "ÐŸÐ°Ð¼",
            "ÑƒÐ½Ð¸Ð²ÐµÑ€ÑÐ¸Ñ‚ÐµÑ‚": "Ð£Ð½Ð¸",
            "Ð’Ñ€ÑŠÑ…": "Ð’Ñ€",
            "Ñ‚Ð¾Ñ‡ÐºÐ°": "Ð¢Ð¾Ñ‡",
            "Ð¿Ð»Ð°Ð½Ð¸Ð½Ð°": "ÐŸÐ»",
            "ÑÐµÐ»Ð¾": "Ñ.",
            "Ð²Ð¸ÑÐ¾Ñ‡Ð¸Ð½Ð¸": "Ð²Ð¸Ñ",
            "Ð¼Ð»Ð°Ð´ÑˆÐ¸": "ÐœÐ»",
            "ÑÑ‚Ð°Ð½Ñ†Ð¸Ñ": "Ð¡-Ñ",
            "Ð¿Ñ€Ð¾Ñ…Ð¾Ð´": "ÐŸÑ€Ð¾Ñ…",
            "Ð±Ð°Ñ‰Ð°": "Ð‘Ñ‰"
        },
        "classifications": {
            "ÑˆÐ¾Ñ„Ð¸Ñ€Ð°Ð½Ðµ": "Ð¨Ð¾Ñ„",
            "Ð¿Ð»Ð°Ð²ÐµÐ½": "ÐŸÐ»",
            "Ð¼ÑÑÑ‚Ð¾": "ÐœÑ",
            "Ñ‚ÐµÑ€Ð°ÑÐ°": "Ð¢ÐµÑ€",
            "Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð°": "Ðœ-Ð»Ð°",
            "Ð¿Ð»Ð¾Ñ‰Ð°Ð´": "ÐŸÐ»",
            "Ð¿ÐµÑˆ": "ÐŸÐµÑˆ",
            "Ð·Ð°Ð»Ð¸Ð²": "Ð—-Ð²",
            "Ð¿ÑŠÑ‚ÐµÐºÐ°": "ÐŸ-ÐºÐ°",
            "Ð¿Ð»Ð°Ñ‚Ð½Ð¾": "ÐŸÐ»",
            "ÑƒÐ»Ð¸Ñ†Ð°": "Ð£Ð»",
            "Ð°Ð»ÐµÑ": "ÐÐ»",
            "Ð¿ÐµÑˆÐµÑ…Ð¾Ð´Ð½Ð°": "ÐŸÐµÑˆ",
            "Ñ‚Ð¾Ñ‡ÐºÐ°": "Ð¢Ñ‡",
            "Ð·Ð°Ð´Ð¼Ð¸Ð½Ð°Ð²Ð°Ð½Ðµ": "Ð—Ð°Ð´Ð¼",
            "ÐºÑ€ÑŠÐ³Ð¾Ð²Ð¾": "ÐšÑ€",
            "Ð²Ñ€ÑŠÑ…": "Ð’Ñ€",
            "ÑÑŠÐ´": "Ð¡Ð´",
            "Ð±ÑƒÐ»ÐµÐ²Ð°Ñ€Ð´": "Ð‘ÑƒÐ»",
            "Ð¿ÑŠÑ‚": "ÐŸÑŠÑ‚",
            "ÑÐºÐ¾Ñ€Ð¾ÑÑ‚Ð½Ð°": "Ð¡ÐºÐ¾Ñ€",
            "Ð¼Ð¾ÑÑ‚": "ÐœÐ¾"
        },
        "directions": {
            "ÑÐµÐ²ÐµÑ€Ð¾Ð·Ð°Ð¿Ð°Ð´": "Ð¡Ð—",
            "ÑÐµÐ²ÐµÑ€Ð¾Ð¸Ð·Ñ‚Ð¾Ðº": "Ð¡Ð˜",
            "ÑŽÐ³Ð¾Ð·Ð°Ð¿Ð°Ð´": "Ð®Ð—",
            "ÑŽÐ³Ð¾Ð¸Ð·Ñ‚Ð¾Ðº": "Ð®Ð˜",
            "ÑÐµÐ²ÐµÑ€": "Ð¡",
            "Ð¸Ð·Ñ‚Ð¾Ðº": "Ð˜",
            "ÑŽÐ³": "Ð®"
        }
    }
    
    },{}],6:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "comunicacions": "Com.",
            "entitat de poblaciÃ³": "Nucli",
            "disseminat": "Diss.",
            "cap de municipi": "Cap",
            "indret": "Indr.",
            "comarca": "Cca.",
            "relleu del litoral": "Lit.",
            "municipi": "Mun.",
            "xarxa hidrogrÃ fica": "Curs Fluv.",
            "equipament": "Equip.",
            "orografia": "Orogr.",
            "barri": "Barri",
            "edificaciÃ³": "Edif.",
            "edificaciÃ³ histÃ²rica": "Edif. Hist.",
            "entitat descentralitzada": "E.M.D.",
            "element hidrogrÃ fic": "Hidr."
        },
        "classifications": {
            "rotonda": "Rot.",
            "carrerada": "Ca.",
            "jardÃ­": "J.",
            "paratge": "Pge.",
            "pont": "Pont",
            "lloc": "Lloc",
            "rambla": "Rbla.",
            "cases": "Cses.",
            "barranc": "Bnc.",
            "plana": "Plana",
            "polÃ­gon": "Pol.",
            "muralla": "Mur.",
            "enllaÃ§": "EllaÃ§",
            "antiga carretera": "Actra",
            "glorieta": "Glor.",
            "autovia": "Autv.",
            "prolongaciÃ³": "Prol.",
            "calÃ§ada": "Cda.",
            "carretera": "Ctra.",
            "pujada": "Pda.",
            "torrent": "T.",
            "disseminat": "Disse",
            "barri": "B.",
            "cinturÃ³": "Cinto",
            "passera": "Psera",
            "sender": "Send.",
            "carrer": "C.",
            "sÃ¨quia": "SÃ¨q.",
            "blocs": "Bloc",
            "rambleta": "Rblt.",
            "partida": "Par.",
            "costa": "Cos.",
            "sector": "Sec.",
            "corralÃ³": "Crral",
            "urbanitzaciÃ³": "Urb.",
            "autopista": "Autp.",
            "grup": "Gr.",
            "platja": "Pja.",
            "jardins": "J.",
            "complex": "Comp.",
            "portals": "Ptals",
            "finca": "Fin.",
            "travessera": "Trav.",
            "plaÃ§a": "Pl.",
            "travessia": "Trv.",
            "polÃ­gon industrial": "PI.",
            "passatge": "Ptge.",
            "apartaments": "Apmt.",
            "mirador": "Mira.",
            "antic": "Antic",
            "accÃ©s": "Acc.",
            "colÃ²nia": "Col.",
            "corriol": "Crol.",
            "portal": "Ptal.",
            "porta": "Pta.",
            "port": "Port",
            "carrerÃ³": "CrÃ³.",
            "riera": "Ra.",
            "circumvalÂ·laciÃ³": "Cval.",
            "baixada": "Bda.",
            "placeta": "Plta.",
            "escala": "Esc.",
            "gran via": "GV",
            "rial": "Rial",
            "conjunt": "Conj.",
            "avinguda": "Av.",
            "esplanada": "Esp.",
            "cantonada": "Cant.",
            "ronda": "Rda.",
            "corredor": "Cdor.",
            "drecera": "Drec.",
            "passadÃ­s": "PdÃ­s.",
            "viaducte": "Vdct.",
            "passeig": "Pg.",
            "veÃ¯nat": "VeÃ¯."
        },
        "directions": {
            "sudest": "SE",
            "sudoest": "SO",
            "nordest": "NE",
            "nordoest": "NO",
            "est": "E",
            "nord": "N",
            "oest": "O",
            "sud": "S"
        }
    }
    
    },{}],7:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "skole": "Sk.",
            "ved": "v.",
            "centrum": "C.",
            "sankt": "Skt.",
            "vestre": "v.",
            "hospital": "Hosp.",
            "strÃ¦de": "Str.",
            "nordre": "Nr.",
            "plads": "Pl.",
            "universitet": "Uni.",
            "vÃ¦nge": "vg.",
            "station": "St."
        },
        "classifications": {
            "avenue": "Ave",
            "gammel": "Gl.",
            "dronning": "Dronn.",
            "sÃ¸nder": "Sdr.",
            "nÃ¸rre": "Nr.",
            "vester": "V.",
            "vestre": "V.",
            "Ã¸ster": "Ã˜.",
            "Ã¸stre": "Ã˜.",
            "boulevard": "Boul."
        },
        "directions": {
            "sydÃ¸st": "SÃ˜",
            "nordvest": "NV",
            "syd": "S",
            "nordÃ¸st": "NÃ˜",
            "sydvest": "SV",
            "vest": "V",
            "nord": "N",
            "Ã¸st": "Ã˜"
        }
    }
    
    },{}],8:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {},
        "classifications": {},
        "directions": {
            "osten": "O",
            "nordosten": "NO",
            "sÃ¼den": "S",
            "nordwest": "NW",
            "norden": "N",
            "sÃ¼dost": "SO",
            "sÃ¼dwest": "SW",
            "westen": "W"
        }
    }
    
    },{}],9:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "square": "Sq",
            "centre": "Ctr",
            "sister": "Sr",
            "lake": "Lk",
            "fort": "Ft",
            "route": "Rte",
            "william": "Wm",
            "national": "Natâ€™l",
            "junction": "Jct",
            "center": "Ctr",
            "saint": "St",
            "saints": "SS",
            "station": "Sta",
            "mount": "Mt",
            "junior": "Jr",
            "mountain": "Mtn",
            "heights": "Hts",
            "university": "Univ",
            "school": "Sch",
            "international": "Intâ€™l",
            "apartments": "Apts",
            "crossing": "Xing",
            "creek": "Crk",
            "township": "Twp",
            "downtown": "Dtwn",
            "father": "Fr",
            "senior": "Sr",
            "point": "Pt",
            "river": "Riv",
            "market": "Mkt",
            "village": "Vil",
            "park": "Pk",
            "memorial": "Mem"
        },
        "classifications": {
            "place": "Pl",
            "circle": "Cir",
            "bypass": "Byp",
            "motorway": "Mwy",
            "crescent": "Cres",
            "road": "Rd",
            "cove": "Cv",
            "lane": "Ln",
            "square": "Sq",
            "street": "St",
            "freeway": "Fwy",
            "walk": "Wk",
            "plaza": "Plz",
            "parkway": "Pky",
            "avenue": "Ave",
            "pike": "Pk",
            "drive": "Dr",
            "highway": "Hwy",
            "footway": "Ftwy",
            "point": "Pt",
            "court": "Ct",
            "terrace": "Ter",
            "walkway": "Wky",
            "alley": "Aly",
            "expressway": "Expy",
            "bridge": "Br",
            "boulevard": "Blvd",
            "turnpike": "Tpk"
        },
        "directions": {
            "southeast": "SE",
            "northwest": "NW",
            "south": "S",
            "west": "W",
            "southwest": "SW",
            "north": "N",
            "east": "E",
            "northeast": "NE"
        }
    }
    
    },{}],10:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "segunda": "2Âª",
            "octubre": "8bre",
            "doctores": "Drs",
            "doctora": "Dra",
            "internacional": "Intl",
            "doctor": "Dr",
            "segundo": "2Âº",
            "seÃ±orita": "Srta",
            "doctoras": "Drs",
            "primera": "1Âª",
            "primero": "1Âº",
            "san": "S",
            "colonia": "Col",
            "doÃ±a": "DÃ±a",
            "septiembre": "7bre",
            "diciembre": "10bre",
            "seÃ±or": "Sr",
            "ayuntamiento": "Ayto",
            "seÃ±ora": "Sra",
            "tercera": "3Âª",
            "tercero": "3Âº",
            "don": "D",
            "santa": "Sta",
            "ciudad": "Cdad",
            "noviembre": "9bre",
            "departamento": "Dep"
        },
        "classifications": {
            "camino": "Cmno",
            "avenida": "Av",
            "paseo": "PÂº",
            "autopista": "Auto",
            "calle": "C",
            "plaza": "Pza",
            "carretera": "Crta"
        },
        "directions": {
            "este": "E",
            "noreste": "NE",
            "sur": "S",
            "suroeste": "SO",
            "noroeste": "NO",
            "oeste": "O",
            "sureste": "SE",
            "norte": "N"
        }
    }
    
    },{}],11:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "allÃ©e": "All",
            "aÃ©rodrome": "AÃ©rod",
            "aÃ©roport": "AÃ©rop"
        },
        "classifications": {
            "centrale": "Ctrale",
            "campings": "Camp.",
            "urbains": "Urb.",
            "mineure": "Min.",
            "publique": "Publ.",
            "supÃ©rieur": "Sup.",
            "fÃ©dÃ©ration": "FÃ©d.",
            "notre-dame": "ND",
            "saint": "St",
            "centre hospitalier rÃ©gional": "CHR",
            "exploitation": "Exploit.",
            "gÃ©nÃ©ral": "Gal",
            "civiles": "Civ.",
            "maritimes": "Marit.",
            "aviation": "Aviat.",
            "iii": "3",
            "archÃ©ologique": "ArchÃ©o.",
            "musical": "Music.",
            "musicale": "Music.",
            "immeuble": "Imm.",
            "xv": "15",
            "hÃ´tel": "HÃ´t.",
            "alpine": "Alp.",
            "communale": "Commun.",
            "v": "5",
            "global": "Glob.",
            "universitÃ©": "Univ.",
            "confÃ©dÃ©ral": "ConfÃ©d.",
            "xx": "20",
            "x": "10",
            "piscine": "Pisc.",
            "dimanche": "di.",
            "fleuve": "Flv",
            "postaux": "Post.",
            "musicienne": "Music.",
            "dÃ©partement": "DÃ©pt",
            "fÃ©vrier": "FÃ©vr.",
            "municipales": "Munic.",
            "province": "Prov.",
            "communautÃ©s": "CommtÃ©s",
            "barrage": "Barr.",
            "mercredi": "me.",
            "prÃ©sidentes": "Pdtes",
            "cafÃ©tÃ©rias": "CafÃ©t.",
            "thÃ©Ã¢tral": "ThÃ©.",
            "viticulteur": "Vitic.",
            "poste": "Post.",
            "spÃ©cialisÃ©e": "SpÃ©c.",
            "agriculture": "Agric.",
            "infirmier": "Infirm.",
            "animation": "Anim.",
            "mondiale": "Mond.",
            "arrÃªt": "Arr.",
            "zone": "zon.",
            "municipaux": "Munic.",
            "grand": "Gd",
            "janvier": "Janv.",
            "fondateur": "Fond.",
            "premiÃ¨re": "1re",
            "municipale": "Munic.",
            "direction": "Dir.",
            "anonyme": "Anon.",
            "dÃ©partementale": "DÃ©pt",
            "moyens": "Moy.",
            "novembre": "Nov.",
            "jardin": "Jard.",
            "petites": "Pet.",
            "privÃ©": "Priv.",
            "centres": "Ctres",
            "forestier": "Forest.",
            "xiv": "14",
            "africaines": "Afric.",
            "sergent": "Sgt",
            "europÃ©enne": "Eur.",
            "privÃ©e": "Priv.",
            "cafÃ©": "CfÃ©",
            "xix": "19",
            "hautes": "Htes",
            "major": "Mjr",
            "vendredi": "ve.",
            "municipalitÃ©": "Munic.",
            "sous-prÃ©fecture": "Ss-prÃ©f.",
            "spÃ©ciales": "SpÃ©c.",
            "secondaires": "Second.",
            "viie": "7e",
            "moyenne": "Moy.",
            "commerciale": "Commerc.",
            "rÃ©gion": "RÃ©g.",
            "amÃ©ricaines": "AmÃ©r.",
            "amÃ©ricains": "AmÃ©r.",
            "service": "Sce",
            "professeur": "Prof.",
            "dÃ©partemental": "DÃ©pt",
            "hÃ´tels": "HÃ´t.",
            "mondiales": "Mond.",
            "ire": "1re",
            "caporal": "Capo.",
            "militaire": "Milit.",
            "lycÃ©e d'enseignement professionnel": "LEP",
            "adjudant": "Adj.",
            "mÃ©dicale": "MÃ©d.",
            "confÃ©rences": "ConfÃ©r.",
            "universelle": "Univ.",
            "xiie": "12e",
            "supÃ©rieures": "Sup.",
            "naturel": "Natur.",
            "sociÃ©tÃ© nationale": "SN",
            "hospitalier": "Hosp.",
            "culturelle": "Cult.",
            "amÃ©ricain": "AmÃ©r.",
            "son altesse royale": "S.A.R.",
            "infirmiÃ¨re": "Infirm.",
            "viii": "8",
            "fondatrice": "Fond.",
            "madame": "Mme",
            "mÃ©tropolitain": "MÃ©trop.",
            "ophtalmologues": "Ophtalmos",
            "xviie": "18e",
            "viiie": "8e",
            "commerÃ§ante": "CommerÃ§.",
            "centre d'enseignement du second degrÃ©": "CES",
            "septembre": "Sept.",
            "agriculteur": "Agric.",
            "xiii": "13",
            "pontifical": "Pontif.",
            "cafÃ©tÃ©ria": "CafÃ©t.",
            "prince": "Pce",
            "vie": "6e",
            "archiduchesse": "Archid.",
            "occidental": "Occ.",
            "spectacles": "Spect.",
            "camping": "Camp.",
            "mÃ©tro": "MÂº",
            "arrondissement": "Arrond.",
            "viticole": "Vitic.",
            "ii": "2",
            "siÃ¨cle": "Si.",
            "chapelles": "Chap.",
            "centre": "Ctre",
            "sapeur-pompiers": "Sap.-pomp.",
            "Ã©tablissements": "Ã‰tabts",
            "sociÃ©tÃ© anonyme": "SA",
            "directeurs": "Dir.",
            "vii": "7",
            "culturel": "Cult.",
            "central": "Ctral",
            "mÃ©tropolitaine": "MÃ©trop.",
            "administrations": "Admin.",
            "amiraux": "Amir.",
            "sur": "s/",
            "premiers": "1ers",
            "provence-alpes-cÃ´te d'azur": "PACA",
            "cathÃ©drale": "CathÃ©d.",
            "iv": "4",
            "postale": "Post.",
            "social": "Soc.",
            "spÃ©cialisÃ©": "SpÃ©c.",
            "district": "Distr.",
            "technologique": "Techno.",
            "viticoles": "Vitic.",
            "ix": "9",
            "protÃ©gÃ©s": "Prot.",
            "historiques": "Hist.",
            "sous": "s/s",
            "national": "Nal",
            "ambassade": "Amb.",
            "cafÃ©s": "CfÃ©s",
            "agronomie": "Agro.",
            "sapeurs": "Sap.",
            "petits": "Pet.",
            "monsieur": "M.",
            "boucher": "Bouch.",
            "restaurant": "Restau.",
            "lycÃ©e": "Lyc.",
            "urbaine": "Urb.",
            "prÃ©fecture": "PrÃ©f.",
            "districts": "Distr.",
            "civil": "Civ.",
            "protÃ©gÃ©es": "Prot.",
            "sapeur": "Sap.",
            "thÃ©Ã¢tre": "ThÃ©.",
            "collÃ¨ge": "Coll.",
            "mardi": "ma.",
            "mÃ©morial": "MÃ©mor.",
            "africain": "Afric.",
            "rÃ©publicaine": "RÃ©publ.",
            "sociale": "Soc.",
            "spÃ©cial": "SpÃ©c.",
            "technologie": "Techno.",
            "charcuterie": "Charc.",
            "commerces": "Commerc.",
            "fluviale": "Flv",
            "parachutistes": "Para.",
            "primaires": "Prim.",
            "directions": "Dir.",
            "prÃ©sidentiel": "Pdtl",
            "nationales": "Nales",
            "aprÃ¨s": "apr.",
            "samedi": "sa.",
            "unitÃ©": "U.",
            "xxiii": "23",
            "associÃ©": "Assoc.",
            "Ã©lectrique": "Ã‰lectr.",
            "populaire": "Pop.",
            "asiatique": "Asiat.",
            "navigable": "Navig.",
            "prÃ©sidente": "Pdte",
            "xive": "14e",
            "associÃ©s": "Assoc.",
            "pompiers": "Pomp.",
            "agricoles": "Agric.",
            "Ã©lÃ©m": "Ã‰lÃ©m.",
            "dÃ©cembre": "DÃ©c.",
            "son altesse": "S.Alt.",
            "aprÃ¨s-midi": "a.-m.",
            "mineures": "Min.",
            "juillet": "Juil.",
            "aviatrices": "Aviat.",
            "fondation": "Fond.",
            "pontificaux": "Pontif.",
            "temple": "Tple",
            "europÃ©ennes": "Eur.",
            "rÃ©gionale": "RÃ©g.",
            "informations": "Infos",
            "mondiaux": "Mond.",
            "infanterie": "Infant.",
            "archÃ©ologie": "ArchÃ©o.",
            "dans": "d/",
            "hospice": "Hosp.",
            "spectacle": "Spect.",
            "hÃ´tels-restaurants": "HÃ´t.-Rest.",
            "hÃ´tel-restaurant": "HÃ´t.-Rest.",
            "hÃ©licoptÃ¨re": "hÃ©lico",
            "xixe": "19e",
            "cliniques": "Clin.",
            "docteur": "Dr",
            "secondaire": "Second.",
            "municipal": "Munic.",
            "gÃ©nÃ©rale": "Gale",
            "chÃ¢teau": "ChÃ¢t.",
            "commerÃ§ant": "CommerÃ§.",
            "avril": "Avr.",
            "clinique": "Clin.",
            "urbaines": "Urb.",
            "navale": "Nav.",
            "navigation": "Navig.",
            "asiatiques": "Asiat.",
            "pontificales": "Pontif.",
            "administrative": "Admin.",
            "syndicat": "Synd.",
            "lundi": "lu.",
            "petite": "Pet.",
            "maritime": "Marit.",
            "mÃ©tros": "MÂº",
            "enseignement": "Enseign.",
            "fluviales": "Flv",
            "historique": "Hist.",
            "comtÃ©s": "CtÃ©s",
            "rÃ©sidentiel": "RÃ©sid.",
            "international": "Int.",
            "supÃ©rieure": "Sup.",
            "centre hospitalier universitaire": "CHU",
            "confÃ©dÃ©ration": "ConfÃ©d.",
            "boucherie": "Bouch.",
            "fondatrices": "Fond.",
            "mÃ©dicaux": "MÃ©d.",
            "europÃ©ens": "Eur.",
            "orientaux": "Ori.",
            "naval": "Nav.",
            "Ã©tang": "Ã‰tg",
            "provincial": "Prov.",
            "junior": "Jr",
            "dÃ©partementales": "DÃ©pt",
            "musique": "Musiq.",
            "directrices": "Dir.",
            "marÃ©chal": "Mal",
            "civils": "Civ.",
            "protÃ©gÃ©": "Prot.",
            "Ã©tablissement": "Ã‰tabt",
            "trafic": "Traf.",
            "aviateur": "Aviat.",
            "archives": "Arch.",
            "africains": "Afric.",
            "maternelle": "Matern.",
            "industrielle": "Ind.",
            "administratif": "Admin.",
            "oriental": "Ori.",
            "universitaire": "Univ.",
            "majeur": "Maj.",
            "haute": "Hte",
            "communal": "Commun.",
            "petit": "Pet.",
            "commune": "Commun.",
            "exploitant": "Exploit.",
            "confÃ©rence": "ConfÃ©r.",
            "monseigneur": "Mgr",
            "pharmacien": "Pharm.",
            "jeudi": "je.",
            "primaire": "Prim.",
            "hÃ©licoptÃ¨res": "hÃ©licos",
            "agronomique": "Agro.",
            "mÃ©decin": "MÃ©d.",
            "ve": "5e",
            "pontificale": "Pontif.",
            "ier": "1er",
            "cinÃ©ma": "CinÃ©",
            "fluvial": "Flv",
            "occidentaux": "Occ.",
            "commerÃ§ants": "CommerÃ§.",
            "banque": "Bq",
            "moyennes": "Moy.",
            "pharmacienne": "Pharm.",
            "dÃ©mocratique": "DÃ©m.",
            "cinÃ©mas": "CinÃ©s",
            "spÃ©ciale": "SpÃ©c.",
            "prÃ©sidents": "Pdts",
            "directrice": "Dir.",
            "vi": "6",
            "basse": "Bas.",
            "xve": "15e",
            "Ã©tat": "Ã‰.",
            "aviateurs": "Aviat.",
            "majeurs": "Maj.",
            "infirmiers": "Infirm.",
            "Ã©glise": "Ã‰gl.",
            "confÃ©dÃ©rale": "ConfÃ©d.",
            "xxie": "21e",
            "comte": "Cte",
            "europÃ©en": "Eur.",
            "union": "U.",
            "pharmacie": "Pharm.",
            "infirmiÃ¨res": "Infirm.",
            "comtÃ©": "CtÃ©",
            "sportive": "Sport.",
            "deuxiÃ¨me": "2e",
            "xvi": "17",
            "haut": "Ht",
            "mÃ©dicales": "MÃ©d.",
            "dÃ©veloppÃ©": "DÃ©velop.",
            "bÃ¢timent": "BÃ¢t.",
            "commerce": "Commerc.",
            "ive": "4e",
            "associatif": "Assoc.",
            "rural": "Rur.",
            "cimetiÃ¨re": "Cim.",
            "rÃ©gional": "RÃ©g.",
            "ferroviaire": "Ferr.",
            "vers": "v/",
            "mosquÃ©e": "Mosq.",
            "mineurs": "Min.",
            "nautique": "Naut.",
            "chÃ¢teaux": "ChÃ¢t.",
            "sportif": "Sport.",
            "mademoiselle": "Mle",
            "Ã©cole": "Ã‰c.",
            "doyen": "Doy.",
            "industriel": "Ind.",
            "chapelle": "Chap.",
            "sociÃ©tÃ©s": "StÃ©s",
            "internationale": "Int.",
            "coopÃ©ratif": "Coop.",
            "hospices": "Hosp.",
            "xxii": "22",
            "parachutiste": "Para.",
            "alpines": "Alp.",
            "civile": "Civ.",
            "xvie": "17e",
            "Ã©tats": "Ã‰.",
            "musÃ©e": "MsÃ©e",
            "centrales": "Ctrales",
            "globaux": "Glob.",
            "supÃ©rieurs": "Sup.",
            "syndicats": "Synd.",
            "archevÃªque": "Archev.",
            "docteurs": "Drs",
            "bibliothÃ¨que": "Biblio.",
            "lieutenant": "Lieut.",
            "rÃ©publique": "RÃ©p.",
            "vÃ©tÃ©rinaire": "VÃ©t.",
            "dÃ©partementaux": "DÃ©pt",
            "premier": "1er",
            "fluviaux": "Flv",
            "animÃ©": "Anim.",
            "orientales": "Ori.",
            "technologiques": "Techno.",
            "princesse": "Pse",
            "routiÃ¨re": "Rout.",
            "coopÃ©rative": "Coop.",
            "scolaire": "Scol.",
            "Ã©coles": "Ã‰c.",
            "football": "Foot",
            "territoriale": "Territ.",
            "commercial": "Commerc.",
            "mineur": "Min.",
            "millÃ©naires": "Mill.",
            "association": "Assoc.",
            "catholique": "Cathol.",
            "administration": "Admin.",
            "mairie": "Mair.",
            "portuaire": "Port.",
            "tertiaires": "Terti.",
            "thÃ©Ã¢trale": "ThÃ©.",
            "palais": "Pal.",
            "troisiÃ¨me": "3e",
            "directeur": "Dir.",
            "vÃ©tÃ©rinaires": "VÃ©t.",
            "facultÃ©": "Fac.",
            "occidentales": "Occ.",
            "viticulteurs": "Vitic.",
            "xvii": "18",
            "occidentale": "Occ.",
            "amiral": "Amir.",
            "professionnel": "Profess.",
            "administratives": "Admin.",
            "commerciales": "Commerc.",
            "saints": "Sts",
            "agronomes": "Agro.",
            "stade": "Std",
            "sous-prÃ©fet": "Ss-prÃ©f.",
            "senior": "Sr",
            "agronome": "Agro.",
            "terrain": "Terr.",
            "catholiques": "Cathol.",
            "rÃ©sidentielle": "RÃ©sid.",
            "grands": "Gds",
            "exploitants": "Exploit.",
            "xiiie": "13e",
            "croix": "Cx",
            "gÃ©nÃ©raux": "Gaux",
            "crÃ©dit": "CrÃ©d.",
            "cimetiÃ¨res": "Cim.",
            "antenne": "Ant.",
            "mÃ©dical": "MÃ©d.",
            "collÃ¨ges": "Coll.",
            "musicien": "Music.",
            "apostolique": "Apost.",
            "postal": "Post.",
            "territorial": "Territ.",
            "urbanisme": "Urb.",
            "prÃ©fectorale": "PrÃ©f.",
            "fondateurs": "Fond.",
            "information": "Info.",
            "Ã©glises": "Ã‰gl.",
            "ophtalmologue": "Ophtalmo",
            "congrÃ©gation": "CongrÃ©g.",
            "charcutier": "Charc.",
            "Ã©tage": "Ã©t.",
            "consulat": "Consul.",
            "public": "Publ.",
            "ferrÃ©e": "Ferr.",
            "matin": "mat.",
            "sociÃ©tÃ© anonyme Ã  responsabilitÃ© limitÃ©e": "SARL",
            "monuments": "Mmts",
            "protection": "Prot.",
            "universel": "Univ.",
            "nationale": "Nale",
            "prÃ©sident": "Pdt",
            "provinciale": "Prov.",
            "agriculteurs": "Agric.",
            "prÃ©fectoral": "PrÃ©f.",
            "xxe": "20e",
            "alpins": "Alp.",
            "avant": "av.",
            "infirmerie": "Infirm.",
            "deux mil": "2000",
            "rurale": "Rur.",
            "administratifs": "Admin.",
            "octobre": "Oct.",
            "archipel": "Archip.",
            "communautÃ©": "CommtÃ©",
            "globales": "Glob.",
            "alpin": "Alp.",
            "numÃ©ros": "NÂºË¢",
            "lieutenant-colonel": "Lieut.-Col.",
            "jÃ©sus-christ": "J.-C.",
            "agricole": "Agric.",
            "sa majestÃ©": "S.Maj.",
            "associative": "Assoc.",
            "xxi": "21",
            "prÃ©sidentielle": "Pdtle",
            "moyen": "Moy.",
            "fÃ©dÃ©ral": "FÃ©d.",
            "professionnelle": "Profess.",
            "tertiaire": "Terti.",
            "ixe": "9e",
            "hÃ´pital": "HÃ´p.",
            "technologies": "Techno.",
            "iiie": "3e",
            "dÃ©veloppement": "DÃ©velop.",
            "monument": "Mmt",
            "forestiÃ¨re": "Forest.",
            "numÃ©ro": "NÂº",
            "viticulture": "Vitic.",
            "traversiÃ¨re": "Traver.",
            "technique": "Tech.",
            "Ã©lectriques": "Ã‰lectr.",
            "militaires": "Milit.",
            "pompier": "Pomp.",
            "amÃ©ricaine": "AmÃ©r.",
            "prÃ©fet": "PrÃ©f.",
            "congrÃ©gations": "CongrÃ©g.",
            "pÃ¢tissier": "PÃ¢tiss.",
            "mondial": "Mond.",
            "ophtalmologie": "Ophtalm.",
            "sainte": "Ste",
            "africaine": "Afric.",
            "aviatrice": "Aviat.",
            "doyens": "Doy.",
            "sociÃ©tÃ©": "StÃ©",
            "majeures": "Maj.",
            "orientale": "Ori.",
            "ministÃ¨re": "Min.",
            "archiduc": "Archid.",
            "territoire": "Territ.",
            "techniques": "Tech.",
            "Ã®le-de-france": "IDF",
            "globale": "Glob.",
            "xe": "10e",
            "xie": "11e",
            "majeure": "Maj.",
            "commerciaux": "Commerc.",
            "maire": "Mair.",
            "spÃ©ciaux": "SpÃ©c.",
            "grande": "Gde",
            "messieurs": "MM",
            "colonel": "Col.",
            "millÃ©naire": "Mill.",
            "xi": "11",
            "urbain": "Urb.",
            "fÃ©dÃ©rale": "FÃ©d.",
            "ferrÃ©": "Ferr.",
            "riviÃ¨re": "Riv.",
            "rÃ©publicain": "RÃ©publ.",
            "grandes": "Gdes",
            "rÃ©giment": "RÃ©gim.",
            "hauts": "Hts",
            "catÃ©gorie": "CatÃ©g.",
            "basses": "Bas.",
            "xii": "12",
            "agronomiques": "Agro.",
            "iie": "2e",
            "protÃ©gÃ©e": "Prot.",
            "sapeur-pompier": "Sap.-pomp."
        },
        "directions": {
            "est-nord-est": "ENE",
            "nord-est": "NE",
            "ouest": "O",
            "sud-est": "SE",
            "est-sud-est": "ESE",
            "nord-nord-est": "NNE",
            "sud": "S",
            "nord-nord-ouest": "NNO",
            "nord-ouest": "NO",
            "nord": "N",
            "ouest-sud-ouest": "OSO",
            "ouest-nord-ouest": "ONO",
            "sud-ouest": "SO",
            "sud-sud-est": "SSE",
            "sud-sud-ouest": "SSO",
            "est": "E"
        }
    }
    
    },{}],12:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "×©×“×¨×•×ª": "×©×“'"
        },
        "classifications": {},
        "directions": {}
    }
    
    },{}],13:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {},
        "classifications": {},
        "directions": {
            "kelet": "K",
            "Ã©szakkelet": "Ã‰K",
            "dÃ©l": "D",
            "Ã©szaknyugat": "Ã‰NY",
            "Ã©szak": "Ã‰",
            "dÃ©lkelet": "DK",
            "dÃ©lnyugat": "DNY",
            "nyugat": "NY"
        }
    }
    
    },{}],14:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "apartamentai": "Apt",
            "aukÅ¡tumos": "AukÅ¡",
            "centras": "Ctr",
            "eÅ¾eras": "EÅ¾",
            "fortas": "Ft",
            "greitkelis": "Grtkl",
            "juosta": "Jst",
            "kaimas": "Km",
            "kalnas": "Kln",
            "kelias": "Kl",
            "kiemelis": "Kml",
            "miestelis": "Mstl",
            "miesto centras": "M.Ctr",
            "mokykla": "Mok",
            "nacionalinis": "Nac",
            "paminklas": "Pmkl",
            "parkas": "Pk",
            "pusratis": "Psrt",
            "sankryÅ¾a": "SkrÅ¾",
            "sesÄ—": "SesÄ—",
            "skveras": "Skv",
            "stotis": "St",
            "Å¡v": "Å v",
            "tarptautinis": "Trptaut",
            "taÅ¡kas": "TÅ¡k",
            "tÄ—vas": "TÄ—v",
            "turgus": "Tgs",
            "universitetas": "Univ",
            "upÄ—": "Up",
            "upelis": "Up",
            "vieta": "Vt"
        },
        "classifications": {
            "aikÅ¡tÄ—": "a.",
            "alÄ—ja": "al.",
            "aplinkkelis": "aplinkl.",
            "autostrada": "auto.",
            "bulvaras": "b.",
            "gatvÄ—": "g.",
            "kelias": "kel.",
            "krantinÄ—": "krant.",
            "prospektas": "pr.",
            "plentas": "pl.",
            "skersgatvis": "skg.",
            "takas": "tak.",
            "tiltas": "tlt."
        },
        "directions": {
            "pietÅ«s": "P",
            "vakarai": "V",
            "Å¡iaurÄ—": "Å ",
            "Å¡iaurÄ—s vakarai": "Å V",
            "pietryÄiai": "PR",
            "Å¡iaurÄ—s rytai": "Å R",
            "rytai": "R",
            "pietvakariai": "PV"
        }
    }
    
    },{}],15:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "centrum": "Cntrm",
            "nationaal": "Natâ€™l",
            "berg": "Brg",
            "meer": "Mr",
            "kruising": "Krsng",
            "toetreden": "Ttrdn"
        },
        "classifications": {
            "bypass": "Pass",
            "brug": "Br",
            "straat": "Str",
            "rechtbank": "Rbank",
            "snoek": "Snk",
            "autobaan": "Baan",
            "terras": "Trrs",
            "punt": "Pt",
            "plaza": "Plz",
            "rijden": "Rijd",
            "parkway": "Pky",
            "inham": "Nham",
            "snelweg": "Weg",
            "halve maan": "Maan",
            "cirkel": "Crkl",
            "laan": "Ln",
            "rijbaan": "Strook",
            "weg": "Weg",
            "lopen": "Lpn",
            "autoweg": "Weg",
            "boulevard": "Blvd",
            "plaats": "Plts",
            "steeg": "Stg",
            "voetpad": "Stoep"
        },
        "directions": {
            "noordoost": "NO",
            "westen": "W",
            "zuiden": "Z",
            "zuidwest": "ZW",
            "oost": "O",
            "zuidoost": "ZO",
            "noordwest": "NW",
            "noorden": "N"
        }
    }
    
    },{}],16:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "Ð°Ð¿Ð¾ÑÑ‚Ð¾Ð»Ð°": "Ð°Ð¿.",
            "Ð°Ð¿Ð¾ÑÑ‚Ð¾Ð»Ð¾Ð²": "Ð°Ð¿Ð¿.",
            "Ð²ÐµÐ»Ð¸ÐºÐ¾Ð¼ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°": "Ð²Ð¼Ñ‡",
            "Ð²ÐµÐ»Ð¸ÐºÐ¾Ð¼ÑƒÑ‡ÐµÐ½Ð¸Ñ†Ñ‹": "Ð²Ð¼Ñ†.",
            "Ð²Ð»Ð°Ð´ÐµÐ½Ð¸Ðµ": "Ð²Ð».",
            "Ð³Ð¾Ñ€Ð¾Ð´": "Ð³.",
            "Ð´ÐµÑ€ÐµÐ²Ð½Ñ": "Ð´.",
            "Ð¸Ð¼ÐµÐ½Ð¸": "Ð¸Ð¼.",
            "Ð¼ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°":"Ð¼Ñ‡.",
            "Ð¼ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ¾Ð²": "Ð¼Ñ‡Ñ‡.",
            "Ð¼ÑƒÑ‡ÐµÐ½Ð¸Ñ†": "Ð¼Ñ†Ñ†.",
            "Ð¼ÑƒÑ‡ÐµÐ½Ð¸Ñ†Ñ‹": "Ð¼Ñ†.",
            "Ð¾Ð·ÐµÑ€Ð¾": "Ð¾.",
            "Ð¿Ð¾ÑÑ‘Ð»Ð¾Ðº": "Ð¿.",
            "Ð¿Ñ€ÐµÐ¿Ð¾Ð´Ð¾Ð±Ð½Ð¾Ð³Ð¾":  "Ð¿Ñ€Ð¿.",
            "Ð¿Ñ€ÐµÐ¿Ð¾Ð´Ð¾Ð±Ð½Ñ‹Ñ…": "Ð¿Ñ€Ð¿Ð¿.",
            "Ñ€ÐµÐºÐ°": "Ñ€.",
            "ÑÐ²ÑÑ‚Ð¸Ñ‚ÐµÐ»ÐµÐ¹": "ÑÐ²Ñ‚Ñ‚.",
            "ÑÐ²ÑÑ‚Ð¸Ñ‚ÐµÐ»Ñ": "ÑÐ²Ñ‚.",
            "ÑÐ²ÑÑ‰ÐµÐ½Ð½Ð¾Ð¼ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ°": "ÑÑ‰Ð¼Ñ‡.",
            "ÑÐ²ÑÑ‰ÐµÐ½Ð½Ð¾Ð¼ÑƒÑ‡ÐµÐ½Ð¸ÐºÐ¾Ð²": "ÑÑ‰Ð¼Ñ‡Ñ‡.",
            "ÑÑ‚Ð°Ð½Ñ†Ð¸Ñ": "ÑÑ‚.",
            "ÑƒÑ‡Ð°ÑÑ‚Ð¾Ðº": "ÑƒÑ‡."
        },
        "classifications": {
            "Ð¿Ñ€Ð¾ÐµÐ·Ð´": "Ð¿Ñ€-Ð´",
            "Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚": "Ð¿Ñ€.",
            "Ð¿ÐµÑ€ÐµÑƒÐ»Ð¾Ðº": "Ð¿ÐµÑ€.",
            "Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ": "Ð½Ð°Ð±.",
            "Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ": "Ð¿Ð».",
            "ÑˆÐ¾ÑÑÐµ": "Ñˆ.",
            "Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€": "Ð±.",
            "Ñ‚ÑƒÐ¿Ð¸Ðº": "Ñ‚ÑƒÐ¿.",
            "ÑƒÐ»Ð¸Ñ†Ð°": "ÑƒÐ»."
        },
        "directions": {
            "Ð²Ð¾ÑÑ‚Ð¾Ðº": "Ð’",
            "ÑÐµÐ²ÐµÑ€Ð¾-Ð²Ð¾ÑÑ‚Ð¾Ðº": "Ð¡Ð’",
            "ÑŽÐ³Ð¾-Ð²Ð¾ÑÑ‚Ð¾Ðº": "Ð®Ð’",
            "ÑŽÐ³Ð¾-Ð·Ð°Ð¿Ð°Ð´": "Ð®Ð—",
            "ÑÐµÐ²ÐµÑ€Ð¾-Ð·Ð°Ð¿Ð°Ð´": "Ð¡Ð—",
            "ÑÐµÐ²ÐµÑ€": "Ð¡",
            "Ð·Ð°Ð¿Ð°Ð´": "Ð—",
            "ÑŽÐ³": "Ð®"
        }
    }
    
    },{}],17:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {},
        "classifications": {},
        "directions": {
            "vzhod": "V",
            "severovzhod": "SV",
            "jug": "J",
            "severozahod": "SZ",
            "sever": "S",
            "jugovzhod": "JV",
            "jugozahod": "JZ",
            "zahod": "Z"
        }
    }
    
    },{}],18:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "sankta": "s:ta",
            "gamla": "G:la",
            "sankt": "s:t"
        },
        "classifications": {
            "Bro": "Br"
        },
        "directions": {
            "norr": "N",
            "sydÃ¶st": "SO",
            "vÃ¤ster": "V",
            "Ã¶ster": "O",
            "nordvÃ¤st": "NV",
            "sydvÃ¤st": "SV",
            "sÃ¶der": "S",
            "nordÃ¶st": "NO"
        }
    }
    
    },{}],19:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {},
        "classifications": {},
        "directions": {
            "ÑÑ…Ñ–Ð´": "Ð¡Ñ…",
            "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡Ð½Ð¸Ð¹ ÑÑ…Ñ–Ð´": "ÐŸÐ½Ð¡Ñ…",
            "Ð¿Ñ–Ð²Ð´ÐµÐ½ÑŒ": "ÐŸÐ´",
            "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡Ð½Ð¸Ð¹ Ð·Ð°Ñ…Ñ–Ð´": "ÐŸÐ½Ð—Ð´",
            "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡": "ÐŸÐ½",
            "Ð¿Ñ–Ð²Ð´ÐµÐ½Ð½Ð¸Ð¹ ÑÑ…Ñ–Ð´": "ÐŸÐ´Ð¡Ñ…",
            "Ð¿Ñ–Ð²Ð´ÐµÐ½Ð½Ð¸Ð¹ Ð·Ð°Ñ…Ñ–Ð´": "ÐŸÐ´Ð—Ñ…",
            "Ð·Ð°Ñ…Ñ–Ð´": "Ð—Ñ…"
        }
    }
    
    },{}],20:[function(_dereq_,module,exports){
    module.exports={
        "abbreviations": {
            "viá»‡n báº£o tÃ ng": "VBT",
            "thá»‹ tráº¥n": "Tt",
            "Ä‘áº¡i há»c": "ÄH",
            "cÄƒn cá»© khÃ´ng quan": "CCKQ",
            "cÃ¢u láº¡c bá»™": "CLB",
            "bÆ°u Ä‘iá»‡n": "BÄ",
            "khÃ¡ch sáº¡n": "KS",
            "khu du lá»‹ch": "KDL",
            "khu cÃ´ng nghiá»‡p": "KCN",
            "khu nghá»‰ mÃ¡t": "KNM",
            "thá»‹ xÃ£": "Tx",
            "khu chung cÆ°": "KCC",
            "phi trÆ°á»ng": "PT",
            "trung tÃ¢m": "TT",
            "tá»•ng cÃ´ng ty": "TCty",
            "trung há»c cÆ¡ sá»Ÿ": "THCS",
            "sÃ¢n bay quá»‘c táº¿": "SBQT",
            "trung há»c phá»• thÃ´ng": "THPT",
            "cao Ä‘áº³ng": "CÄ",
            "cÃ´ng ty": "Cty",
            "sÃ¢n bay": "SB",
            "thÃ nh phá»‘": "Tp",
            "cÃ´ng viÃªn": "CV",
            "sÃ¢n váº­n Ä‘á»™ng": "SVÄ",
            "linh má»¥c": "LM",
            "vÆ°á»n quá»‘c gia": "VQG"
        },
        "classifications": {
            "huyá»‡n lá»™": "HL",
            "Ä‘Æ°á»ng tá»‰nh": "ÄT",
            "quá»‘c lá»™": "QL",
            "xa lá»™": "XL",
            "hÆ°Æ¡ng lá»™": "HL",
            "tá»‰nh lá»™": "TL",
            "Ä‘Æ°á»ng huyá»‡n": "ÄH",
            "Ä‘Æ°á»ng cao tá»‘c": "ÄCT",
            "Ä‘áº¡i lá»™": "ÄL",
            "viá»‡t nam": "VN",
            "quáº£ng trÆ°á»ng": "QT",
            "Ä‘Æ°á»ng bá»™": "ÄB"
        },
        "directions": {
            "tÃ¢y": "T",
            "nam": "N",
            "Ä‘Ã´ng nam": "ÄN",
            "Ä‘Ã´ng báº¯c": "ÄB",
            "tÃ¢y nam": "TN",
            "Ä‘Ã´ng": "Ä",
            "báº¯c": "B"
        }
    }
    
    },{}],21:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "regExpFlags": "gi"
        },
        "v5": {
            "article": [
                ["^ Acc[Ã¨e]s ", " lâ€™accÃ¨s "],
                ["^ Aire ", " lâ€™aire "],
                ["^ All[Ã©e]e ", " lâ€™allÃ©e "],
                ["^ Anse ", " lâ€™anse "],
                ["^ (L['â€™])?Autoroute ", " lâ€™autoroute "],
                ["^ Avenue ", " lâ€™avenue "],
                ["^ Barreau ", " le barreau "],
                ["^ Boulevard ", " le boulevard "],
                ["^ Chemin ", " le chemin "],
                ["^ Petit[\\- ]Chemin ", " le petit chemin "],
                ["^ Cit[Ã©e] ", " la citÃ© "],
                ["^ Clos ", " le clos "],
                ["^ Corniche ", " la corniche "],
                ["^ Cour ", " la cour "],
                ["^ Cours ", " le cours "],
                ["^ D[Ã©e]viation ", " la dÃ©viation "],
                ["^ Entr[Ã©e]e ", " lâ€™entrÃ©e "],
                ["^ Esplanade ", " lâ€™esplanade "],
                ["^ Galerie ", " la galerie "],
                ["^ Impasse ", " lâ€™impasse "],
                ["^ Lotissement ", " le lotissement "],
                ["^ Mont[Ã©e]e ", " la montÃ©e "],
                ["^ Parc ", " le parc "],
                ["^ Parvis ", " le parvis "],
                ["^ Passage ", " le passage "],
                ["^ Place ", " la place "],
                ["^ Petit[\\- ]Pont ", " le petit-pont "],
                ["^ Pont ", " le pont "],
                ["^ Promenade ", " la promenade "],
                ["^ Quai ", " le quai "],
                ["^ Rocade ", " la rocade "],
                ["^ Rond[\\- ]?Point ", " le rond-point "],
                ["^ Route ", " la route "],
                ["^ Rue ", " la rue "],
                ["^ Grande Rue ", " la grande rue "],
                ["^ Sente ", " la sente "],
                ["^ Sentier ", " le sentier "],
                ["^ Sortie ", " la sortie "],
                ["^ Souterrain ", " le souterrain "],
                ["^ Square ", " le square "],
                ["^ Terrasse ", " la terrasse "],
                ["^ Traverse ", " la traverse "],
                ["^ Tunnel ", " le tunnel "],
                ["^ Viaduc ", " le viaduc "],
                ["^ Villa ", " la villa "],
                ["^ Village ", " le village "],
                ["^ Voie ", " la voie "],
    
                [" ([dl])'", " $1â€™"]
            ],
            "preposition": [
                ["^ Le ", "  du "],
                ["^ Les ", "  des "],
                ["^ La ", "  de La "],
    
                ["^ Acc[Ã¨e]s ", "  de lâ€™accÃ¨s "],
                ["^ Aire ", "  de lâ€™aire "],
                ["^ All[Ã©e]e ", "  de lâ€™allÃ©e "],
                ["^ Anse ", "  de lâ€™anse "],
                ["^ (L['â€™])?Autoroute ", "  de lâ€™autoroute "],
                ["^ Avenue ", "  de lâ€™avenue "],
                ["^ Barreau ", "  du barreau "],
                ["^ Boulevard ", "  du boulevard "],
                ["^ Chemin ", "  du chemin "],
                ["^ Petit[\\- ]Chemin ", "  du petit chemin "],
                ["^ Cit[Ã©e] ", "  de la citÃ© "],
                ["^ Clos ", "  du clos "],
                ["^ Corniche ", "  de la corniche "],
                ["^ Cour ", "  de la cour "],
                ["^ Cours ", "  du cours "],
                ["^ D[Ã©e]viation ", "  de la dÃ©viation "],
                ["^ Entr[Ã©e]e ", "  de lâ€™entrÃ©e "],
                ["^ Esplanade ", "  de lâ€™esplanade "],
                ["^ Galerie ", "  de la galerie "],
                ["^ Impasse ", "  de lâ€™impasse "],
                ["^ Lotissement ", "  du lotissement "],
                ["^ Mont[Ã©e]e ", "  de la montÃ©e "],
                ["^ Parc ", "  du parc "],
                ["^ Parvis ", "  du parvis "],
                ["^ Passage ", "  du passage "],
                ["^ Place ", "  de la place "],
                ["^ Petit[\\- ]Pont ", "  du petit-pont "],
                ["^ Pont ", "  du pont "],
                ["^ Promenade ", "  de la promenade "],
                ["^ Quai ", "  du quai "],
                ["^ Rocade ", "  de la rocade "],
                ["^ Rond[\\- ]?Point ", "  du rond-point "],
                ["^ Route ", "  de la route "],
                ["^ Rue ", "  de la rue "],
                ["^ Grande Rue ", "  de la grande rue "],
                ["^ Sente ", "  de la sente "],
                ["^ Sentier ", "  du sentier "],
                ["^ Sortie ", "  de la sortie "],
                ["^ Souterrain ", "  du souterrain "],
                ["^ Square ", "  du square "],
                ["^ Terrasse ", "  de la terrasse "],
                ["^ Traverse ", "  de la traverse "],
                ["^ Tunnel ", "  du tunnel "],
                ["^ Viaduc ", "  du viaduc "],
                ["^ Villa ", "  de la villa "],
                ["^ Village ", "  du village "],
                ["^ Voie ", "  de la voie "],
    
                ["^ ([AÃ‚Ã€EÃˆÃ‰ÃŠÃ‹IÃŽÃOÃ”UÃ™Ã›ÃœYÅ¸Ã†Å’])", "  dâ€™$1"],
                ["^ (\\S)", "  de $1"],
                [" ([dl])'", " $1â€™"]
            ],
            "rotary": [
                ["^ Le ", "  le rond-point du "],
                ["^ Les ", "  le rond-point des "],
                ["^ La ", "  le rond-point de La "],
    
                ["^ Acc[Ã¨e]s ", " le rond-point de lâ€™accÃ¨s "],
                ["^ Aire ", "  le rond-point de lâ€™aire "],
                ["^ All[Ã©e]e ", "  le rond-point de lâ€™allÃ©e "],
                ["^ Anse ", "  le rond-point de lâ€™anse "],
                ["^ (L['â€™])?Autoroute ", "  le rond-point de lâ€™autoroute "],
                ["^ Avenue ", "  le rond-point de lâ€™avenue "],
                ["^ Barreau ", "  le rond-point du barreau "],
                ["^ Boulevard ", "  le rond-point du boulevard "],
                ["^ Chemin ", "  le rond-point du chemin "],
                ["^ Petit[\\- ]Chemin ", "  le rond-point du petit chemin "],
                ["^ Cit[Ã©e] ", "  le rond-point de la citÃ© "],
                ["^ Clos ", "  le rond-point du clos "],
                ["^ Corniche ", "  le rond-point de la corniche "],
                ["^ Cour ", "  le rond-point de la cour "],
                ["^ Cours ", "  le rond-point du cours "],
                ["^ D[Ã©e]viation ", "  le rond-point de la dÃ©viation "],
                ["^ Entr[Ã©e]e ", "  le rond-point de lâ€™entrÃ©e "],
                ["^ Esplanade ", "  le rond-point de lâ€™esplanade "],
                ["^ Galerie ", "  le rond-point de la galerie "],
                ["^ Impasse ", "  le rond-point de lâ€™impasse "],
                ["^ Lotissement ", "  le rond-point du lotissement "],
                ["^ Mont[Ã©e]e ", "  le rond-point de la montÃ©e "],
                ["^ Parc ", "  le rond-point du parc "],
                ["^ Parvis ", "  le rond-point du parvis "],
                ["^ Passage ", "  le rond-point du passage "],
                ["^ Place ", "  le rond-point de la place "],
                ["^ Petit[\\- ]Pont ", "  le rond-point du petit-pont "],
                ["^ Pont ", "  le rond-point du pont "],
                ["^ Promenade ", "  le rond-point de la promenade "],
                ["^ Quai ", "  le rond-point du quai "],
                ["^ Rocade ", "  le rond-point de la rocade "],
                ["^ Rond[\\- ]?Point ", "  le rond-point "],
                ["^ Route ", "  le rond-point de la route "],
                ["^ Rue ", "  le rond-point de la rue "],
                ["^ Grande Rue ", "  le rond-point de la grande rue "],
                ["^ Sente ", "  le rond-point de la sente "],
                ["^ Sentier ", "  le rond-point du sentier "],
                ["^ Sortie ", "  le rond-point de la sortie "],
                ["^ Souterrain ", "  le rond-point du souterrain "],
                ["^ Square ", "  le rond-point du square "],
                ["^ Terrasse ", "  le rond-point de la terrasse "],
                ["^ Traverse ", "  le rond-point de la traverse "],
                ["^ Tunnel ", "  le rond-point du tunnel "],
                ["^ Viaduc ", "  le rond-point du viaduc "],
                ["^ Villa ", "  le rond-point de la villa "],
                ["^ Village ", "  le rond-point du village "],
                ["^ Voie ", "  le rond-point de la voie "],
    
                ["^ ([AÃ‚Ã€EÃˆÃ‰ÃŠÃ‹IÃŽÃOÃ”UÃ™Ã›ÃœYÅ¸Ã†Å’])", "  le rond-point dâ€™$1"],
                ["^ (\\S)", "  le rond-point de $1"],
                [" ([dl])'", " $1â€™"]
            ],
            "arrival": [
                ["^ Le ", "  au "],
                ["^ Les ", "  aux "],
                ["^ La ", "  Ã  La "],
                ["^ (\\S)", "  Ã  $1"],
    
                [" ([dl])'", " $1â€™"]
            ]
        }
    }
    
    },{}],22:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "regExpFlags": ""
        },
        "v5": {
            "accusative": [
                ["^ ([Â«\"])", " Ñ‚Ñ€Ð°ÑÑÐ° $1"],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑƒÑŽ Ð°Ð»Ð»ÐµÑŽ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑŒÑŽ Ð°Ð»Ð»ÐµÑŽ "],
                ["^ (\\S+)ÑÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑŽÑŽ Ð°Ð»Ð»ÐµÑŽ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1-ÑŽ $2ÑƒÑŽ Ð°Ð»Ð»ÐµÑŽ "],
                ["^ [ÐÐ°]Ð»Ð»ÐµÑ ", " Ð°Ð»Ð»ÐµÑŽ "],
    
                ["^ (\\S+)Ð°Ñ-(\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑƒÑŽ-$2ÑƒÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑƒÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+)ÑŒÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑŒÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+)ÑÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑŽÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\d+)-Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-ÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-ÑŽ $2ÑƒÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑƒÑŽ $2ÑƒÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ñƒ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ (\\S+)Ð°Ñ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑƒÑŽ $2Ñƒ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»ÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ Ð”Ð¾Ð±Ñ€Ñ‹Ð½Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð¾Ð±Ñ€Ñ‹Ð½ÑŽ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰Ñƒ ÑƒÐ»Ð¸Ñ†Ñƒ "],
                ["^ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " ÑƒÐ»Ð¸Ñ†Ñƒ "],
    
                ["^ (\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-ÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-$2-ÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑƒÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ (\\S+)ÑŒÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑŒÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ (\\S+)ÑÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑŽÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-ÑŽ $2ÑƒÑŽ Ð»Ð¸Ð½Ð¸ÑŽ "],
                ["^ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " Ð»Ð¸Ð½Ð¸ÑŽ "],
    
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ð¸ ", " $1-$2-ÑŽ Ð»Ð¸Ð½Ð¸Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑƒÑŽ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½ÑƒÑŽ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑŒÑŽ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½ÑƒÑŽ "],
                ["^ (\\S+)ÑÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑŽÑŽ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½ÑƒÑŽ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1-ÑŽ $2ÑƒÑŽ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½ÑƒÑŽ "],
                ["^ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½ÑƒÑŽ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑƒÑŽ Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑŒÑŽ Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑŽÑŽ Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
                ["^ (\\S+[Ð²Ð½])Ð° [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ñƒ Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1-ÑŽ $2ÑƒÑŽ Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
                ["^ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " Ð¿Ð»Ð¾Ñ‰Ð°Ð´ÑŒ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑƒÑŽ Ð¿Ñ€Ð¾ÑÐµÐºÑƒ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑŒÑŽ Ð¿Ñ€Ð¾ÑÐµÐºÑƒ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑŽÑŽ Ð¿Ñ€Ð¾ÑÐµÐºÑƒ "],
                ["^ (\\d+)-Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1-ÑŽ Ð¿Ñ€Ð¾ÑÐµÐºÑƒ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " Ð¿Ñ€Ð¾ÑÐµÐºÑƒ "],
    
                ["^ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑƒÑŽ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñƒ "],
                ["^ (\\S+)ÑŒÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑŒÑŽ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñƒ "],
                ["^ (\\S+)ÑÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑŽÑŽ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1-ÑŽ $2ÑƒÑŽ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñƒ "],
                ["^ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " ÑÑÑ‚Ð°ÐºÐ°Ð´Ñƒ "],
    
                ["^ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑƒÑŽ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
                ["^ (\\S+)ÑŒÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑŒÑŽ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
                ["^ (\\S+)ÑÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑŽÑŽ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑƒÑŽ $2ÑƒÑŽ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1-ÑŽ $2ÑƒÑŽ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
                ["^ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ "],
    
                ["^ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑƒÑŽ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÑƒ "],
                ["^ (\\S+)ÑŒÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑŒÑŽ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÑƒ "],
                ["^ (\\S+)ÑÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑŽÑŽ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÑƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1-ÑŽ $2ÑƒÑŽ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÑƒ "],
                ["^ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " Ñ€Ð°Ð·Ð²ÑÐ·ÐºÑƒ "],
    
                ["^ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑƒÑŽ Ñ‚Ñ€Ð°ÑÑÑƒ "],
                ["^ (\\S+)ÑŒÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑŒÑŽ Ñ‚Ñ€Ð°ÑÑÑƒ "],
                ["^ (\\S+)ÑÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑŽÑŽ Ñ‚Ñ€Ð°ÑÑÑƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1-ÑŽ $2ÑƒÑŽ Ñ‚Ñ€Ð°ÑÑÑƒ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " Ñ‚Ñ€Ð°ÑÑÑƒ "],
    
                ["^ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑƒÑŽ $2Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
                ["^ (\\S+)ÑŒÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑŒÑŽ $2Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
                ["^ (\\S+)ÑÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑŽÑŽ $2Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑƒÑŽ $2ÑƒÑŽ $3Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1-ÑŽ $2ÑƒÑŽ $3Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
                ["^ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð´Ð¾Ñ€Ð¾Ð³Ñƒ "],
    
                ["^ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑƒÑŽ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÑƒ "],
                ["^ (\\S+)ÑŒÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑŒÑŽ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÑƒ "],
                ["^ (\\S+)ÑÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑŽÑŽ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÑƒ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1-ÑŽ $2ÑƒÑŽ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÑƒ "],
                ["^ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " Ð´Ð¾Ñ€Ð¾Ð¶ÐºÑƒ "],
    
                ["^ (\\S+)Ð°Ñ [ÐšÐº]Ð¾ÑÐ° ", " $1ÑƒÑŽ ÐºÐ¾ÑÑƒ "],
                ["^ (\\S+)Ð°Ñ [Ð¥Ñ…]Ð¾Ñ€Ð´Ð° ", " $1ÑƒÑŽ Ñ…Ð¾Ñ€Ð´Ñƒ "],
    
                ["^ [Ð”Ð´]ÑƒÐ±Ð»[ÐµÑ‘]Ñ€ ", " Ð´ÑƒÐ±Ð»Ñ‘Ñ€ "]
            ],
            "dative": [
                ["^ ([Â«\"])", " Ñ‚Ñ€Ð°ÑÑÐ° $1"],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1Ð¾Ð¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑŒÐµÐ¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\S+)ÑÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÐµÐ¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1-Ð¹ $2Ð¾Ð¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ [ÐÐ°]Ð»Ð»ÐµÑ ", " Ð°Ð»Ð»ÐµÐµ "],
    
                ["^ (\\S+)Ð°Ñ-(\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹-$2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)ÑŒÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑŒÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)ÑÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\d+)-Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð”Ð¾Ð±Ñ€Ñ‹Ð½Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð¾Ð±Ñ€Ñ‹Ð½ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " ÑƒÐ»Ð¸Ñ†Ðµ "],
    
                ["^ (\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑŒÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑŒÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " Ð»Ð¸Ð½Ð¸Ð¸ "],
    
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ð¸ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸ÑÐ¼ "],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑŒÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑŒÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+[Ð²Ð½])Ð° [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1Ð¾Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑŒÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\d+)-Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1-Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\S+)ÑŒÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑŒÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\S+)ÑÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
    
                ["^ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑŒÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑŒÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\S+)ÑÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑŒÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\S+)ÑÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " Ñ‚Ñ€Ð°ÑÑÐµ "],
    
                ["^ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)ÑŒÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑŒÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)ÑÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1-Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑŒÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\S+)ÑÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
    
                ["^ (\\S+)Ð²Ð¾ [ÐŸÐ¿]Ð¾Ð»Ðµ ", " $1Ð²Ñƒ Ð¿Ð¾Ð»ÑŽ "],
                ["^ (\\S+)Ð°Ñ [ÐšÐº]Ð¾ÑÐ° ", " $1Ð¾Ð¹ ÐºÐ¾ÑÐµ "],
                ["^ (\\S+)Ð°Ñ [Ð¥Ñ…]Ð¾Ñ€Ð´Ð° ", " $1Ð¾Ð¹ Ñ…Ð¾Ñ€Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾Ñ‚Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾Ñ‚Ð¾ÐºÑƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼Ñƒ $2Ñƒ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
                ["^ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ñƒ "],
    
                ["^ [Ð”Ð´]ÑƒÐ±Ð»[ÐµÑ‘]Ñ€ ", " Ð´ÑƒÐ±Ð»Ñ‘Ñ€Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ Ð·Ð°ÐµÐ·Ð´Ñƒ "],
                ["^ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " Ð·Ð°ÐµÐ·Ð´Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ [ÐœÐ¼]Ð¾ÑÑ‚ ", " Ð¼Ð¾ÑÑ‚Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1ÐµÐ¼Ñƒ Ð¾Ð±Ñ…Ð¾Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1Ð¾Ð¼Ñƒ Ð¾Ð±Ñ…Ð¾Ð´Ñƒ "],
                ["^ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " Ð¾Ð±Ñ…Ð¾Ð´Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿Ð°Ñ€ÐºÑƒ "],
                ["^ [ÐŸÐ¿]Ð°Ñ€Ðº ", " Ð¿Ð°Ñ€ÐºÑƒ "],
    
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ-$2Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ-$3Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
                ["^ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÑƒ "],
    
                ["^ [ÐŸÐ¿]Ð¾Ð´ÑŠÐµÐ·Ð´ ", " Ð¿Ð¾Ð´ÑŠÐµÐ·Ð´Ñƒ "],
    
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²)-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ñƒ-$2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ $3Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ $3Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " Ð¿Ñ€Ð¾ÐµÐ·Ð´Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
                ["^ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼Ñƒ $2Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼Ñƒ $2Ñƒ ÑÐ¿ÑƒÑÐºÑƒ "],
                ["^ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " ÑÐ¿ÑƒÑÐºÑƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼Ñƒ $2Ñƒ ÑÑŠÐµÐ·Ð´Ñƒ "],
                ["^ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " ÑÑŠÐµÐ·Ð´Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼Ñƒ $2Ñƒ Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
                ["^ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " Ñ‚Ð¾Ð½Ð½ÐµÐ»ÑŽ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼Ñƒ $2Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼Ñƒ $2Ñƒ Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " Ñ‚Ñ€Ð°ÐºÑ‚Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼Ñƒ $2Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼Ñƒ $2ÐµÐ¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼Ñƒ $2Ð¾Ð¼Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼Ñƒ $2Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼Ñƒ $2Ñƒ Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
                ["^ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " Ñ‚ÑƒÐ¿Ð¸ÐºÑƒ "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼Ñƒ $2ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼Ñƒ $2ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼Ñƒ $2Ð¼Ñƒ $3ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼Ñƒ $2Ð¼Ñƒ $3ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð¼Ñƒ $2Ð¼Ñƒ $3ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð¼Ñƒ $2Ð¼Ñƒ $3ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
                ["^ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1ÐºÐ¾Ð»ÑŒÑ†Ñƒ "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼Ñƒ $2Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼Ñƒ $2Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð¼Ñƒ $2Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð¼Ñƒ $2Ð¼Ñƒ ÑˆÐ¾ÑÑÐµ "],
    
                [" ([Ð¢Ñ‚])Ñ€ÐµÑ‚Ð¾Ð¼Ñƒ ", " $1Ñ€ÐµÑ‚ÑŒÐµÐ¼Ñƒ "],
                ["([Ð¶Ñ‡])Ð¾Ð¼Ñƒ ", "$1ÑŒÐµÐ¼Ñƒ "],
                ["([Ð¶Ñ‡])Ð¾Ð¹ ", "$1ÐµÐ¹ "]
            ],
            "genitive": [
                ["^ ([Â«\"])", " Ñ‚Ñ€Ð°ÑÑÐ° $1"],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1Ð¾Ð¹ Ð°Ð»Ð»ÐµÐ¸ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑŒÐµÐ¹ Ð°Ð»Ð»ÐµÐ¸ "],
                ["^ (\\S+)ÑÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÐµÐ¹ Ð°Ð»Ð»ÐµÐ¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1-Ð¹ $2Ð¾Ð¹ Ð°Ð»Ð»ÐµÐ¸ "],
                ["^ [ÐÐ°]Ð»Ð»ÐµÑ ", " Ð°Ð»Ð»ÐµÐ¸ "],
    
                ["^ (\\S+)Ð°Ñ-(\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹-$2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+)ÑŒÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑŒÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+)ÑÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\d+)-Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ (\\S+)Ð°Ñ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ Ð”Ð¾Ð±Ñ€Ñ‹Ð½Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð¾Ð±Ñ€Ñ‹Ð½ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ñ‹ "],
                ["^ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " ÑƒÐ»Ð¸Ñ†Ñ‹ "],
    
                ["^ (\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑŒÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑŒÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " Ð»Ð¸Ð½Ð¸Ð¸ "],
    
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ð¸ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸Ð¹ "],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑŒÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑŒÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+[Ð²Ð½])Ð° [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1Ð¾Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐ¸ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑŒÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐ¸ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐ¸ "],
                ["^ (\\d+)-Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1-Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐ¸ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " Ð¿Ñ€Ð¾ÑÐµÐºÐ¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñ‹ "],
                ["^ (\\S+)ÑŒÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑŒÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñ‹ "],
                ["^ (\\S+)ÑÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñ‹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ñ‹ "],
                ["^ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " ÑÑÑ‚Ð°ÐºÐ°Ð´Ñ‹ "],
    
                ["^ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑŒÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ "],
                ["^ (\\S+)ÑŒÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑŒÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ "],
                ["^ (\\S+)ÑÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ "],
                ["^ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÑ‹ "],
                ["^ (\\S+)ÑŒÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑŒÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÑ‹ "],
                ["^ (\\S+)ÑÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÑ‹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÑ‹ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " Ñ‚Ñ€Ð°ÑÑÑ‹ "],
    
                ["^ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
                ["^ (\\S+)ÑŒÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑŒÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
                ["^ (\\S+)ÑÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1-Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
                ["^ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð´Ð¾Ñ€Ð¾Ð³Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐ¸ "],
                ["^ (\\S+)ÑŒÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑŒÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐ¸ "],
                ["^ (\\S+)ÑÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐ¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐ¸ "],
                ["^ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐ¸ "],
    
                ["^ (\\S+)Ð²Ð¾ [ÐŸÐ¿]Ð¾Ð»Ðµ ", " $1Ð²Ð° Ð¿Ð¾Ð»Ñ "],
                ["^ (\\S+)Ð°Ñ [ÐšÐº]Ð¾ÑÐ° ", " $1Ð¾Ð¹ ÐºÐ¾ÑÑ‹ "],
                ["^ (\\S+)Ð°Ñ [Ð¥Ñ…]Ð¾Ñ€Ð´Ð° ", " $1Ð¾Ð¹ Ñ…Ð¾Ñ€Ð´Ñ‹ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾Ñ‚Ð¾Ðº ", " $1Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾Ñ‚Ð¾ÐºÐ° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
                ["^ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ð° "],
    
                ["^ [Ð”Ð´]ÑƒÐ±Ð»[ÐµÑ‘]Ñ€ ", " Ð´ÑƒÐ±Ð»Ñ‘Ñ€Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð° Ð·Ð°ÐµÐ·Ð´Ð° "],
                ["^ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " Ð·Ð°ÐµÐ·Ð´Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð³Ð¾ $2Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð³Ð¾ $2Ð° Ð¼Ð¾ÑÑ‚Ð° "],
                ["^ [ÐœÐ¼]Ð¾ÑÑ‚ ", " Ð¼Ð¾ÑÑ‚Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1ÐµÐ³Ð¾ Ð¾Ð±Ñ…Ð¾Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ Ð¾Ð±Ñ…Ð¾Ð´Ð° "],
                ["^ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " Ð¾Ð±Ñ…Ð¾Ð´Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ð°Ñ€ÐºÐ° "],
                ["^ [ÐŸÐ¿]Ð°Ñ€Ðº ", " Ð¿Ð°Ñ€ÐºÐ° "],
    
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾-$2Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾-$3Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ $2Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð³Ð¾ $2Ð° Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
                ["^ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐ° "],
    
                ["^ [ÐŸÐ¿]Ð¾Ð´ÑŠÐµÐ·Ð´ ", " Ð¿Ð¾Ð´ÑŠÐµÐ·Ð´Ð° "],
    
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²)-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð°-$2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð° Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ $3Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ $3Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " Ð¿Ñ€Ð¾ÐµÐ·Ð´Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
                ["^ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð³Ð¾ $2Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð³Ð¾ $2Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð³Ð¾ $2Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð³Ð¾ $2Ð° ÑÐ¿ÑƒÑÐºÐ° "],
                ["^ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " ÑÐ¿ÑƒÑÐºÐ° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ ÑÑŠÐµÐ·Ð´Ð° "],
                ["^ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " ÑÑŠÐµÐ·Ð´Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
                ["^ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " Ñ‚Ð¾Ð½Ð½ÐµÐ»Ñ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ¼ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð³Ð¾ $2Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð³Ð¾ $2Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð³Ð¾ $2Ð° Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " Ñ‚Ñ€Ð°ÐºÑ‚Ð° "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð³Ð¾ $2Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð³Ð¾ $2Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\d+)-Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð³Ð¾ $2ÐµÐ³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð³Ð¾ $2Ð¾Ð³Ð¾ Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð³Ð¾ $2Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð³Ð¾ $2Ð° Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
                ["^ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " Ñ‚ÑƒÐ¿Ð¸ÐºÐ° "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð³Ð¾ $2ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð³Ð¾ $2ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð³Ð¾ $2Ð³Ð¾ $3ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð³Ð¾ $2Ð³Ð¾ $3ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð³Ð¾ $2Ð³Ð¾ $3ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð³Ð¾ $2Ð³Ð¾ $3ÐºÐ¾Ð»ÑŒÑ†Ð° "],
                ["^ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1ÐºÐ¾Ð»ÑŒÑ†Ð° "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð³Ð¾ $2Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð³Ð¾ $2Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð³Ð¾ $2Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð³Ð¾ $2Ð³Ð¾ ÑˆÐ¾ÑÑÐµ "],
    
                [" ([Ð¢Ñ‚])Ñ€ÐµÑ‚Ð¾Ð³Ð¾ ", " $1Ñ€ÐµÑ‚ÑŒÐµÐ³Ð¾ "],
                ["([Ð¶Ñ‡])Ð¾Ð³Ð¾ ", "$1ÑŒÐµÐ³Ð¾ "]
            ],
            "prepositional": [
                ["^ ([Â«\"])", " Ñ‚Ñ€Ð°ÑÑÐ° $1"],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1Ð¾Ð¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÑŒÐµÐ¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\S+)ÑÑ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1ÐµÐ¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ°]Ð»Ð»ÐµÑ ", " $1-Ð¹ $2Ð¾Ð¹ Ð°Ð»Ð»ÐµÐµ "],
                ["^ [ÐÐ°]Ð»Ð»ÐµÑ ", " Ð°Ð»Ð»ÐµÐµ "],
    
                ["^ (\\S+)Ð°Ñ-(\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹-$2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)ÑŒÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÑŒÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)ÑÑ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\d+)-Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+[Ð²Ð½])Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð°Ð½ÑŒÑÐ»Ð°Ð²Ð»ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð”Ð¾Ð±Ñ€Ñ‹Ð½Ñ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð”Ð¾Ð±Ñ€Ñ‹Ð½ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰Ð° [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " Ð›ÑŽÐ´Ð¾Ð³Ð¾Ñ‰ÐµÐ¹ ÑƒÐ»Ð¸Ñ†Ðµ "],
                ["^ [Ð£Ñƒ]Ð»Ð¸Ñ†Ð° ", " ÑƒÐ»Ð¸Ñ†Ðµ "],
    
                ["^ (\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑŒÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÑŒÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\S+)ÑÑ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1ÐµÐ¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð»Ð¸Ð½Ð¸Ð¸ "],
                ["^ [Ð›Ð»]Ð¸Ð½Ð¸Ñ ", " Ð»Ð¸Ð½Ð¸Ð¸ "],
    
                ["^ (\\d+)-(\\d+)-Ñ [Ð›Ð»]Ð¸Ð½Ð¸Ð¸ ", " $1-$2-Ð¹ Ð»Ð¸Ð½Ð¸ÑÑ… "],
    
                ["^ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑŒÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÑŒÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\S+)ÑÑ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1ÐµÐ¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " $1-Ð¹ $2Ð¾Ð¹ Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
                ["^ [ÐÐ½]Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð°Ñ ", " Ð½Ð°Ð±ÐµÑ€ÐµÐ¶Ð½Ð¾Ð¹ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÑŒÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1ÐµÐ¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\S+[Ð²Ð½])Ð° [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
                ["^ [ÐŸÐ¿]Ð»Ð¾Ñ‰Ð°Ð´ÑŒ ", " Ð¿Ð»Ð¾Ñ‰Ð°Ð´Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1Ð¾Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÑŒÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\S+)ÑÑ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1ÐµÐ¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ (\\d+)-Ñ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " $1-Ð¹ Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐµÐºÐ° ", " Ð¿Ñ€Ð¾ÑÐµÐºÐµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\S+)ÑŒÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÑŒÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\S+)ÑÑ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1ÐµÐ¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " $1-Ð¹ $2Ð¾Ð¹ ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
                ["^ [Ð­Ñ]ÑÑ‚Ð°ÐºÐ°Ð´Ð° ", " ÑÑÑ‚Ð°ÐºÐ°Ð´Ðµ "],
    
                ["^ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑŒÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÑŒÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)ÑÑ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1ÐµÐ¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1Ð¾Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " $1-Ð¹ $2Ð¾Ð¹ Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
                ["^ [ÐœÐ¼]Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ ", " Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»Ð¸ "],
    
                ["^ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÑŒÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\S+)ÑÑ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1ÐµÐ¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
                ["^ [Ð Ñ€]Ð°Ð·Ð²ÑÐ·ÐºÐ° ", " Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÑŒÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\S+)ÑÑ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1ÐµÐ¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ñ‚Ñ€Ð°ÑÑÐµ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÑÑÐ° ", " Ñ‚Ñ€Ð°ÑÑÐµ "],
    
                ["^ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)ÑŒÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÑŒÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)ÑÑ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1ÐµÐ¹ $2Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\S+)Ð°Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð¾Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1-Ð¹ $2Ð¾Ð¹ $3Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
                ["^ ([ÐÐ°]Ð²Ñ‚Ð¾)?[Ð”Ð´]Ð¾Ñ€Ð¾Ð³Ð° ", " $1Ð´Ð¾Ñ€Ð¾Ð³Ðµ "],
    
                ["^ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\S+)ÑŒÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÑŒÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\S+)ÑÑ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1ÐµÐ¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ (\\d+)-Ñ (\\S+)Ð°Ñ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " $1-Ð¹ $2Ð¾Ð¹ Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
                ["^ [Ð”Ð´]Ð¾Ñ€Ð¾Ð¶ÐºÐ° ", " Ð´Ð¾Ñ€Ð¾Ð¶ÐºÐµ "],
    
                ["^ (\\S+)Ð²Ð¾ [ÐŸÐ¿]Ð¾Ð»Ðµ ", " $1Ð²Ð¾Ð¼ Ð¿Ð¾Ð»Ðµ "],
                ["^ (\\S+)Ð°Ñ [ÐšÐº]Ð¾ÑÐ° ", " $1Ð¾Ð¹ ÐºÐ¾ÑÐµ "],
                ["^ (\\S+)Ð°Ñ [Ð¥Ñ…]Ð¾Ñ€Ð´Ð° ", " $1Ð¾Ð¹ Ñ…Ð¾Ñ€Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾Ñ‚Ð¾Ðº ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾Ñ‚Ð¾ÐºÐµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼ $2ÐµÐ¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼ $2Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " $1-Ð¼ $2Ð¾Ð¼ Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
                ["^ [Ð‘Ð±]ÑƒÐ»ÑŒÐ²Ð°Ñ€ ", " Ð±ÑƒÐ»ÑŒÐ²Ð°Ñ€Ðµ "],
    
                ["^ [Ð”Ð´]ÑƒÐ±Ð»[ÐµÑ‘]Ñ€ ", " Ð´ÑƒÐ±Ð»Ñ‘Ñ€Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼ $2ÐµÐ¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð·Ð°ÐµÐ·Ð´Ðµ "],
                ["^ [Ð—Ð·]Ð°ÐµÐ·Ð´ ", " Ð·Ð°ÐµÐ·Ð´Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼ $2ÐµÐ¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐœÐ¼]Ð¾ÑÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¼Ð¾ÑÑ‚Ñƒ "],
                ["^ [ÐœÐ¼]Ð¾ÑÑ‚ ", " Ð¼Ð¾ÑÑ‚Ñƒ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1ÐµÐ¼ Ð¾Ð±Ñ…Ð¾Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " $1Ð¾Ð¼ Ð¾Ð±Ñ…Ð¾Ð´Ðµ "],
                ["^ [ÐžÐ¾]Ð±Ñ…Ð¾Ð´ ", " Ð¾Ð±Ñ…Ð¾Ð´Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼ $2ÐµÐ¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ð°Ñ€Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ð°Ñ€ÐºÐµ "],
                ["^ [ÐŸÐ¿]Ð°Ñ€Ðº ", " Ð¿Ð°Ñ€ÐºÐµ "],
    
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼-$2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ $2Ð¾Ð¼-$3Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ $2ÐµÐ¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
                ["^ [ÐŸÐ¿]ÐµÑ€ÐµÑƒÐ»Ð¾Ðº ", " Ð¿ÐµÑ€ÐµÑƒÐ»ÐºÐµ "],
    
                ["^ [ÐŸÐ¿]Ð¾Ð´ÑŠÐµÐ·Ð´ ", " Ð¿Ð¾Ð´ÑŠÐµÐ·Ð´Ðµ "],
    
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²)-(\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼-$2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2ÐµÐ¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2ÐµÐ¼ $3Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ $3Ð¾Ð¼ Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÐµÐ·Ð´ ", " Ð¿Ñ€Ð¾ÐµÐ·Ð´Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼ $2ÐµÐ¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
                ["^ [ÐŸÐ¿]Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚ ", " Ð¿Ñ€Ð¾ÑÐ¿ÐµÐºÑ‚Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼ $2ÐµÐ¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
                ["^ [ÐŸÐ¿]ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´ ", " Ð¿ÑƒÑ‚ÐµÐ¿Ñ€Ð¾Ð²Ð¾Ð´Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ $2ÐµÐ¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1ÐµÐ¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼ $2ÐµÐ¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]Ð¿ÑƒÑÐº ", " $1-Ð¼ $2Ð¾Ð¼ ÑÐ¿ÑƒÑÐºÐµ "],
                ["^ [Ð¡Ñ]Ð¿ÑƒÑÐº ", " ÑÐ¿ÑƒÑÐºÐµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2ÐµÐ¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1ÐµÐ¼ $2Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼ $2ÐµÐ¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " $1-Ð¼ $2Ð¾Ð¼ ÑÑŠÐµÐ·Ð´Ðµ "],
                ["^ [Ð¡Ñ]ÑŠÐµÐ·Ð´ ", " ÑÑŠÐµÐ·Ð´Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼ $2ÐµÐ¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
                ["^ [Ð¢Ñ‚][ÑƒÐ¾]Ð½Ð½ÐµÐ»ÑŒ ", " Ñ‚Ð¾Ð½Ð½ÐµÐ»Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼ $2ÐµÐ¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
                ["^ [Ð¢Ñ‚]Ñ€Ð°ÐºÑ‚ ", " Ñ‚Ñ€Ð°ÐºÑ‚Ðµ "],
    
                ["^ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ $2ÐµÐ¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+Ð½)Ð¸Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1ÐµÐ¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1Ð¾Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\d+)-Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+Ð½)Ð¸Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼ $2ÐµÐ¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+)[Ð¸Ð¾Ñ‹]Ð¹ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[ÐµÑ‘Ð¾]Ð²) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ (\\d+)-Ð¹ (\\S+[Ð¸Ñ‹]Ð½) [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " $1-Ð¼ $2Ð¾Ð¼ Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
                ["^ [Ð¢Ñ‚]ÑƒÐ¿Ð¸Ðº ", " Ñ‚ÑƒÐ¿Ð¸ÐºÐµ "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼ $2ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼ $2ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼ $2Ð¼ $3ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1Ð¼ $2Ð¼ $3ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð¼ $2Ð¼ $3ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1-Ð¼ $2Ð¼ $3ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
                ["^ ([ÐŸÐ¿]Ð¾Ð»Ñƒ)?[ÐšÐº]Ð¾Ð»ÑŒÑ†Ð¾ ", " $1ÐºÐ¾Ð»ÑŒÑ†Ðµ "],
    
                ["^ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+[ÐµÐ¾])Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼ $2Ð¼ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\S+ÑŒÐµ) (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1Ð¼ $2Ð¼ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+[ÐµÐ¾])Ðµ [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð¼ $2Ð¼ ÑˆÐ¾ÑÑÐµ "],
                ["^ (\\d+)-Ðµ (\\S+ÑŒÐµ) [Ð¨Ñˆ]Ð¾ÑÑÐµ ", " $1-Ð¼ $2Ð¼ ÑˆÐ¾ÑÑÐµ "],
    
                [" ([Ð¢Ñ‚])Ñ€ÐµÑ‚Ð¾Ð¼ ", " $1Ñ€ÐµÑ‚ÑŒÐµÐ¼ "],
                ["([Ð¶Ñ‡])Ð¾Ð¼ ", "$1ÑŒÐµÐ¼ "]
            ]
        }
    }
    
    },{}],23:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "fÃ¸rste",
                    "2": "anden",
                    "3": "tredje",
                    "4": "fjerde",
                    "5": "femte",
                    "6": "sjette",
                    "7": "syvende",
                    "8": "ottende",
                    "9": "niende",
                    "10": "tiende"
                },
                "direction": {
                    "north": "Nord",
                    "northeast": "NordÃ¸st",
                    "east": "Ã˜st",
                    "southeast": "SydÃ¸st",
                    "south": "Syd",
                    "southwest": "Sydvest",
                    "west": "Vest",
                    "northwest": "Nordvest"
                },
                "modifier": {
                    "left": "venstresving",
                    "right": "hÃ¸jresving",
                    "sharp left": "skarpt venstresving",
                    "sharp right": "skarpt hÃ¸jresving",
                    "slight left": "svagt venstresving",
                    "slight right": "svagt hÃ¸jresving",
                    "straight": "ligeud",
                    "uturn": "U-vending"
                },
                "lanes": {
                    "xo": "Hold til hÃ¸jre",
                    "ox": "Hold til venstre",
                    "xox": "Benyt midterste spor",
                    "oxo": "Hold til hÃ¸jre eller venstre"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Tag fÃ¦rgen",
                    "name": "Tag fÃ¦rgen {way_name}",
                    "destination": "Tag fÃ¦rgen i retning {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} derefter, efter {distance}, {instruction_two}",
                "two linked": "{instruction_one}, derefter {instruction_two}",
                "one in distance": "Efter {distance} {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "afkÃ¸rsel {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Du er ankommet til din {nth} destination",
                    "upcoming": "Du vil ankomme til din {nth} destination",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}"
                },
                "left": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til venstre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ venstre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til venstre"
                },
                "right": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til hÃ¸jre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ hÃ¸jre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til hÃ¸jre"
                },
                "sharp left": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til venstre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ venstre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til venstre"
                },
                "sharp right": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til hÃ¸jre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ hÃ¸jre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til hÃ¸jre"
                },
                "slight right": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til hÃ¸jre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ hÃ¸jre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til hÃ¸jre"
                },
                "slight left": {
                    "default": "Du er ankommet til din {nth} destination, som befinder sig til venstre",
                    "upcoming": "Du vil ankomme til din {nth} destination pÃ¥ venstre hÃ¥nd",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, som befinder sig til venstre"
                },
                "straight": {
                    "default": "Du er ankommet til din {nth} destination, der befinder sig lige frem",
                    "upcoming": "Du vil ankomme til din {nth} destination foran dig",
                    "short": "Du er ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du er ankommet til {waypoint_name}, der befinder sig lige frem"
                }
            },
            "continue": {
                "default": {
                    "default": "Drej til {modifier}",
                    "name": "Drej til {modifier} videre ad {way_name}",
                    "destination": "Drej til {modifier} mod {destination}",
                    "exit": "Drej til {modifier} ad {way_name}"
                },
                "straight": {
                    "default": "FortsÃ¦t ligeud",
                    "name": "FortsÃ¦t ligeud ad {way_name}",
                    "destination": "FortsÃ¦t mod {destination}",
                    "distance": "FortsÃ¦t {distance} ligeud",
                    "namedistance": "FortsÃ¦t {distance} ad {way_name}"
                },
                "sharp left": {
                    "default": "Drej skarpt til venstre",
                    "name": "Drej skarpt til venstre videre ad {way_name}",
                    "destination": "Drej skarpt til venstre mod {destination}"
                },
                "sharp right": {
                    "default": "Drej skarpt til hÃ¸jre",
                    "name": "Drej skarpt til hÃ¸jre videre ad {way_name}",
                    "destination": "Drej skarpt til hÃ¸jre mod {destination}"
                },
                "slight left": {
                    "default": "Drej left til venstre",
                    "name": "Drej let til venstre videre ad {way_name}",
                    "destination": "Drej let til venstre mod {destination}"
                },
                "slight right": {
                    "default": "Drej let til hÃ¸jre",
                    "name": "Drej let til hÃ¸jre videre ad {way_name}",
                    "destination": "Drej let til hÃ¸jre mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending",
                    "name": "Foretag en U-vending tilbage ad {way_name}",
                    "destination": "Foretag en U-vending mod {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "KÃ¸r mod {direction}",
                    "name": "KÃ¸r mod {direction} ad {way_name}",
                    "namedistance": "FortsÃ¦t {distance} ad {way_name}mod {direction}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Drej til {modifier}",
                    "name": "Drej til {modifier} ad {way_name}",
                    "destination": "Drej til {modifier} mof {destination}"
                },
                "straight": {
                    "default": "FortsÃ¦t ligeud",
                    "name": "FortsÃ¦t ligeud ad {way_name}",
                    "destination": "FortsÃ¦t ligeud mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending for enden af vejen",
                    "name": "Foretag en U-vending ad {way_name} for enden af vejen",
                    "destination": "Foretag en U-vending mod {destination} for enden af vejen"
                }
            },
            "fork": {
                "default": {
                    "default": "Hold til {modifier} ved udfletningen",
                    "name": "Hold mod {modifier} pÃ¥ {way_name}",
                    "destination": "Hold mod {modifier} mod {destination}"
                },
                "slight left": {
                    "default": "Hold til venstre ved udfletningen",
                    "name": "Hold til venstre pÃ¥ {way_name}",
                    "destination": "Hold til venstre mod {destination}"
                },
                "slight right": {
                    "default": "Hold til hÃ¸jre ved udfletningen",
                    "name": "Hold til hÃ¸jre pÃ¥ {way_name}",
                    "destination": "Hold til hÃ¸jre mod {destination}"
                },
                "sharp left": {
                    "default": "Drej skarpt til venstre ved udfletningen",
                    "name": "Drej skarpt til venstre ad {way_name}",
                    "destination": "Drej skarpt til venstre mod {destination}"
                },
                "sharp right": {
                    "default": "Drej skarpt til hÃ¸jre ved udfletningen",
                    "name": "Drej skarpt til hÃ¸jre ad {way_name}",
                    "destination": "Drej skarpt til hÃ¸jre mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending",
                    "name": "Foretag en U-vending ad {way_name}",
                    "destination": "Foretag en U-vending mod {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Flet til {modifier}",
                    "name": "Flet til {modifier} ad {way_name}",
                    "destination": "Flet til {modifier} mod {destination}"
                },
                "straight": {
                    "default": "Flet",
                    "name": "Flet ind pÃ¥ {way_name}",
                    "destination": "Flet ind mod {destination}"
                },
                "slight left": {
                    "default": "Flet til venstre",
                    "name": "Flet til venstre ad {way_name}",
                    "destination": "Flet til venstre mod {destination}"
                },
                "slight right": {
                    "default": "Flet til hÃ¸jre",
                    "name": "Flet til hÃ¸jre ad {way_name}",
                    "destination": "Flet til hÃ¸jre mod {destination}"
                },
                "sharp left": {
                    "default": "Flet til venstre",
                    "name": "Flet til venstre ad {way_name}",
                    "destination": "Flet til venstre mod {destination}"
                },
                "sharp right": {
                    "default": "Flet til hÃ¸jre",
                    "name": "Flet til hÃ¸jre ad {way_name}",
                    "destination": "Flet til hÃ¸jre mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending",
                    "name": "Foretag en U-vending ad {way_name}",
                    "destination": "Foretag en U-vending mod {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "FortsÃ¦t {modifier}",
                    "name": "FortsÃ¦t {modifier} ad {way_name}",
                    "destination": "FortsÃ¦t {modifier} mod {destination}"
                },
                "straight": {
                    "default": "FortsÃ¦t ligeud",
                    "name": "FortsÃ¦t ad {way_name}",
                    "destination": "FortsÃ¦t mod {destination}"
                },
                "sharp left": {
                    "default": "Drej skarpt til venstre",
                    "name": "Drej skarpt til venstre ad {way_name}",
                    "destination": "Drej skarpt til venstre mod {destination}"
                },
                "sharp right": {
                    "default": "Drej skarpt til hÃ¸jre",
                    "name": "Drej skarpt til hÃ¸jre ad {way_name}",
                    "destination": "Drej skarpt til hÃ¸jre mod {destination}"
                },
                "slight left": {
                    "default": "FortsÃ¦t til venstre",
                    "name": "FortsÃ¦t til venstre ad {way_name}",
                    "destination": "FortsÃ¦t til venstre mod {destination}"
                },
                "slight right": {
                    "default": "FortsÃ¦t til hÃ¸jre",
                    "name": "FortsÃ¦t til hÃ¸jre ad {way_name}",
                    "destination": "FortsÃ¦t til hÃ¸jre mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending",
                    "name": "Foretag en U-vending ad {way_name}",
                    "destination": "Foretag en U-vending mod {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "FortsÃ¦t {modifier}",
                    "name": "FortsÃ¦t {modifier} ad {way_name}",
                    "destination": "FortsÃ¦t {modifier} mod {destination}"
                },
                "uturn": {
                    "default": "Foretag en U-vending",
                    "name": "Foretag en U-vending ad {way_name}",
                    "destination": "Foretag en U-vending mod {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Tag afkÃ¸rslen",
                    "name": "Tag afkÃ¸rslen ad {way_name}",
                    "destination": "Tag afkÃ¸rslen mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit}",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} mod {destination}"
                },
                "left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til venstre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til venstre mod {destination}\n"
                },
                "right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre mod {destination}"
                },
                "sharp left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til venstre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til venstre mod {destination}\n"
                },
                "sharp right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre mod {destination}"
                },
                "slight left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til venstre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til venstre mod {destination}\n"
                },
                "slight right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}",
                    "exit": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre",
                    "exit_destination": "VÃ¦lg afkÃ¸rsel {exit} til hÃ¸jre mod {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Tag afkÃ¸rslen",
                    "name": "Tag afkÃ¸rslen ad {way_name}",
                    "destination": "Tag afkÃ¸rslen mod {destination}"
                },
                "left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}"
                },
                "right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}"
                },
                "sharp left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}"
                },
                "sharp right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}"
                },
                "slight left": {
                    "default": "Tag afkÃ¸rslen til venstre",
                    "name": "Tag afkÃ¸rslen til venstre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til venstre mod {destination}"
                },
                "slight right": {
                    "default": "Tag afkÃ¸rslen til hÃ¸jre",
                    "name": "Tag afkÃ¸rslen til hÃ¸jre ad {way_name}",
                    "destination": "Tag afkÃ¸rslen til hÃ¸jre mod {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "KÃ¸r ind i rundkÃ¸rslen",
                        "name": "Tag rundkÃ¸rslen og kÃ¸r fra ad {way_name}",
                        "destination": "Tag rundkÃ¸rslen og kÃ¸r mod {destination}"
                    },
                    "name": {
                        "default": "KÃ¸r ind i {rotary_name}",
                        "name": "KÃ¸r ind i {rotary_name} og kÃ¸r ad {way_name} ",
                        "destination": "KÃ¸r ind i {rotary_name} og kÃ¸r mod {destination}"
                    },
                    "exit": {
                        "default": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel",
                        "name": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel ad {way_name}",
                        "destination": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel mod {destination}"
                    },
                    "name_exit": {
                        "default": "KÃ¸r ind i {rotary_name} og forlad ved {exit_number} afkÃ¸rsel",
                        "name": "KÃ¸r ind i {rotary_name} og forlad ved {exit_number} afkÃ¸rsel ad {way_name}",
                        "destination": "KÃ¸r ind i {rotary_name} og forlad ved {exit_number} afkÃ¸rsel mod {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel",
                        "name": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel ad {way_name}",
                        "destination": "Tag rundkÃ¸rslen og forlad ved {exit_number} afkÃ¸rsel mod {destination}"
                    },
                    "default": {
                        "default": "KÃ¸r ind i rundkÃ¸rslen",
                        "name": "Tag rundkÃ¸rslen og kÃ¸r fra ad {way_name}",
                        "destination": "Tag rundkÃ¸rslen og kÃ¸r mod {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Foretag et {modifier}",
                    "name": "Foretag et {modifier} ad {way_name}",
                    "destination": "Foretag et {modifier} mod {destination}"
                },
                "left": {
                    "default": "Drej til venstre",
                    "name": "Drej til venstre ad {way_name}",
                    "destination": "Drej til venstre mod {destination}"
                },
                "right": {
                    "default": "Drej til hÃ¸jre",
                    "name": "Drej til hÃ¸jre ad {way_name}",
                    "destination": "Drej til hÃ¸jre mod {destination}"
                },
                "straight": {
                    "default": "FortsÃ¦t ligeud",
                    "name": "FortsÃ¦t ligeud ad {way_name}",
                    "destination": "FortsÃ¦t ligeud mod {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Forlad rundkÃ¸rslen",
                    "name": "Forlad rundkÃ¸rslen ad {way_name}",
                    "destination": "Forlad rundkÃ¸rslen mod  {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Forlad rundkÃ¸rslen",
                    "name": "Forlad rundkÃ¸rslen ad {way_name}",
                    "destination": "Forlad rundkÃ¸rslen mod {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Foretag et {modifier}",
                    "name": "Foretag et {modifier} ad {way_name}",
                    "destination": "Foretag et {modifier} mod {destination}"
                },
                "left": {
                    "default": "Drej til venstre",
                    "name": "Drej til venstre ad {way_name}",
                    "destination": "Drej til venstre mod {destination}"
                },
                "right": {
                    "default": "Drej til hÃ¸jre",
                    "name": "Drej til hÃ¸jre ad {way_name}",
                    "destination": "Drej til hÃ¸jre mod {destination}"
                },
                "straight": {
                    "default": "FortsÃ¦t ligeud",
                    "name": "KÃ¸r ligeud ad {way_name}",
                    "destination": "KÃ¸r ligeud mod {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "FortsÃ¦t ligeud"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],24:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "erste",
                    "2": "zweite",
                    "3": "dritte",
                    "4": "vierte",
                    "5": "fÃ¼nfte",
                    "6": "sechste",
                    "7": "siebente",
                    "8": "achte",
                    "9": "neunte",
                    "10": "zehnte"
                },
                "direction": {
                    "north": "Norden",
                    "northeast": "Nordosten",
                    "east": "Osten",
                    "southeast": "SÃ¼dosten",
                    "south": "SÃ¼den",
                    "southwest": "SÃ¼dwesten",
                    "west": "Westen",
                    "northwest": "Nordwesten"
                },
                "modifier": {
                    "left": "links",
                    "right": "rechts",
                    "sharp left": "scharf links",
                    "sharp right": "scharf rechts",
                    "slight left": "leicht links",
                    "slight right": "leicht rechts",
                    "straight": "geradeaus",
                    "uturn": "180Â°-Wendung"
                },
                "lanes": {
                    "xo": "Rechts halten",
                    "ox": "Links halten",
                    "xox": "Mittlere Spur nutzen",
                    "oxo": "Rechts oder links halten"
                }
            },
            "modes": {
                "ferry": {
                    "default": "FÃ¤hre nehmen",
                    "name": "FÃ¤hre nehmen {way_name}",
                    "destination": "FÃ¤hre nehmen Richtung {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} danach in {distance} {instruction_two}",
                "two linked": "{instruction_one} danach {instruction_two}",
                "one in distance": "In {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}"
                },
                "left": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich links"
                },
                "right": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich rechts"
                },
                "sharp left": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich links"
                },
                "sharp right": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich rechts"
                },
                "slight right": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich rechts",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich rechts"
                },
                "slight left": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich links",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich links"
                },
                "straight": {
                    "default": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich geradeaus",
                    "upcoming": "Sie haben Ihr {nth} Ziel erreicht, es befindet sich geradeaus",
                    "short": "Sie haben Ihr {nth} Ziel erreicht",
                    "short-upcoming": "Sie haben Ihr {nth} Ziel erreicht",
                    "named": "Sie haben Ihr {waypoint_name}, es befindet sich geradeaus"
                }
            },
            "continue": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} weiterfahren auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}",
                    "exit": "{modifier} abbiegen auf {way_name}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Weiterfahren in Richtung {destination}",
                    "distance": "Geradeaus weiterfahren fÃ¼r {distance}",
                    "namedistance": "Geradeaus weiterfahren auf {way_name} fÃ¼r {distance}"
                },
                "sharp left": {
                    "default": "Scharf links",
                    "name": "Scharf links weiterfahren auf {way_name}",
                    "destination": "Scharf links Richtung {destination}"
                },
                "sharp right": {
                    "default": "Scharf rechts",
                    "name": "Scharf rechts weiterfahren auf {way_name}",
                    "destination": "Scharf rechts Richtung {destination}"
                },
                "slight left": {
                    "default": "Leicht links",
                    "name": "Leicht links weiter auf {way_name}",
                    "destination": "Leicht links weiter Richtung {destination}"
                },
                "slight right": {
                    "default": "Leicht rechts weiter",
                    "name": "Leicht rechts weiter auf {way_name}",
                    "destination": "Leicht rechts weiter Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung",
                    "name": "180Â°-Wendung auf {way_name}",
                    "destination": "180Â°-Wendung Richtung {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Fahren Sie Richtung {direction}",
                    "name": "Fahren Sie Richtung {direction} auf {way_name}",
                    "namedistance": "Fahren Sie Richtung {direction} auf {way_name} fÃ¼r {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} abbiegen auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Geradeaus weiterfahren Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung am Ende der StraÃŸe",
                    "name": "180Â°-Wendung auf {way_name} am Ende der StraÃŸe",
                    "destination": "180Â°-Wendung Richtung {destination} am Ende der StraÃŸe"
                }
            },
            "fork": {
                "default": {
                    "default": "{modifier} halten an der Gabelung",
                    "name": "{modifier} halten an der Gabelung auf {way_name}",
                    "destination": "{modifier}  halten an der Gabelung Richtung {destination}"
                },
                "slight left": {
                    "default": "Links halten an der Gabelung",
                    "name": "Links halten an der Gabelung auf {way_name}",
                    "destination": "Links halten an der Gabelung Richtung {destination}"
                },
                "slight right": {
                    "default": "Rechts halten an der Gabelung",
                    "name": "Rechts halten an der Gabelung auf {way_name}",
                    "destination": "Rechts halten an der Gabelung Richtung {destination}"
                },
                "sharp left": {
                    "default": "Scharf links abbiegen an der Gabelung",
                    "name": "Scharf links auf {way_name}",
                    "destination": "Scharf links Richtung {destination}"
                },
                "sharp right": {
                    "default": "Scharf rechts abbiegen an der Gabelung",
                    "name": "Scharf rechts auf {way_name}",
                    "destination": "Scharf rechts Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung",
                    "name": "180Â°-Wendung auf {way_name}",
                    "destination": "180Â°-Wendung Richtung {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "{modifier} auffahren",
                    "name": "{modifier} auffahren auf {way_name}",
                    "destination": "{modifier} auffahren Richtung {destination}"
                },
                "straight": {
                    "default": "geradeaus auffahren",
                    "name": "geradeaus auffahren auf {way_name}",
                    "destination": "geradeaus auffahren Richtung {destination}"
                },
                "slight left": {
                    "default": "Leicht links auffahren",
                    "name": "Leicht links auffahren auf {way_name}",
                    "destination": "Leicht links auffahren Richtung {destination}"
                },
                "slight right": {
                    "default": "Leicht rechts auffahren",
                    "name": "Leicht rechts auffahren auf {way_name}",
                    "destination": "Leicht rechts auffahren Richtung {destination}"
                },
                "sharp left": {
                    "default": "Scharf links auffahren",
                    "name": "Scharf links auffahren auf {way_name}",
                    "destination": "Scharf links auffahren Richtung {destination}"
                },
                "sharp right": {
                    "default": "Scharf rechts auffahren",
                    "name": "Scharf rechts auffahren auf {way_name}",
                    "destination": "Scharf rechts auffahren Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung",
                    "name": "180Â°-Wendung auf {way_name}",
                    "destination": "180Â°-Wendung Richtung {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "{modifier} weiterfahren",
                    "name": "{modifier} weiterfahren auf {way_name}",
                    "destination": "{modifier} weiterfahren Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Weiterfahren auf {way_name}",
                    "destination": "Weiterfahren in Richtung {destination}"
                },
                "sharp left": {
                    "default": "Scharf links",
                    "name": "Scharf links auf {way_name}",
                    "destination": "Scharf links Richtung {destination}"
                },
                "sharp right": {
                    "default": "Scharf rechts",
                    "name": "Scharf rechts auf {way_name}",
                    "destination": "Scharf rechts Richtung {destination}"
                },
                "slight left": {
                    "default": "Leicht links weiter",
                    "name": "Leicht links weiter auf {way_name}",
                    "destination": "Leicht links weiter Richtung {destination}"
                },
                "slight right": {
                    "default": "Leicht rechts weiter",
                    "name": "Leicht rechts weiter auf {way_name}",
                    "destination": "Leicht rechts weiter Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung",
                    "name": "180Â°-Wendung auf {way_name}",
                    "destination": "180Â°-Wendung Richtung {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "{modifier} weiterfahren",
                    "name": "{modifier} weiterfahren auf {way_name}",
                    "destination": "{modifier} weiterfahren Richtung {destination}"
                },
                "uturn": {
                    "default": "180Â°-Wendung",
                    "name": "180Â°-Wendung auf {way_name}",
                    "destination": "180Â°-Wendung Richtung {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ausfahrt nehmen",
                    "name": "Ausfahrt nehmen auf {way_name}",
                    "destination": "Ausfahrt nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} nehmen",
                    "exit_destination": "Ausfahrt {exit} nehmen Richtung {destination}"
                },
                "left": {
                    "default": "Ausfahrt links nehmen",
                    "name": "Ausfahrt links nehmen auf {way_name}",
                    "destination": "Ausfahrt links nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} links nehmen",
                    "exit_destination": "Ausfahrt {exit} links nehmen Richtung {destination}"
                },
                "right": {
                    "default": "Ausfahrt rechts nehmen",
                    "name": "Ausfahrt rechts nehmen Richtung {way_name}",
                    "destination": "Ausfahrt rechts nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} rechts nehmen",
                    "exit_destination": "Ausfahrt {exit} nehmen Richtung {destination}"
                },
                "sharp left": {
                    "default": "Ausfahrt links nehmen",
                    "name": "Ausfahrt links Seite nehmen auf {way_name}",
                    "destination": "Ausfahrt links nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} links nehmen",
                    "exit_destination": "Ausfahrt{exit} links nehmen Richtung {destination}"
                },
                "sharp right": {
                    "default": "Ausfahrt rechts nehmen",
                    "name": "Ausfahrt rechts nehmen auf {way_name}",
                    "destination": "Ausfahrt rechts nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} rechts nehmen",
                    "exit_destination": "Ausfahrt {exit} nehmen Richtung {destination}"
                },
                "slight left": {
                    "default": "Ausfahrt links nehmen",
                    "name": "Ausfahrt links nehmen auf {way_name}",
                    "destination": "Ausfahrt links nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} nehmen",
                    "exit_destination": "Ausfahrt {exit} links nehmen Richtung {destination}"
                },
                "slight right": {
                    "default": "Ausfahrt rechts nehmen",
                    "name": "Ausfahrt rechts nehmen auf {way_name}",
                    "destination": "Ausfahrt rechts nehmen Richtung {destination}",
                    "exit": "Ausfahrt {exit} rechts nehmen",
                    "exit_destination": "Ausfahrt {exit} nehmen Richtung {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Auffahrt nehmen",
                    "name": "Auffahrt nehmen auf {way_name}",
                    "destination": "Auffahrt nehmen Richtung {destination}"
                },
                "left": {
                    "default": "Auffahrt links nehmen",
                    "name": "Auffahrt links nehmen auf {way_name}",
                    "destination": "Auffahrt links nehmen Richtung {destination}"
                },
                "right": {
                    "default": "Auffahrt rechts nehmen",
                    "name": "Auffahrt rechts nehmen auf {way_name}",
                    "destination": "Auffahrt rechts nehmen Richtung {destination}"
                },
                "sharp left": {
                    "default": "Auffahrt links nehmen",
                    "name": "Auffahrt links nehmen auf {way_name}",
                    "destination": "Auffahrt links nehmen Richtung {destination}"
                },
                "sharp right": {
                    "default": "Auffahrt rechts nehmen",
                    "name": "Auffahrt rechts nehmen auf {way_name}",
                    "destination": "Auffahrt rechts nehmen Richtung {destination}"
                },
                "slight left": {
                    "default": "Auffahrt links Seite nehmen",
                    "name": "Auffahrt links nehmen auf {way_name}",
                    "destination": "Auffahrt links nehmen Richtung {destination}"
                },
                "slight right": {
                    "default": "Auffahrt rechts nehmen",
                    "name": "Auffahrt rechts nehmen auf {way_name}",
                    "destination": "Auffahrt rechts nehmen Richtung {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "In den Kreisverkehr fahren",
                        "name": "Im Kreisverkehr die Ausfahrt auf {way_name} nehmen",
                        "destination": "Im Kreisverkehr die Ausfahrt Richtung {destination} nehmen"
                    },
                    "name": {
                        "default": "In {rotary_name} fahren",
                        "name": "In {rotary_name} die Ausfahrt auf {way_name} nehmen",
                        "destination": "In {rotary_name} die Ausfahrt Richtung {destination} nehmen"
                    },
                    "exit": {
                        "default": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen",
                        "name": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen auf {way_name}",
                        "destination": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen Richtung {destination}"
                    },
                    "name_exit": {
                        "default": "In den Kreisverkehr fahren und {exit_number} Ausfahrt nehmen",
                        "name": "In den Kreisverkehr fahren und {exit_number} Ausfahrt nehmen auf {way_name}",
                        "destination": "In den Kreisverkehr fahren und {exit_number} Ausfahrt nehmen Richtung {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen",
                        "name": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen auf {way_name}",
                        "destination": "Im Kreisverkehr die {exit_number} Ausfahrt nehmen Richtung {destination}"
                    },
                    "default": {
                        "default": "In den Kreisverkehr fahren",
                        "name": "Im Kreisverkehr die Ausfahrt auf {way_name} nehmen",
                        "destination": "Im Kreisverkehr die Ausfahrt Richtung {destination} nehmen"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} abbiegen auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}"
                },
                "left": {
                    "default": "Links abbiegen",
                    "name": "Links abbiegen auf {way_name}",
                    "destination": "Links abbiegen Richtung {destination}"
                },
                "right": {
                    "default": "Rechts abbiegen",
                    "name": "Rechts abbiegen auf {way_name}",
                    "destination": "Rechts abbiegen Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Geradeaus weiterfahren Richtung {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} abbiegen auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}"
                },
                "left": {
                    "default": "Links abbiegen",
                    "name": "Links abbiegen auf {way_name}",
                    "destination": "Links abbiegen Richtung {destination}"
                },
                "right": {
                    "default": "Rechts abbiegen",
                    "name": "Rechts abbiegen auf {way_name}",
                    "destination": "Rechts abbiegen Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Geradeaus weiterfahren Richtung {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} abbiegen auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}"
                },
                "left": {
                    "default": "Links abbiegen",
                    "name": "Links abbiegen auf {way_name}",
                    "destination": "Links abbiegen Richtung {destination}"
                },
                "right": {
                    "default": "Rechts abbiegen",
                    "name": "Rechts abbiegen auf {way_name}",
                    "destination": "Rechts abbiegen Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Geradeaus weiterfahren Richtung {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier} abbiegen",
                    "name": "{modifier} abbiegen auf {way_name}",
                    "destination": "{modifier} abbiegen Richtung {destination}"
                },
                "left": {
                    "default": "Links abbiegen",
                    "name": "Links abbiegen auf {way_name}",
                    "destination": "Links abbiegen Richtung {destination}"
                },
                "right": {
                    "default": "Rechts abbiegen",
                    "name": "Rechts abbiegen auf {way_name}",
                    "destination": "Rechts abbiegen Richtung {destination}"
                },
                "straight": {
                    "default": "Geradeaus weiterfahren",
                    "name": "Geradeaus weiterfahren auf {way_name}",
                    "destination": "Geradeaus weiterfahren Richtung {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Geradeaus weiterfahren"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],25:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1st",
                    "2": "2nd",
                    "3": "3rd",
                    "4": "4th",
                    "5": "5th",
                    "6": "6th",
                    "7": "7th",
                    "8": "8th",
                    "9": "9th",
                    "10": "10th"
                },
                "direction": {
                    "north": "north",
                    "northeast": "northeast",
                    "east": "east",
                    "southeast": "southeast",
                    "south": "south",
                    "southwest": "southwest",
                    "west": "west",
                    "northwest": "northwest"
                },
                "modifier": {
                    "left": "left",
                    "right": "right",
                    "sharp left": "sharp left",
                    "sharp right": "sharp right",
                    "slight left": "slight left",
                    "slight right": "slight right",
                    "straight": "straight",
                    "uturn": "U-turn"
                },
                "lanes": {
                    "xo": "Keep right",
                    "ox": "Keep left",
                    "xox": "Keep in the middle",
                    "oxo": "Keep left or right"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Take the ferry",
                    "name": "Take the ferry {way_name}",
                    "destination": "Take the ferry towards {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, then, in {distance}, {instruction_two}",
                "two linked": "{instruction_one}, then {instruction_two}",
                "one in distance": "In {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "You have arrived at your {nth} destination",
                    "upcoming": "You will arrive at your {nth} destination",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}"
                },
                "left": {
                    "default": "You have arrived at your {nth} destination, on the left",
                    "upcoming": "You will arrive at your {nth} destination, on the left",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the left"
                },
                "right": {
                    "default": "You have arrived at your {nth} destination, on the right",
                    "upcoming": "You will arrive at your {nth} destination, on the right",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the right"
                },
                "sharp left": {
                    "default": "You have arrived at your {nth} destination, on the left",
                    "upcoming": "You will arrive at your {nth} destination, on the left",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the left"
                },
                "sharp right": {
                    "default": "You have arrived at your {nth} destination, on the right",
                    "upcoming": "You will arrive at your {nth} destination, on the right",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the right"
                },
                "slight right": {
                    "default": "You have arrived at your {nth} destination, on the right",
                    "upcoming": "You will arrive at your {nth} destination, on the right",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the right"
                },
                "slight left": {
                    "default": "You have arrived at your {nth} destination, on the left",
                    "upcoming": "You will arrive at your {nth} destination, on the left",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, on the left"
                },
                "straight": {
                    "default": "You have arrived at your {nth} destination, straight ahead",
                    "upcoming": "You will arrive at your {nth} destination, straight ahead",
                    "short": "You have arrived",
                    "short-upcoming": "You will arrive",
                    "named": "You have arrived at {waypoint_name}, straight ahead"
                }
            },
            "continue": {
                "default": {
                    "default": "Turn {modifier}",
                    "name": "Turn {modifier} to stay on {way_name}",
                    "destination": "Turn {modifier} towards {destination}",
                    "exit": "Turn {modifier} onto {way_name}"
                },
                "straight": {
                    "default": "Continue straight",
                    "name": "Continue straight to stay on {way_name}",
                    "destination": "Continue towards {destination}",
                    "distance": "Continue straight for {distance}",
                    "namedistance": "Continue on {way_name} for {distance}"
                },
                "sharp left": {
                    "default": "Make a sharp left",
                    "name": "Make a sharp left to stay on {way_name}",
                    "destination": "Make a sharp left towards {destination}"
                },
                "sharp right": {
                    "default": "Make a sharp right",
                    "name": "Make a sharp right to stay on {way_name}",
                    "destination": "Make a sharp right towards {destination}"
                },
                "slight left": {
                    "default": "Make a slight left",
                    "name": "Make a slight left to stay on {way_name}",
                    "destination": "Make a slight left towards {destination}"
                },
                "slight right": {
                    "default": "Make a slight right",
                    "name": "Make a slight right to stay on {way_name}",
                    "destination": "Make a slight right towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn",
                    "name": "Make a U-turn and continue on {way_name}",
                    "destination": "Make a U-turn towards {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Head {direction}",
                    "name": "Head {direction} on {way_name}",
                    "namedistance": "Head {direction} on {way_name} for {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Turn {modifier}",
                    "name": "Turn {modifier} onto {way_name}",
                    "destination": "Turn {modifier} towards {destination}"
                },
                "straight": {
                    "default": "Continue straight",
                    "name": "Continue straight onto {way_name}",
                    "destination": "Continue straight towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn at the end of the road",
                    "name": "Make a U-turn onto {way_name} at the end of the road",
                    "destination": "Make a U-turn towards {destination} at the end of the road"
                }
            },
            "fork": {
                "default": {
                    "default": "Keep {modifier} at the fork",
                    "name": "Keep {modifier} onto {way_name}",
                    "destination": "Keep {modifier} towards {destination}"
                },
                "slight left": {
                    "default": "Keep left at the fork",
                    "name": "Keep left onto {way_name}",
                    "destination": "Keep left towards {destination}"
                },
                "slight right": {
                    "default": "Keep right at the fork",
                    "name": "Keep right onto {way_name}",
                    "destination": "Keep right towards {destination}"
                },
                "sharp left": {
                    "default": "Take a sharp left at the fork",
                    "name": "Take a sharp left onto {way_name}",
                    "destination": "Take a sharp left towards {destination}"
                },
                "sharp right": {
                    "default": "Take a sharp right at the fork",
                    "name": "Take a sharp right onto {way_name}",
                    "destination": "Take a sharp right towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn",
                    "name": "Make a U-turn onto {way_name}",
                    "destination": "Make a U-turn towards {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Merge {modifier}",
                    "name": "Merge {modifier} onto {way_name}",
                    "destination": "Merge {modifier} towards {destination}"
                },
                "straight": {
                    "default": "Merge",
                    "name": "Merge onto {way_name}",
                    "destination": "Merge towards {destination}"
                },
                "slight left": {
                    "default": "Merge left",
                    "name": "Merge left onto {way_name}",
                    "destination": "Merge left towards {destination}"
                },
                "slight right": {
                    "default": "Merge right",
                    "name": "Merge right onto {way_name}",
                    "destination": "Merge right towards {destination}"
                },
                "sharp left": {
                    "default": "Merge left",
                    "name": "Merge left onto {way_name}",
                    "destination": "Merge left towards {destination}"
                },
                "sharp right": {
                    "default": "Merge right",
                    "name": "Merge right onto {way_name}",
                    "destination": "Merge right towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn",
                    "name": "Make a U-turn onto {way_name}",
                    "destination": "Make a U-turn towards {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} onto {way_name}",
                    "destination": "Continue {modifier} towards {destination}"
                },
                "straight": {
                    "default": "Continue straight",
                    "name": "Continue onto {way_name}",
                    "destination": "Continue towards {destination}"
                },
                "sharp left": {
                    "default": "Take a sharp left",
                    "name": "Take a sharp left onto {way_name}",
                    "destination": "Take a sharp left towards {destination}"
                },
                "sharp right": {
                    "default": "Take a sharp right",
                    "name": "Take a sharp right onto {way_name}",
                    "destination": "Take a sharp right towards {destination}"
                },
                "slight left": {
                    "default": "Continue slightly left",
                    "name": "Continue slightly left onto {way_name}",
                    "destination": "Continue slightly left towards {destination}"
                },
                "slight right": {
                    "default": "Continue slightly right",
                    "name": "Continue slightly right onto {way_name}",
                    "destination": "Continue slightly right towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn",
                    "name": "Make a U-turn onto {way_name}",
                    "destination": "Make a U-turn towards {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} onto {way_name}",
                    "destination": "Continue {modifier} towards {destination}"
                },
                "uturn": {
                    "default": "Make a U-turn",
                    "name": "Make a U-turn onto {way_name}",
                    "destination": "Make a U-turn towards {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Take the ramp",
                    "name": "Take the ramp onto {way_name}",
                    "destination": "Take the ramp towards {destination}",
                    "exit": "Take exit {exit}",
                    "exit_destination": "Take exit {exit} towards {destination}"
                },
                "left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                },
                "sharp left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "sharp right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                },
                "slight left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "slight right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Take the ramp",
                    "name": "Take the ramp onto {way_name}",
                    "destination": "Take the ramp towards {destination}"
                },
                "left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}"
                },
                "right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}"
                },
                "sharp left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}"
                },
                "sharp right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}"
                },
                "slight left": {
                    "default": "Take the ramp on the left",
                    "name": "Take the ramp on the left onto {way_name}",
                    "destination": "Take the ramp on the left towards {destination}"
                },
                "slight right": {
                    "default": "Take the ramp on the right",
                    "name": "Take the ramp on the right onto {way_name}",
                    "destination": "Take the ramp on the right towards {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Enter the traffic circle",
                        "name": "Enter the traffic circle and exit onto {way_name}",
                        "destination": "Enter the traffic circle and exit towards {destination}"
                    },
                    "name": {
                        "default": "Enter {rotary_name}",
                        "name": "Enter {rotary_name} and exit onto {way_name}",
                        "destination": "Enter {rotary_name} and exit towards {destination}"
                    },
                    "exit": {
                        "default": "Enter the traffic circle and take the {exit_number} exit",
                        "name": "Enter the traffic circle and take the {exit_number} exit onto {way_name}",
                        "destination": "Enter the traffic circle and take the {exit_number} exit towards {destination}"
                    },
                    "name_exit": {
                        "default": "Enter {rotary_name} and take the {exit_number} exit",
                        "name": "Enter {rotary_name} and take the {exit_number} exit onto {way_name}",
                        "destination": "Enter {rotary_name} and take the {exit_number} exit towards {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Enter the traffic circle and take the {exit_number} exit",
                        "name": "Enter the traffic circle and take the {exit_number} exit onto {way_name}",
                        "destination": "Enter the traffic circle and take the {exit_number} exit towards {destination}"
                    },
                    "default": {
                        "default": "Enter the traffic circle",
                        "name": "Enter the traffic circle and exit onto {way_name}",
                        "destination": "Enter the traffic circle and exit towards {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Make a {modifier}",
                    "name": "Make a {modifier} onto {way_name}",
                    "destination": "Make a {modifier} towards {destination}"
                },
                "left": {
                    "default": "Turn left",
                    "name": "Turn left onto {way_name}",
                    "destination": "Turn left towards {destination}"
                },
                "right": {
                    "default": "Turn right",
                    "name": "Turn right onto {way_name}",
                    "destination": "Turn right towards {destination}"
                },
                "straight": {
                    "default": "Continue straight",
                    "name": "Continue straight onto {way_name}",
                    "destination": "Continue straight towards {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Exit the traffic circle",
                    "name": "Exit the traffic circle onto {way_name}",
                    "destination": "Exit the traffic circle towards {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Exit the traffic circle",
                    "name": "Exit the traffic circle onto {way_name}",
                    "destination": "Exit the traffic circle towards {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Make a {modifier}",
                    "name": "Make a {modifier} onto {way_name}",
                    "destination": "Make a {modifier} towards {destination}"
                },
                "left": {
                    "default": "Turn left",
                    "name": "Turn left onto {way_name}",
                    "destination": "Turn left towards {destination}"
                },
                "right": {
                    "default": "Turn right",
                    "name": "Turn right onto {way_name}",
                    "destination": "Turn right towards {destination}"
                },
                "straight": {
                    "default": "Go straight",
                    "name": "Go straight onto {way_name}",
                    "destination": "Go straight towards {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Continue straight"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],26:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1.",
                    "2": "2.",
                    "3": "3.",
                    "4": "4.",
                    "5": "5.",
                    "6": "6.",
                    "7": "7.",
                    "8": "8.",
                    "9": "9.",
                    "10": "10."
                },
                "direction": {
                    "north": "norden",
                    "northeast": "nord-orienten",
                    "east": "orienten",
                    "southeast": "sud-orienten",
                    "south": "suden",
                    "southwest": "sud-okcidenten",
                    "west": "okcidenten",
                    "northwest": "nord-okcidenten"
                },
                "modifier": {
                    "left": "maldekstren",
                    "right": "dekstren",
                    "sharp left": "maldekstregen",
                    "sharp right": "dekstregen",
                    "slight left": "maldekstreten",
                    "slight right": "dekstreten",
                    "straight": "rekten",
                    "uturn": "turniÄu malantaÅ­en"
                },
                "lanes": {
                    "xo": "Veturu dekstre",
                    "ox": "Veturu maldekstre",
                    "xox": "Veturu meze",
                    "oxo": "Veturu dekstre aÅ­ maldekstre"
                }
            },
            "modes": {
                "ferry": {
                    "default": "EnpramiÄu",
                    "name": "EnpramiÄu {way_name}",
                    "destination": "EnpramiÄu direkte al {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} kaj post {distance} {instruction_two}",
                "two linked": "{instruction_one} kaj sekve {instruction_two}",
                "one in distance": "Post {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "elveturejo {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Vi atingis vian {nth} celon",
                    "upcoming": "Vi atingos vian {nth} celon",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}"
                },
                "left": {
                    "default": "Vi atingis vian {nth} celon Ä‰e maldekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e maldekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e maldekstre"
                },
                "right": {
                    "default": "Vi atingis vian {nth} celon Ä‰e dekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e dekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e dekstre"
                },
                "sharp left": {
                    "default": "Vi atingis vian {nth} celon Ä‰e maldekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e maldekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e maldekstre"
                },
                "sharp right": {
                    "default": "Vi atingis vian {nth} celon Ä‰e dekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e dekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e dekstre"
                },
                "slight right": {
                    "default": "Vi atingis vian {nth} celon Ä‰e dekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e dekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e dekstre"
                },
                "slight left": {
                    "default": "Vi atingis vian {nth} celon Ä‰e maldekstre",
                    "upcoming": "Vi atingos vian {nth} celon Ä‰e maldekstre",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name}, Ä‰e maldekstre"
                },
                "straight": {
                    "default": "Vi atingis vian {nth} celon",
                    "upcoming": "Vi atingos vian {nth} celon rekte",
                    "short": "Vi atingis",
                    "short-upcoming": "Vi atingos",
                    "named": "Vi atingis {waypoint_name} antaÅ­e"
                }
            },
            "continue": {
                "default": {
                    "default": "Veturu {modifier}",
                    "name": "Veturu {modifier} al {way_name}",
                    "destination": "Veturu {modifier} direkte al {destination}",
                    "exit": "Veturu {modifier} direkte al {way_name}"
                },
                "straight": {
                    "default": "Veturu rekten",
                    "name": "Veturu rekten al {way_name}",
                    "destination": "Veturu rekten direkte al {destination}",
                    "distance": "Veturu rekten dum {distance}",
                    "namedistance": "Veturu rekten al {way_name} dum {distance}"
                },
                "sharp left": {
                    "default": "TurniÄu ege maldekstren",
                    "name": "TurniÄu ege maldekstren al {way_name}",
                    "destination": "TurniÄu ege maldekstren direkte al {destination}"
                },
                "sharp right": {
                    "default": "TurniÄu ege dekstren",
                    "name": "TurniÄu ege dekstren al {way_name}",
                    "destination": "TurniÄu ege dekstren direkte al {destination}"
                },
                "slight left": {
                    "default": "TurniÄu ete maldekstren",
                    "name": "TurniÄu ete maldekstren al {way_name}",
                    "destination": "TurniÄu ete maldekstren direkte al {destination}"
                },
                "slight right": {
                    "default": "TurniÄu ete dekstren",
                    "name": "TurniÄu ete dekstren al {way_name}",
                    "destination": "TurniÄu ete dekstren direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en",
                    "name": "TurniÄu malantaÅ­en al {way_name}",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "DirektiÄu {direction}",
                    "name": "DirektiÄu {direction} al {way_name}",
                    "namedistance": "DirektiÄu {direction} al {way_name} tra {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Veturu {modifier}",
                    "name": "Veturu {modifier} direkte al {way_name}",
                    "destination": "Veturu {modifier} direkte al {destination}"
                },
                "straight": {
                    "default": "Veturu rekten",
                    "name": "Veturu rekten al {way_name}",
                    "destination": "Veturu rekten direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en Ä‰e fino de la vojo",
                    "name": "TurniÄu malantaÅ­en al {way_name} Ä‰e fino de la vojo",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination} Ä‰e fino de la vojo"
                }
            },
            "fork": {
                "default": {
                    "default": "DaÅ­ru {modifier} Ä‰e la vojforko",
                    "name": "Pluu {modifier} al {way_name}",
                    "destination": "Pluu {modifier} direkte al {destination}"
                },
                "slight left": {
                    "default": "Maldekstren Ä‰e la vojforko",
                    "name": "Pluu maldekstren al {way_name}",
                    "destination": "Pluu maldekstren direkte al {destination}"
                },
                "slight right": {
                    "default": "Dekstren Ä‰e la vojforko",
                    "name": "Pluu dekstren al {way_name}",
                    "destination": "Pluu dekstren direkte al {destination}"
                },
                "sharp left": {
                    "default": "Ege maldekstren Ä‰e la vojforko",
                    "name": "TurniÄu ege maldekstren al {way_name}",
                    "destination": "TurniÄu ege maldekstren direkte al {destination}"
                },
                "sharp right": {
                    "default": "Ege dekstren Ä‰e la vojforko",
                    "name": "TurniÄu ege dekstren al {way_name}",
                    "destination": "TurniÄu ege dekstren direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en",
                    "name": "TurniÄu malantaÅ­en al {way_name}",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Enveturu {modifier}",
                    "name": "Enveturu {modifier} al {way_name}",
                    "destination": "Enveturu {modifier} direkte al {destination}"
                },
                "straight": {
                    "default": "Enveturu",
                    "name": "Enveturu al {way_name}",
                    "destination": "Enveturu direkte al {destination}"
                },
                "slight left": {
                    "default": "Enveturu de maldekstre",
                    "name": "Enveturu de maldekstre al {way_name}",
                    "destination": "Enveturu de maldekstre direkte al {destination}"
                },
                "slight right": {
                    "default": "Enveturu de dekstre",
                    "name": "Enveturu de dekstre al {way_name}",
                    "destination": "Enveturu de dekstre direkte al {destination}"
                },
                "sharp left": {
                    "default": "Enveturu de maldekstre",
                    "name": "Enveture de maldekstre al {way_name}",
                    "destination": "Enveturu de maldekstre direkte al {destination}"
                },
                "sharp right": {
                    "default": "Enveturu de dekstre",
                    "name": "Enveturu de dekstre al {way_name}",
                    "destination": "Enveturu de dekstre direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en",
                    "name": "TurniÄu malantaÅ­en al {way_name}",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Pluu {modifier}",
                    "name": "Pluu {modifier} al {way_name}",
                    "destination": "Pluu {modifier} direkte al {destination}"
                },
                "straight": {
                    "default": "Veturu rekten",
                    "name": "Veturu rekten al {way_name}",
                    "destination": "Veturu rekten direkte al {destination}"
                },
                "sharp left": {
                    "default": "TurniÄu ege maldekstren",
                    "name": "TurniÄu ege maldekstren al {way_name}",
                    "destination": "TurniÄu ege maldekstren direkte al {destination}"
                },
                "sharp right": {
                    "default": "TurniÄu ege dekstren",
                    "name": "TurniÄu ege dekstren al {way_name}",
                    "destination": "TurniÄu ege dekstren direkte al {destination}"
                },
                "slight left": {
                    "default": "Pluu ete maldekstren",
                    "name": "Pluu ete maldekstren al {way_name}",
                    "destination": "Pluu ete maldekstren direkte al {destination}"
                },
                "slight right": {
                    "default": "Pluu ete dekstren",
                    "name": "Pluu ete dekstren al {way_name}",
                    "destination": "Pluu ete dekstren direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en",
                    "name": "TurniÄu malantaÅ­en al {way_name}",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Pluu {modifier}",
                    "name": "Pluu {modifier} al {way_name}",
                    "destination": "Pluu {modifier} direkte al {destination}"
                },
                "uturn": {
                    "default": "TurniÄu malantaÅ­en",
                    "name": "TurniÄu malantaÅ­en al {way_name}",
                    "destination": "TurniÄu malantaÅ­en direkte al {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "DirektiÄu al enveturejo",
                    "name": "DirektiÄu al enveturejo al {way_name}",
                    "destination": "DirektiÄu al enveturejo direkte al {destination}",
                    "exit": "DirektiÄu al elveturejo {exit}",
                    "exit_destination": "DirektiÄu al elveturejo {exit} direkte al {destination}"
                },
                "left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}",
                    "exit": "DirektiÄu al elveturejo {exit} Ä‰e maldekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e maldekstre direkte al {destination}"
                },
                "right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}",
                    "exit": "DirektiÄu al {exit} elveturejo Ä‰e ldekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e dekstre direkte al {destination}"
                },
                "sharp left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}",
                    "exit": "DirektiÄu al {exit} elveturejo Ä‰e maldekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e maldekstre direkte al {destination}"
                },
                "sharp right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}",
                    "exit": "DirektiÄu al elveturejo {exit} Ä‰e dekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e dekstre direkte al {destination}"
                },
                "slight left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}",
                    "exit": "DirektiÄu al {exit} elveturejo Ä‰e maldekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e maldekstre direkte al {destination}"
                },
                "slight right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}",
                    "exit": "DirektiÄu al {exit} elveturejo Ä‰e ldekstre",
                    "exit_destination": "DirektiÄu al elveturejo {exit} Ä‰e dekstre direkte al {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "DirektiÄu al enveturejo",
                    "name": "DirektiÄu al enveturejo al {way_name}",
                    "destination": "DirektiÄu al enveturejo direkte al {destination}"
                },
                "left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}"
                },
                "right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}"
                },
                "sharp left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}"
                },
                "sharp right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}"
                },
                "slight left": {
                    "default": "DirektiÄu al enveturejo Ä‰e maldekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e maldekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e maldekstre al {destination}"
                },
                "slight right": {
                    "default": "DirektiÄu al enveturejo Ä‰e dekstre",
                    "name": "DirektiÄu al enveturejo Ä‰e dekstre al {way_name}",
                    "destination": "DirektiÄu al enveturejo Ä‰e dekstre al {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Enveturu trafikcirklegon",
                        "name": "Enveturu trafikcirklegon kaj elveturu al {way_name}",
                        "destination": "Enveturu trafikcirklegon kaj elveturu direkte al {destination}"
                    },
                    "name": {
                        "default": "Enveturu {rotary_name}",
                        "name": "Enveturu {rotary_name} kaj elveturu al {way_name}",
                        "destination": "Enveturu {rotary_name} kaj elveturu direkte al {destination}"
                    },
                    "exit": {
                        "default": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo",
                        "name": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo al {way_name}",
                        "destination": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo direkte al {destination}"
                    },
                    "name_exit": {
                        "default": "Enveturu {rotary_name} kaj sekve al {exit_number} elveturejo",
                        "name": "Enveturu {rotary_name} kaj sekve al {exit_number} elveturejo al {way_name}",
                        "destination": "Enveturu {rotary_name} kaj sekve al {exit_number} elveturejo direkte al {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo",
                        "name": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo al {way_name}",
                        "destination": "Enveturu trafikcirklegon kaj sekve al {exit_number} elveturejo direkte al {destination}"
                    },
                    "default": {
                        "default": "Enveturu trafikcirklegon",
                        "name": "Enveturu trafikcirklegon kaj elveturu al {way_name}",
                        "destination": "Enveturu trafikcirklegon kaj elveturu direkte al {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Veturu {modifier}",
                    "name": "Veturu {modifier} al {way_name}",
                    "destination": "Veturu {modifier} direkte al {destination}"
                },
                "left": {
                    "default": "TurniÄu maldekstren",
                    "name": "TurniÄu maldekstren al {way_name}",
                    "destination": "TurniÄu maldekstren direkte al {destination}"
                },
                "right": {
                    "default": "TurniÄu dekstren",
                    "name": "TurniÄu dekstren al {way_name}",
                    "destination": "TurniÄu dekstren direkte al {destination}"
                },
                "straight": {
                    "default": "Pluu rekten",
                    "name": "Veturu rekten al {way_name}",
                    "destination": "Veturu rekten direkte al {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Elveturu trafikcirklegon",
                    "name": "Elveturu trafikcirklegon al {way_name}",
                    "destination": "Elveturu trafikcirklegon direkte al {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Eliru trafikcirklegon",
                    "name": "Elveturu trafikcirklegon al {way_name}",
                    "destination": "Elveturu trafikcirklegon direkte al {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Veturu {modifier}",
                    "name": "Veturu {modifier} al {way_name}",
                    "destination": "Veturu {modifier} direkte al {destination}"
                },
                "left": {
                    "default": "TurniÄu maldekstren",
                    "name": "TurniÄu maldekstren al {way_name}",
                    "destination": "TurniÄu maldekstren direkte al {destination}"
                },
                "right": {
                    "default": "TurniÄu dekstren",
                    "name": "TurniÄu dekstren al {way_name}",
                    "destination": "TurniÄu dekstren direkte al {destination}"
                },
                "straight": {
                    "default": "Veturu rekten",
                    "name": "Veturu rekten al {way_name}",
                    "destination": "Veturu rekten direkte al {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Pluu rekten"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],27:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Âª",
                    "2": "2Âª",
                    "3": "3Âª",
                    "4": "4Âª",
                    "5": "5Âª",
                    "6": "6Âª",
                    "7": "7Âª",
                    "8": "8Âª",
                    "9": "9Âª",
                    "10": "10Âª"
                },
                "direction": {
                    "north": "norte",
                    "northeast": "noreste",
                    "east": "este",
                    "southeast": "sureste",
                    "south": "sur",
                    "southwest": "suroeste",
                    "west": "oeste",
                    "northwest": "noroeste"
                },
                "modifier": {
                    "left": "a la izquierda",
                    "right": "a la derecha",
                    "sharp left": "cerrada a la izquierda",
                    "sharp right": "cerrada a la derecha",
                    "slight left": "ligeramente a la izquierda",
                    "slight right": "ligeramente a la derecha",
                    "straight": "recto",
                    "uturn": "cambio de sentido"
                },
                "lanes": {
                    "xo": "Mantente a la derecha",
                    "ox": "Mantente a la izquierda",
                    "xox": "Mantente en el medio",
                    "oxo": "Mantente a la izquierda o a la derecha"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Coge el ferry",
                    "name": "Coge el ferry {way_name}",
                    "destination": "Coge el ferry hacia {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} y luego en {distance}, {instruction_two}",
                "two linked": "{instruction_one} y luego {instruction_two}",
                "one in distance": "A {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "salida {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Has llegado a tu {nth} destino",
                    "upcoming": "Vas a llegar a tu {nth} destino",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}"
                },
                "left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "sharp left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "sharp right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "slight right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "slight left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "straight": {
                    "default": "Has llegado a tu {nth} destino, en frente",
                    "upcoming": "Vas a llegar a tu {nth} destino, en frente",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, en frente"
                }
            },
            "continue": {
                "default": {
                    "default": "Gire {modifier}",
                    "name": "Cruce {modifier} en {way_name}",
                    "destination": "Gire {modifier} hacia {destination}",
                    "exit": "Gire {modifier} en {way_name}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa en {way_name}",
                    "destination": "ContinÃºa hacia {destination}",
                    "distance": "ContinÃºa recto por {distance}",
                    "namedistance": "ContinÃºa recto en {way_name} por {distance}"
                },
                "sharp left": {
                    "default": "Gire a la izquierda",
                    "name": "Gire a la izquierda en {way_name}",
                    "destination": "Gire a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gire a la derecha",
                    "name": "Gire a la derecha en {way_name}",
                    "destination": "Gire a la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "Gire a la izquierda",
                    "name": "Doble levementeÂ a la izquierda en {way_name}",
                    "destination": "Gire a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Gire a la izquierda",
                    "name": "Doble levemente a la derecha en {way_name}",
                    "destination": "Gire a la izquierda hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido y continÃºa en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "DirÃ­gete al {direction}",
                    "name": "DirÃ­gete al {direction} por {way_name}",
                    "namedistance": "DirÃ­gete al {direction} en {way_name} por {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Al final de la calle gira {modifier}",
                    "name": "Al final de la calle gira {modifier} por {way_name}",
                    "destination": "Al final de la calle gira {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "Al final de la calle continÃºa recto",
                    "name": "Al final de la calle continÃºa recto por {way_name}",
                    "destination": "Al final de la calle continÃºa recto hacia {destination}"
                },
                "uturn": {
                    "default": "Al final de la calle haz un cambio de sentido",
                    "name": "Al final de la calle haz un cambio de sentido en {way_name}",
                    "destination": "Al final de la calle haz un cambio de sentido hacia {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "Mantente {modifier} en el cruce",
                    "name": "Mantente {modifier} por {way_name}",
                    "destination": "Mantente {modifier} hacia {destination}"
                },
                "slight left": {
                    "default": "Mantente a la izquierda en el cruce",
                    "name": "Mantente a la izquierda por {way_name}",
                    "destination": "Mantente a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Mantente a la derecha en el cruce",
                    "name": "Mantente a la derecha por {way_name}",
                    "destination": "Mantente a la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "Gira la izquierda en el cruce",
                    "name": "Gira a la izquierda por {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gira a la derecha en el cruce",
                    "name": "Gira a la derecha por {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "IncorpÃ³rate {modifier}",
                    "name": "IncorpÃ³rate {modifier} por {way_name}",
                    "destination": "IncorpÃ³rate {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "IncorpÃ³rate",
                    "name": "IncorpÃ³rate por {way_name}",
                    "destination": "IncorpÃ³rate hacia {destination}"
                },
                "slight left": {
                    "default": "IncorpÃ³rate a la izquierda",
                    "name": "IncorpÃ³rate a la izquierda por {way_name}",
                    "destination": "IncorpÃ³rate a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "IncorpÃ³rate a la derecha",
                    "name": "IncorpÃ³rate a la derecha por {way_name}",
                    "destination": "IncorpÃ³rate a la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "IncorpÃ³rate a la izquierda",
                    "name": "IncorpÃ³rate a la izquierda por {way_name}",
                    "destination": "IncorpÃ³rate a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "IncorpÃ³rate a la derecha",
                    "name": "IncorpÃ³rate a la derecha por {way_name}",
                    "destination": "IncorpÃ³rate a la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "ContinÃºa {modifier}",
                    "name": "ContinÃºa {modifier} por {way_name}",
                    "destination": "ContinÃºa {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa por {way_name}",
                    "destination": "ContinÃºa hacia {destination}"
                },
                "sharp left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda por {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha por {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "ContinÃºa ligeramente por la izquierda",
                    "name": "ContinÃºa ligeramente por la izquierda por {way_name}",
                    "destination": "ContinÃºa ligeramente por la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "ContinÃºa ligeramente por la derecha",
                    "name": "ContinÃºa ligeramente por la derecha por {way_name}",
                    "destination": "ContinÃºa ligeramente por la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "ContinÃºa {modifier}",
                    "name": "ContinÃºa {modifier} por {way_name}",
                    "destination": "ContinÃºa {modifier} hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Coge la cuesta abajo",
                    "name": "Coge la cuesta abajo por {way_name}",
                    "destination": "Coge la cuesta abajo hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit}",
                    "exit_destination": "Coge la cuesta abajo {exit} hacia {destination}"
                },
                "left": {
                    "default": "Coge la cuesta abajo de la izquierda",
                    "name": "Coge la cuesta abajo de la izquierda por {way_name}",
                    "destination": "Coge la cuesta abajo de la izquierda hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit} a tu izquierda",
                    "exit_destination": "Coge la cuesta abajo {exit} a tu izquierda hacia {destination}"
                },
                "right": {
                    "default": "Coge la cuesta abajo de la derecha",
                    "name": "Coge la cuesta abajo de la derecha por {way_name}",
                    "destination": "Coge la cuesta abajo de la derecha hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit}",
                    "exit_destination": "Coge la cuesta abajo {exit} hacia {destination}"
                },
                "sharp left": {
                    "default": "Coge la cuesta abajo de la izquierda",
                    "name": "Coge la cuesta abajo de la izquierda por {way_name}",
                    "destination": "Coge la cuesta abajo de la izquierda hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit} a tu izquierda",
                    "exit_destination": "Coge la cuesta abajo {exit} a tu izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Coge la cuesta abajo de la derecha",
                    "name": "Coge la cuesta abajo de la derecha por {way_name}",
                    "destination": "Coge la cuesta abajo de la derecha hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit}",
                    "exit_destination": "Coge la cuesta abajo {exit} hacia {destination}"
                },
                "slight left": {
                    "default": "Coge la cuesta abajo de la izquierda",
                    "name": "Coge la cuesta abajo de la izquierda por {way_name}",
                    "destination": "Coge la cuesta abajo de la izquierda hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit} a tu izquierda",
                    "exit_destination": "Coge la cuesta abajoÂ {exit} a tu izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Coge la cuesta abajo de la derecha",
                    "name": "Coge la cuesta abajo de la derecha por {way_name}",
                    "destination": "Coge la cuesta abajo de la derecha hacia {destination}",
                    "exit": "Coge la cuesta abajo {exit}",
                    "exit_destination": "Coge la cuesta abajo {exit} hacia {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Coge la cuesta",
                    "name": "Coge la cuesta por {way_name}",
                    "destination": "Coge la cuesta hacia {destination}"
                },
                "left": {
                    "default": "Coge la cuesta de la izquierda",
                    "name": "Coge la cuesta de la izquierda por {way_name}",
                    "destination": "Coge la cuesta de la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Coge la cuesta de la derecha",
                    "name": "Coge la cuesta de la derecha por {way_name}",
                    "destination": "Coge la cuesta de la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "Coge la cuesta de la izquierda",
                    "name": "Coge la cuesta de la izquierda por {way_name}",
                    "destination": "Coge la cuesta de la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Coge la cuesta de la derecha",
                    "name": "Coge la cuesta de la derecha por {way_name}",
                    "destination": "Coge la cuesta de la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "Coge la cuesta de la izquierda",
                    "name": "Coge la cuesta de la izquierda por {way_name}",
                    "destination": "Coge la cuesta de la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Coge la cuesta de la derecha",
                    "name": "Coge la cuesta de la derecha por {way_name}",
                    "destination": "Coge la cuesta de la derecha hacia {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "IncorpÃ³rate en la rotonda",
                        "name": "En la rotonda sal por {way_name}",
                        "destination": "En la rotonda sal hacia {destination}"
                    },
                    "name": {
                        "default": "En {rotary_name}",
                        "name": "En {rotary_name} sal por {way_name}",
                        "destination": "En {rotary_name} sal hacia {destination}"
                    },
                    "exit": {
                        "default": "En la rotonda toma la {exit_number} salida",
                        "name": "En la rotonda toma la {exit_number} salida por {way_name}",
                        "destination": "En la rotonda toma la {exit_number} salida hacia {destination}"
                    },
                    "name_exit": {
                        "default": "En {rotary_name} toma la {exit_number} salida",
                        "name": "En {rotary_name} toma la {exit_number} salida por {way_name}",
                        "destination": "En {rotary_name} toma la {exit_number} salida hacia {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "En la rotonda toma la {exit_number} salida",
                        "name": "En la rotonda toma la {exit_number} salida por {way_name}",
                        "destination": "En la rotonda toma la {exit_number} salida hacia {destination}"
                    },
                    "default": {
                        "default": "IncorpÃ³rate en la rotonda",
                        "name": "IncorpÃ³rate en la rotonda y sal en {way_name}",
                        "destination": "IncorpÃ³rate en la rotonda y sal hacia {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Siga {modifier}",
                    "name": "Siga {modifier} en {way_name}",
                    "destination": "Siga {modifier} hacia {destination}"
                },
                "left": {
                    "default": "Gire a la izquierda",
                    "name": "Gire a la izquierda en {way_name}",
                    "destination": "Gire a la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Gire a la derecha",
                    "name": "Gire a la derecha en {way_name}",
                    "destination": "Gire a la derecha hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa recto por {way_name}",
                    "destination": "ContinÃºa recto hacia {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Sal la rotonda",
                    "name": "Toma la salida por {way_name}",
                    "destination": "Toma la salida hacia {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Sal la rotonda",
                    "name": "Toma la salida por {way_name}",
                    "destination": "Toma la salida hacia {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Gira {modifier}",
                    "name": "Gira {modifier} por {way_name}",
                    "destination": "Gira {modifier} hacia {destination}"
                },
                "left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda por {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha por {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa recto por {way_name}",
                    "destination": "ContinÃºa recto hacia {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ContinÃºa recto"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],28:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Âª",
                    "2": "2Âª",
                    "3": "3Âª",
                    "4": "4Âª",
                    "5": "5Âª",
                    "6": "6Âª",
                    "7": "7Âª",
                    "8": "8Âª",
                    "9": "9Âª",
                    "10": "10Âª"
                },
                "direction": {
                    "north": "norte",
                    "northeast": "noreste",
                    "east": "este",
                    "southeast": "sureste",
                    "south": "sur",
                    "southwest": "suroeste",
                    "west": "oeste",
                    "northwest": "noroeste"
                },
                "modifier": {
                    "left": "izquierda",
                    "right": "derecha",
                    "sharp left": "cerrada a la izquierda",
                    "sharp right": "cerrada a la derecha",
                    "slight left": "levemente a la izquierda",
                    "slight right": "levemente a la derecha",
                    "straight": "recto",
                    "uturn": "cambio de sentido"
                },
                "lanes": {
                    "xo": "Mantente a la derecha",
                    "ox": "Mantente a la izquierda",
                    "xox": "Mantente en el medio",
                    "oxo": "Mantente a la izquierda o derecha"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Coge el ferry",
                    "name": "Coge el ferry {way_name}",
                    "destination": "Coge el ferry a {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} y luego a {distance}, {instruction_two}",
                "two linked": "{instruction_one} y luego {instruction_two}",
                "one in distance": "A {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "salida {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Has llegado a tu {nth} destino",
                    "upcoming": "Vas a llegar a tu {nth} destino",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}"
                },
                "left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "sharp left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "sharp right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "slight right": {
                    "default": "Has llegado a tu {nth} destino, a la derecha",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la derecha",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la derecha"
                },
                "slight left": {
                    "default": "Has llegado a tu {nth} destino, a la izquierda",
                    "upcoming": "Vas a llegar a tu {nth} destino, a la izquierda",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, a la izquierda"
                },
                "straight": {
                    "default": "Has llegado a tu {nth} destino, en frente",
                    "upcoming": "Vas a llegar a tu {nth} destino, en frente",
                    "short": "Has llegado",
                    "short-upcoming": "Vas a llegar",
                    "named": "Has llegado a {waypoint_name}, en frente"
                }
            },
            "continue": {
                "default": {
                    "default": "Gira a {modifier}",
                    "name": "Cruza a la{modifier}  en {way_name}",
                    "destination": "Gira a {modifier} hacia {destination}",
                    "exit": "Gira a {modifier} en {way_name}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa en {way_name}",
                    "destination": "ContinÃºa hacia {destination}",
                    "distance": "ContinÃºa recto por {distance}",
                    "namedistance": "ContinÃºa recto en {way_name} por {distance}"
                },
                "sharp left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha en {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "Gira a la izquierda",
                    "name": "Dobla levemente a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Gira a la izquierda",
                    "name": "Dobla levemente a la derecha en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido y continÃºa en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Ve a {direction}",
                    "name": "Ve a {direction} en {way_name}",
                    "namedistance": "Ve a {direction} en {way_name} por {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Gira  a {modifier}",
                    "name": "Gira a {modifier} en {way_name}",
                    "destination": "Gira a {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa recto en {way_name}",
                    "destination": "ContinÃºa recto hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido al final de la via",
                    "name": "Haz un cambio de sentido en {way_name} al final de la via",
                    "destination": "Haz un cambio de sentido hacia {destination} al final de la via"
                }
            },
            "fork": {
                "default": {
                    "default": "Mantente  {modifier} en el cruza",
                    "name": "Mantente {modifier} en {way_name}",
                    "destination": "Mantente {modifier} hacia {destination}"
                },
                "slight left": {
                    "default": "Mantente a la izquierda en el cruza",
                    "name": "Mantente a la izquierda en {way_name}",
                    "destination": "Mantente a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Mantente a la derecha en el cruza",
                    "name": "Mantente a la derecha en {way_name}",
                    "destination": "Mantente a la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "Gira a la izquierda en el cruza",
                    "name": "Gira a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gira a la derecha en el cruza",
                    "name": "Gira a la derecha en {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "IncorpÃ³rate a {modifier}",
                    "name": "IncorpÃ³rate a {modifier} en {way_name}",
                    "destination": "IncorpÃ³rate a {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "IncorpÃ³rate",
                    "name": "IncorpÃ³rate a {way_name}",
                    "destination": "IncorpÃ³rate hacia {destination}"
                },
                "slight left": {
                    "default": "IncorpÃ³rate a la izquierda",
                    "name": "IncorpÃ³rate a la izquierda en {way_name}",
                    "destination": "IncorpÃ³rate a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "IncorpÃ³rate a la derecha",
                    "name": "IncorpÃ³rate a la derecha en {way_name}",
                    "destination": "IncorpÃ³rate a la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "IncorpÃ³rate a la izquierda",
                    "name": "IncorpÃ³rate a la izquierda en {way_name}",
                    "destination": "IncorpÃ³rate a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "IncorpÃ³rate a la derecha",
                    "name": "IncorpÃ³rate a la derecha en {way_name}",
                    "destination": "IncorpÃ³rate a la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "ContinÃºa {modifier}",
                    "name": "ContinÃºa {modifier} en {way_name}",
                    "destination": "ContinÃºa {modifier} hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa en {way_name}",
                    "destination": "ContinÃºa hacia {destination}"
                },
                "sharp left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha en {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "ContinÃºa levemente a la izquierda",
                    "name": "ContinÃºa levemente a la izquierda en {way_name}",
                    "destination": "ContinÃºa levemente a la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "ContinÃºa levemente a la derecha",
                    "name": "ContinÃºa levemente a la derecha en {way_name}",
                    "destination": "ContinÃºa levemente a la derecha hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "ContinÃºa {modifier}",
                    "name": "ContinÃºa {modifier} en {way_name}",
                    "destination": "ContinÃºa {modifier} hacia {destination}"
                },
                "uturn": {
                    "default": "Haz un cambio de sentido",
                    "name": "Haz un cambio de sentido en {way_name}",
                    "destination": "Haz un cambio de sentido hacia {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Toma la salida",
                    "name": "Toma la salida en {way_name}",
                    "destination": "Toma la salida hacia {destination}",
                    "exit": "Toma la salida {exit}",
                    "exit_destination": "Toma la salida {exit} hacia {destination}"
                },
                "left": {
                    "default": "Toma la salida en la izquierda",
                    "name": "Toma la salida en la izquierda en {way_name}",
                    "destination": "Toma la salida en la izquierda en {destination}",
                    "exit": "Toma la salida {exit} en la izquierda",
                    "exit_destination": "Toma la salida {exit} en la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Toma la salida en la derecha",
                    "name": "Toma la salida en la derecha en {way_name}",
                    "destination": "Toma la salida en la derecha hacia {destination}",
                    "exit": "Toma la salida {exit} en la derecha",
                    "exit_destination": "Toma la salida {exit} en la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "Ve cuesta abajo en la izquierda",
                    "name": "Ve cuesta abajo en la izquierda en {way_name}",
                    "destination": "Ve cuesta abajo en la izquierda hacia {destination}",
                    "exit": "Toma la salida {exit} en la izquierda",
                    "exit_destination": "Toma la salida {exit} en la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Ve cuesta abajo en la derecha",
                    "name": "Ve cuesta abajo en la derecha en {way_name}",
                    "destination": "Ve cuesta abajo en la derecha hacia {destination}",
                    "exit": "Toma la salida {exit} en la derecha",
                    "exit_destination": "Toma la salida {exit} en la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "Ve cuesta abajo en la izquierda",
                    "name": "Ve cuesta abajo en la izquierda en {way_name}",
                    "destination": "Ve cuesta abajo en la izquierda hacia {destination}",
                    "exit": "Toma la salida {exit} en la izquierda",
                    "exit_destination": "Toma la salida {exit} en la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Toma la salida en la derecha",
                    "name": "Toma la salida en la derecha en {way_name}",
                    "destination": "Toma la salida en la derecha hacia {destination}",
                    "exit": "Toma la salida {exit} en la derecha",
                    "exit_destination": "Toma la salida {exit} en la derecha hacia {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Toma la rampa",
                    "name": "Toma la rampa en {way_name}",
                    "destination": "Toma la rampa hacia {destination}"
                },
                "left": {
                    "default": "Toma la rampa en la izquierda",
                    "name": "Toma la rampa en la izquierda en {way_name}",
                    "destination": "Toma la rampa en la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Toma la rampa en la derecha",
                    "name": "Toma la rampa en la derecha en {way_name}",
                    "destination": "Toma la rampa en la derecha hacia {destination}"
                },
                "sharp left": {
                    "default": "Toma la rampa en la izquierda",
                    "name": "Toma la rampa en la izquierda en {way_name}",
                    "destination": "Toma la rampa en la izquierda hacia {destination}"
                },
                "sharp right": {
                    "default": "Toma la rampa en la derecha",
                    "name": "Toma la rampa en la derecha en {way_name}",
                    "destination": "Toma la rampa en la derecha hacia {destination}"
                },
                "slight left": {
                    "default": "Toma la rampa en la izquierda",
                    "name": "Toma la rampa en la izquierda en {way_name}",
                    "destination": "Toma la rampa en la izquierda hacia {destination}"
                },
                "slight right": {
                    "default": "Toma la rampa en la derecha",
                    "name": "Toma la rampa en la derecha en {way_name}",
                    "destination": "Toma la rampa en la derecha hacia {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Entra en la rotonda",
                        "name": "Entra en la rotonda y sal en {way_name}",
                        "destination": "Entra en la rotonda y sal hacia {destination}"
                    },
                    "name": {
                        "default": "Entra en {rotary_name}",
                        "name": "Entra en {rotary_name} y sal en {way_name}",
                        "destination": "Entra en {rotary_name} y sal hacia {destination}"
                    },
                    "exit": {
                        "default": "Entra en la rotonda y toma la {exit_number} salida",
                        "name": "Entra en la rotonda y toma la {exit_number} salida a {way_name}",
                        "destination": "Entra en la rotonda y toma la {exit_number} salida hacia {destination}"
                    },
                    "name_exit": {
                        "default": "Entra en {rotary_name} y coge la {exit_number} salida",
                        "name": "Entra en {rotary_name} y coge la {exit_number} salida en {way_name}",
                        "destination": "Entra en {rotary_name} y coge la {exit_number} salida hacia {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Entra en la rotonda y toma la {exit_number} salida",
                        "name": "Entra en la rotonda y toma la {exit_number} salida a {way_name}",
                        "destination": "Entra en la rotonda y toma la {exit_number} salida hacia {destination}"
                    },
                    "default": {
                        "default": "Entra en la rotonda",
                        "name": "Entra en la rotonda y sal en {way_name}",
                        "destination": "Entra en la rotonda y sal hacia {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Sigue {modifier}",
                    "name": "Sigue {modifier} en {way_name}",
                    "destination": "Sigue {modifier} hacia {destination}"
                },
                "left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha en {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "straight": {
                    "default": "ContinÃºa recto",
                    "name": "ContinÃºa recto en {way_name}",
                    "destination": "ContinÃºa recto hacia {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Sal la rotonda",
                    "name": "Sal la rotonda en {way_name}",
                    "destination": "Sal la rotonda hacia {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Sal la rotonda",
                    "name": "Sal la rotonda en {way_name}",
                    "destination": "Sal la rotonda hacia {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Sigue {modifier}",
                    "name": "Sigue {modifier} en {way_name}",
                    "destination": "Sigue {modifier} hacia {destination}"
                },
                "left": {
                    "default": "Gira a la izquierda",
                    "name": "Gira a la izquierda en {way_name}",
                    "destination": "Gira a la izquierda hacia {destination}"
                },
                "right": {
                    "default": "Gira a la derecha",
                    "name": "Gira a la derecha en {way_name}",
                    "destination": "Gira a la derecha hacia {destination}"
                },
                "straight": {
                    "default": "Ve recto",
                    "name": "Ve recto en {way_name}",
                    "destination": "Ve recto hacia {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ContinÃºa recto"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],29:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1.",
                    "2": "2.",
                    "3": "3.",
                    "4": "4.",
                    "5": "5.",
                    "6": "6.",
                    "7": "7.",
                    "8": "8.",
                    "9": "9.",
                    "10": "10."
                },
                "direction": {
                    "north": "pohjoiseen",
                    "northeast": "koilliseen",
                    "east": "itÃ¤Ã¤n",
                    "southeast": "kaakkoon",
                    "south": "etelÃ¤Ã¤n",
                    "southwest": "lounaaseen",
                    "west": "lÃ¤nteen",
                    "northwest": "luoteeseen"
                },
                "modifier": {
                    "left": "vasemmall(e/a)",
                    "right": "oikeall(e/a)",
                    "sharp left": "jyrkÃ¤sti vasempaan",
                    "sharp right": "jyrkÃ¤sti oikeaan",
                    "slight left": "loivasti vasempaan",
                    "slight right": "loivasti oikeaan",
                    "straight": "suoraan eteenpÃ¤in",
                    "uturn": "U-kÃ¤Ã¤nnÃ¶s"
                },
                "lanes": {
                    "xo": "Pysy oikealla",
                    "ox": "Pysy vasemmalla",
                    "xox": "Pysy keskellÃ¤",
                    "oxo": "Pysy vasemmalla tai oikealla"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Aja lautalle",
                    "name": "Aja lautalle {way_name}",
                    "destination": "Aja lautalle, jonka mÃ¤Ã¤rÃ¤npÃ¤Ã¤ on {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, sitten {distance} pÃ¤Ã¤stÃ¤, {instruction_two}",
                "two linked": "{instruction_one}, sitten {instruction_two}",
                "one in distance": "{distance} pÃ¤Ã¤stÃ¤, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "{exit}"
            },
            "arrive": {
                "default": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}"
                },
                "left": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on vasemmalla puolellasi"
                },
                "right": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on oikealla puolellasi"
                },
                "sharp left": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on vasemmalla puolellasi"
                },
                "sharp right": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on oikealla puolellasi"
                },
                "slight right": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on oikealla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on oikealla puolellasi"
                },
                "slight left": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on vasemmalla puolellasi",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on vasemmalla puolellasi"
                },
                "straight": {
                    "default": "Olet saapunut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, joka on suoraan edessÃ¤si",
                    "upcoming": "Saavut {nth} mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤si, suoraan edessÃ¤",
                    "short": "Olet saapunut",
                    "short-upcoming": "Saavut",
                    "named": "Olet saapunut mÃ¤Ã¤rÃ¤npÃ¤Ã¤hÃ¤n {waypoint_name}, joka on suoraan edessÃ¤si"
                }
            },
            "continue": {
                "default": {
                    "default": "KÃ¤Ã¤nny {modifier}",
                    "name": "KÃ¤Ã¤nny {modifier} pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "KÃ¤Ã¤nny {modifier} suuntana {destination}",
                    "exit": "KÃ¤Ã¤nny {modifier} tielle {way_name}"
                },
                "straight": {
                    "default": "Jatka suoraan eteenpÃ¤in",
                    "name": "Jatka suoraan pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "Jatka suuntana {destination}",
                    "distance": "Jatka suoraan {distance}",
                    "namedistance": "Jatka tiellÃ¤ {way_name} {distance}"
                },
                "sharp left": {
                    "default": "Jatka jyrkÃ¤sti vasempaan",
                    "name": "Jatka jyrkÃ¤sti vasempaan pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "Jatka jyrkÃ¤sti vasempaan suuntana {destination}"
                },
                "sharp right": {
                    "default": "Jatka jyrkÃ¤sti oikeaan",
                    "name": "Jatka jyrkÃ¤sti oikeaan pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "Jatka jyrkÃ¤sti oikeaan suuntana {destination}"
                },
                "slight left": {
                    "default": "Jatka loivasti vasempaan",
                    "name": "Jatka loivasti vasempaan pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "Jatka loivasti vasempaan suuntana {destination}"
                },
                "slight right": {
                    "default": "Jatka loivasti oikeaan",
                    "name": "Jatka loivasti oikeaan pysyÃ¤ksesi tiellÃ¤ {way_name}",
                    "destination": "Jatka loivasti oikeaan suuntana {destination}"
                },
                "uturn": {
                    "default": "Tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tee U-kÃ¤Ã¤nnÃ¶s ja jatka tietÃ¤ {way_name}",
                    "destination": "Tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Aja {direction}",
                    "name": "Aja tietÃ¤ {way_name} {direction}",
                    "namedistance": "Aja {distance} {direction} tietÃ¤ {way_name} "
                }
            },
            "end of road": {
                "default": {
                    "default": "KÃ¤Ã¤nny {modifier}",
                    "name": "KÃ¤Ã¤nny {modifier} tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny {modifier} suuntana {destination}"
                },
                "straight": {
                    "default": "Jatka suoraan eteenpÃ¤in",
                    "name": "Jatka suoraan eteenpÃ¤in tielle {way_name}",
                    "destination": "Jatka suoraan eteenpÃ¤in suuntana {destination}"
                },
                "uturn": {
                    "default": "Tien pÃ¤Ã¤ssÃ¤ tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tien pÃ¤Ã¤ssÃ¤ tee U-kÃ¤Ã¤nnÃ¶s tielle {way_name}",
                    "destination": "Tien pÃ¤Ã¤ssÃ¤ tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "Jatka tienhaarassa {modifier}",
                    "name": "Jatka {modifier} tielle {way_name}",
                    "destination": "Jatka {modifier} suuntana {destination}"
                },
                "slight left": {
                    "default": "Pysy vasemmalla tienhaarassa",
                    "name": "Pysy vasemmalla tielle {way_name}",
                    "destination": "Pysy vasemmalla suuntana {destination}"
                },
                "slight right": {
                    "default": "Pysy oikealla tienhaarassa",
                    "name": "Pysy oikealla tielle {way_name}",
                    "destination": "Pysy oikealla suuntana {destination}"
                },
                "sharp left": {
                    "default": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti vasempaan",
                    "name": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti vasempaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti vasempaan suuntana {destination}"
                },
                "sharp right": {
                    "default": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti oikeaan",
                    "name": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti oikeaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny tienhaarassa jyrkÃ¤sti oikeaan suuntana {destination}"
                },
                "uturn": {
                    "default": "Tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tee U-kÃ¤Ã¤nnÃ¶s tielle {way_name}",
                    "destination": "Tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Liity {modifier}",
                    "name": "Liity {modifier}, tielle {way_name}",
                    "destination": "Liity {modifier}, suuntana {destination}"
                },
                "straight": {
                    "default": "Liity",
                    "name": "Liity tielle {way_name}",
                    "destination": "Liity suuntana {destination}"
                },
                "slight left": {
                    "default": "Liity vasemmalle",
                    "name": "Liity vasemmalle, tielle {way_name}",
                    "destination": "Liity vasemmalle, suuntana {destination}"
                },
                "slight right": {
                    "default": "Liity oikealle",
                    "name": "Liity oikealle, tielle {way_name}",
                    "destination": "Liity oikealle, suuntana {destination}"
                },
                "sharp left": {
                    "default": "Liity vasemmalle",
                    "name": "Liity vasemmalle, tielle {way_name}",
                    "destination": "Liity vasemmalle, suuntana {destination}"
                },
                "sharp right": {
                    "default": "Liity oikealle",
                    "name": "Liity oikealle, tielle {way_name}",
                    "destination": "Liity oikealle, suuntana {destination}"
                },
                "uturn": {
                    "default": "Tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tee U-kÃ¤Ã¤nnÃ¶s tielle {way_name}",
                    "destination": "Tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Jatka {modifier}",
                    "name": "Jatka {modifier} tielle {way_name}",
                    "destination": "Jatka {modifier} suuntana {destination}"
                },
                "straight": {
                    "default": "Jatka suoraan eteenpÃ¤in",
                    "name": "Jatka tielle {way_name}",
                    "destination": "Jatka suuntana {destination}"
                },
                "sharp left": {
                    "default": "KÃ¤Ã¤nny jyrkÃ¤sti vasempaan",
                    "name": "KÃ¤Ã¤nny jyrkÃ¤sti vasempaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny jyrkÃ¤sti vasempaan suuntana {destination}"
                },
                "sharp right": {
                    "default": "KÃ¤Ã¤nny jyrkÃ¤sti oikeaan",
                    "name": "KÃ¤Ã¤nny jyrkÃ¤sti oikeaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny jyrkÃ¤sti oikeaan suuntana {destination}"
                },
                "slight left": {
                    "default": "Jatka loivasti vasempaan",
                    "name": "Jatka loivasti vasempaan tielle {way_name}",
                    "destination": "Jatka loivasti vasempaan suuntana {destination}"
                },
                "slight right": {
                    "default": "Jatka loivasti oikeaan",
                    "name": "Jatka loivasti oikeaan tielle {way_name}",
                    "destination": "Jatka loivasti oikeaan suuntana {destination}"
                },
                "uturn": {
                    "default": "Tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tee U-kÃ¤Ã¤nnÃ¶s tielle {way_name}",
                    "destination": "Tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Jatka {modifier}",
                    "name": "Jatka {modifier} tielle {way_name}",
                    "destination": "Jatka {modifier} suuntana {destination}"
                },
                "uturn": {
                    "default": "Tee U-kÃ¤Ã¤nnÃ¶s",
                    "name": "Tee U-kÃ¤Ã¤nnÃ¶s tielle {way_name}",
                    "destination": "Tee U-kÃ¤Ã¤nnÃ¶s suuntana {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Aja erkanemiskaistalle",
                    "name": "Aja erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit}",
                    "exit_destination": "Ota poistuminen {exit}, suuntana {destination}"
                },
                "left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} vasemmalla",
                    "exit_destination": "Ota poistuminen {exit} vasemmalla, suuntana {destination}"
                },
                "right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} oikealla",
                    "exit_destination": "Ota poistuminen {exit} oikealla, suuntana {destination}"
                },
                "sharp left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} vasemmalla",
                    "exit_destination": "Ota poistuminen {exit} vasemmalla, suuntana {destination}"
                },
                "sharp right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} oikealla",
                    "exit_destination": "Ota poistuminen {exit} oikealla, suuntana {destination}"
                },
                "slight left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} vasemmalla",
                    "exit_destination": "Ota poistuminen {exit} vasemmalla, suuntana {destination}"
                },
                "slight right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}",
                    "exit": "Ota poistuminen {exit} oikealla",
                    "exit_destination": "Ota poistuminen {exit} oikealla, suuntana {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Aja erkanemiskaistalle",
                    "name": "Aja erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja erkanemiskaistalle suuntana {destination}"
                },
                "left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}"
                },
                "right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}"
                },
                "sharp left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}"
                },
                "sharp right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}"
                },
                "slight left": {
                    "default": "Aja vasemmalla olevalle erkanemiskaistalle",
                    "name": "Aja vasemmalla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja vasemmalla olevalle erkanemiskaistalle suuntana {destination}"
                },
                "slight right": {
                    "default": "Aja oikealla olevalle erkanemiskaistalle",
                    "name": "Aja oikealla olevaa erkanemiskaistaa tielle {way_name}",
                    "destination": "Aja oikealla olevalle erkanemiskaistalle suuntana {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n",
                        "name": "Aja liikenneympyrÃ¤Ã¤n ja valitse erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n ja valitse erkanemiskaista suuntana {destination}"
                    },
                    "name": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n {rotary_name}",
                        "name": "Aja liikenneympyrÃ¤Ã¤n {rotary_name} ja valitse erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n {rotary_name} ja valitse erkanemiskaista suuntana {destination}"
                    },
                    "exit": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista",
                        "name": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista suuntana {destination}"
                    },
                    "name_exit": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n {rotary_name} ja valitse {exit_number} erkanemiskaista",
                        "name": "Aja liikenneympyrÃ¤Ã¤n {rotary_name} ja valitse {exit_number} erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n {rotary_name} ja valitse {exit_number} erkanemiskaista suuntana {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista",
                        "name": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n ja valitse {exit_number} erkanemiskaista suuntana {destination}"
                    },
                    "default": {
                        "default": "Aja liikenneympyrÃ¤Ã¤n",
                        "name": "Aja liikenneympyrÃ¤Ã¤n ja valitse erkanemiskaista tielle {way_name}",
                        "destination": "Aja liikenneympyrÃ¤Ã¤n ja valitse erkanemiskaista suuntana {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "KÃ¤Ã¤nny {modifier}",
                    "name": "KÃ¤Ã¤nny {modifier} tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny {modifier} suuntana {destination}"
                },
                "left": {
                    "default": "KÃ¤Ã¤nny vasempaan",
                    "name": "KÃ¤Ã¤nny vasempaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny vasempaan suuntana {destination}"
                },
                "right": {
                    "default": "KÃ¤Ã¤nny oikeaan",
                    "name": "KÃ¤Ã¤nny oikeaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny oikeaan suuntana {destination}"
                },
                "straight": {
                    "default": "Jatka suoraan eteenpÃ¤in",
                    "name": "Jatka suoraan eteenpÃ¤in tielle {way_name}",
                    "destination": "Jatka suoraan eteenpÃ¤in suuntana {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Poistu liikenneympyrÃ¤stÃ¤",
                    "name": "Poistu liikenneympyrÃ¤stÃ¤ tielle {way_name}",
                    "destination": "Poistu liikenneympyrÃ¤stÃ¤ suuntana {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Poistu liikenneympyrÃ¤stÃ¤",
                    "name": "Poistu liikenneympyrÃ¤stÃ¤ tielle {way_name}",
                    "destination": "Poistu liikenneympyrÃ¤stÃ¤ suuntana {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "KÃ¤Ã¤nny {modifier}",
                    "name": "KÃ¤Ã¤nny {modifier} tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny {modifier} suuntana {destination}"
                },
                "left": {
                    "default": "KÃ¤Ã¤nny vasempaan",
                    "name": "KÃ¤Ã¤nny vasempaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny vasempaan suuntana {destination}"
                },
                "right": {
                    "default": "KÃ¤Ã¤nny oikeaan",
                    "name": "KÃ¤Ã¤nny oikeaan tielle {way_name}",
                    "destination": "KÃ¤Ã¤nny oikeaan suuntana {destination}"
                },
                "straight": {
                    "default": "Aja suoraan eteenpÃ¤in",
                    "name": "Aja suoraan eteenpÃ¤in tielle {way_name}",
                    "destination": "Aja suoraan eteenpÃ¤in suuntana {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Jatka suoraan eteenpÃ¤in"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],30:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "premiÃ¨re",
                    "2": "seconde",
                    "3": "troisiÃ¨me",
                    "4": "quatriÃ¨me",
                    "5": "cinquiÃ¨me",
                    "6": "sixiÃ¨me",
                    "7": "septiÃ¨me",
                    "8": "huitiÃ¨me",
                    "9": "neuviÃ¨me",
                    "10": "dixiÃ¨me"
                },
                "direction": {
                    "north": "le nord",
                    "northeast": "le nord-est",
                    "east": "lâ€™est",
                    "southeast": "le sud-est",
                    "south": "le sud",
                    "southwest": "le sud-ouest",
                    "west": "lâ€™ouest",
                    "northwest": "le nord-ouest"
                },
                "modifier": {
                    "left": "Ã  gauche",
                    "right": "Ã  droite",
                    "sharp left": "franchement Ã  gauche",
                    "sharp right": "franchement Ã  droite",
                    "slight left": "lÃ©gÃ¨rement Ã  gauche",
                    "slight right": "lÃ©gÃ¨rement Ã  droite",
                    "straight": "tout droit",
                    "uturn": "demi-tour"
                },
                "lanes": {
                    "xo": "Tenir la droite",
                    "ox": "Tenir la gauche",
                    "xox": "Rester au milieu",
                    "oxo": "Tenir la gauche ou la droite"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Prendre le ferry",
                    "name": "Prendre le ferry {way_name:article}",
                    "destination": "Prendre le ferry en direction {destination:preposition}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, puis, dans {distance}, {instruction_two}",
                "two linked": "{instruction_one}, puis {instruction_two}",
                "one in distance": "Dans {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "sortie nÂ°{exit}"
            },
            "arrive": {
                "default": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}"
                },
                "left": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la gauche",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la gauche",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, sur la gauche"
                },
                "right": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la droite",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la droite",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© Ã   {waypoint_name:arrival}, sur la droite"
                },
                "sharp left": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la gauche",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la gauche",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, sur la gauche"
                },
                "sharp right": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la droite",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la droite",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, sur la droite"
                },
                "slight right": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la droite",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la droite",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous arriverez",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, sur la droite"
                },
                "slight left": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, sur la gauche",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, sur la gauche",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous Ãªtes arrivÃ©",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, sur la gauche"
                },
                "straight": {
                    "default": "Vous Ãªtes arrivÃ© Ã  votre {nth} destination, droit devant",
                    "upcoming": "Vous arriverez Ã  votre {nth} destination, droit devant",
                    "short": "Vous Ãªtes arrivÃ©",
                    "short-upcoming": "Vous Ãªtes arrivÃ©",
                    "named": "Vous Ãªtes arrivÃ© {waypoint_name:arrival}, droit devant"
                }
            },
            "continue": {
                "default": {
                    "default": "Tourner {modifier}",
                    "name": "Tourner {modifier} pour rester sur {way_name:article}",
                    "destination": "Tourner {modifier} en direction {destination:preposition}",
                    "exit": "Tourner {modifier} sur {way_name:article}"
                },
                "straight": {
                    "default": "Continuer tout droit",
                    "name": "Continuer tout droit pour rester sur {way_name:article}",
                    "destination": "Continuer tout droit en direction {destination:preposition}",
                    "distance": "Continuer tout droit sur {distance}",
                    "namedistance": "Continuer sur {way_name:article} sur {distance}"
                },
                "sharp left": {
                    "default": "Tourner franchement Ã  gauche",
                    "name": "Tourner franchement Ã  gauche pour rester sur {way_name:article}",
                    "destination": "Tourner franchement Ã  gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Tourner franchement Ã  droite",
                    "name": "Tourner franchement Ã  droite pour rester sur {way_name:article}",
                    "destination": "Tourner franchement Ã  droite en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Tourner lÃ©gÃ¨rement Ã  gauche",
                    "name": "Tourner lÃ©gÃ¨rement Ã  gauche pour rester sur {way_name:article}",
                    "destination": "Tourner lÃ©gÃ¨rement Ã  gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Tourner lÃ©gÃ¨rement Ã  droite",
                    "name": "Tourner lÃ©gÃ¨rement Ã  droite pour rester sur {way_name:article}",
                    "destination": "Tourner lÃ©gÃ¨rement Ã  droite en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour",
                    "name": "Faire demi-tour et continuer sur {way_name:article}",
                    "destination": "Faire demi-tour en direction {destination:preposition}"
                }
            },
            "depart": {
                "default": {
                    "default": "Se diriger vers {direction}",
                    "name": "Se diriger vers {direction} sur {way_name:article}",
                    "namedistance": "Se diriger vers {direction} sur {way_name:article} sur {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Tourner {modifier}",
                    "name": "Tourner {modifier} sur {way_name:article}",
                    "destination": "Tourner {modifier} en direction {destination:preposition}"
                },
                "straight": {
                    "default": "Continuer tout droit",
                    "name": "Continuer tout droit sur {way_name:article}",
                    "destination": "Continuer tout droit en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour Ã  la fin de la route",
                    "name": "Faire demi-tour Ã  la fin {way_name:preposition}",
                    "destination": "Faire demi-tour Ã  la fin de la route en direction {destination:preposition}"
                }
            },
            "fork": {
                "default": {
                    "default": "Tenir {modifier} Ã  lâ€™embranchement",
                    "name": "Tenir {modifier} sur {way_name:article}",
                    "destination": "Tenir {modifier} en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Tenir la gauche Ã  lâ€™embranchement",
                    "name": "Tenir la gauche sur {way_name:article}",
                    "destination": "Tenir la gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Tenir la droite Ã  lâ€™embranchement",
                    "name": "Tenir la droite sur {way_name:article}",
                    "destination": "Tenir la droite en direction {destination:preposition}"
                },
                "sharp left": {
                    "default": "Tourner franchement Ã  gauche Ã  lâ€™embranchement",
                    "name": "Tourner franchement Ã  gauche sur {way_name:article}",
                    "destination": "Tourner franchement Ã  gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Tourner franchement Ã  droite Ã  lâ€™embranchement",
                    "name": "Tourner franchement Ã  droite sur {way_name:article}",
                    "destination": "Tourner franchement Ã  droite en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour",
                    "name": "Faire demi-tour sur {way_name:article}",
                    "destination": "Faire demi-tour en direction {destination:preposition}"
                }
            },
            "merge": {
                "default": {
                    "default": "Sâ€™insÃ©rer {modifier}",
                    "name": "Sâ€™insÃ©rer {modifier} sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer {modifier} en direction {destination:preposition}"
                },
                "straight": {
                    "default": "Sâ€™insÃ©rer",
                    "name": "Sâ€™insÃ©rer sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Sâ€™insÃ©rer lÃ©gÃ¨rement Ã  gauche",
                    "name": "Sâ€™insÃ©rer lÃ©gÃ¨rement Ã  gauche sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer lÃ©gÃ¨rement Ã  gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Sâ€™insÃ©rer lÃ©gÃ¨rement Ã  droite",
                    "name": "Sâ€™insÃ©rer lÃ©gÃ¨rement Ã  droite sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer Ã  droite en direction {destination:preposition}"
                },
                "sharp left": {
                    "default": "Sâ€™insÃ©rer Ã  gauche",
                    "name": "Sâ€™insÃ©rer Ã  gauche sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer Ã  gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Sâ€™insÃ©rer Ã  droite",
                    "name": "Sâ€™insÃ©rer Ã  droite sur {way_name:article}",
                    "destination": "Sâ€™insÃ©rer Ã  droite en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour",
                    "name": "Faire demi-tour sur {way_name:article}",
                    "destination": "Faire demi-tour en direction {destination:preposition}"
                }
            },
            "new name": {
                "default": {
                    "default": "Continuer {modifier}",
                    "name": "Continuer {modifier} sur {way_name:article}",
                    "destination": "Continuer {modifier} en direction {destination:preposition}"
                },
                "straight": {
                    "default": "Continuer tout droit",
                    "name": "Continuer tout droit sur {way_name:article}",
                    "destination": "Continuer tout droit en direction {destination:preposition}"
                },
                "sharp left": {
                    "default": "Tourner franchement Ã  gauche",
                    "name": "Tourner franchement Ã  gauche sur {way_name:article}",
                    "destination": "Tourner franchement Ã  gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Tourner franchement Ã  droite",
                    "name": "Tourner franchement Ã  droite sur {way_name:article}",
                    "destination": "Tourner franchement Ã  droite en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Continuer lÃ©gÃ¨rement Ã  gauche",
                    "name": "Continuer lÃ©gÃ¨rement Ã  gauche sur {way_name:article}",
                    "destination": "Continuer lÃ©gÃ¨rement Ã  gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Continuer lÃ©gÃ¨rement Ã  droite",
                    "name": "Continuer lÃ©gÃ¨rement Ã  droite sur {way_name:article}",
                    "destination": "Continuer lÃ©gÃ¨rement Ã  droite en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour",
                    "name": "Faire demi-tour sur {way_name:article}",
                    "destination": "Faire demi-tour en direction {destination:preposition}"
                }
            },
            "notification": {
                "default": {
                    "default": "Continuer {modifier}",
                    "name": "Continuer {modifier} sur {way_name:article}",
                    "destination": "Continuer {modifier} en direction {destination:preposition}"
                },
                "uturn": {
                    "default": "Faire demi-tour",
                    "name": "Faire demi-tour sur {way_name:article}",
                    "destination": "Faire demi-tour en direction {destination:preposition}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Prendre la sortie",
                    "name": "Prendre la sortie sur {way_name:article}",
                    "destination": "Prendre la sortie en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit}",
                    "exit_destination": "Prendre la sortie {exit} en direction {destination:preposition}"
                },
                "left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la gauche",
                    "exit_destination": "Prendre la sortie {exit} sur la gauche en direction {destination:preposition}"
                },
                "right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la droite",
                    "exit_destination": "Prendre la sortie {exit} sur la droite en direction {destination:preposition}"
                },
                "sharp left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la gauche",
                    "exit_destination": "Prendre la sortie {exit} sur la gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la droite",
                    "exit_destination": "Prendre la sortie {exit} sur la droite en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la gauche",
                    "exit_destination": "Prendre la sortie {exit} sur la gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}",
                    "exit": "Prendre la sortie {exit} sur la droite",
                    "exit_destination": "Prendre la sortie {exit} sur la droite en direction {destination:preposition}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Prendre la sortie",
                    "name": "Prendre la sortie sur {way_name:article}",
                    "destination": "Prendre la sortie en direction {destination:preposition}"
                },
                "left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}"
                },
                "right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}"
                },
                "sharp left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}"
                },
                "sharp right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}"
                },
                "slight left": {
                    "default": "Prendre la sortie Ã  gauche",
                    "name": "Prendre la sortie Ã  gauche sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  gauche en direction {destination:preposition}"
                },
                "slight right": {
                    "default": "Prendre la sortie Ã  droite",
                    "name": "Prendre la sortie Ã  droite sur {way_name:article}",
                    "destination": "Prendre la sortie Ã  droite en direction {destination:preposition}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Prendre le rond-point",
                        "name": "Prendre le rond-point, puis sortir sur {way_name:article}",
                        "destination": "Prendre le rond-point, puis sortir en direction {destination:preposition}"
                    },
                    "name": {
                        "default": "Prendre {rotary_name:rotary}",
                        "name": "Prendre {rotary_name:rotary}, puis sortir par {way_name:article}",
                        "destination": "Prendre {rotary_name:rotary}, puis sortir en direction {destination:preposition}"
                    },
                    "exit": {
                        "default": "Prendre le rond-point, puis la {exit_number} sortie",
                        "name": "Prendre le rond-point, puis la {exit_number} sortie sur {way_name:article}",
                        "destination": "Prendre le rond-point, puis la {exit_number} sortie en direction {destination:preposition}"
                    },
                    "name_exit": {
                        "default": "Prendre {rotary_name:rotary}, puis la {exit_number} sortie",
                        "name": "Prendre {rotary_name:rotary}, puis la {exit_number} sortie sur {way_name:article}",
                        "destination": "Prendre {rotary_name:rotary}, puis la {exit_number} sortie en direction {destination:preposition}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Prendre le rond-point, puis la {exit_number} sortie",
                        "name": "Prendre le rond-point, puis la {exit_number} sortie sur {way_name:article}",
                        "destination": "Prendre le rond-point, puis la {exit_number} sortie en direction {destination:preposition}"
                    },
                    "default": {
                        "default": "Prendre le rond-point",
                        "name": "Prendre le rond-point, puis sortir sur {way_name:article}",
                        "destination": "Prendre le rond-point, puis sortir en direction {destination:preposition}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Tourner {modifier}",
                    "name": "Tourner {modifier} sur {way_name:article}",
                    "destination": "Tourner {modifier} en direction {destination:preposition}"
                },
                "left": {
                    "default": "Tourner Ã  gauche",
                    "name": "Tourner Ã  gauche sur {way_name:article}",
                    "destination": "Tourner Ã  gauche en direction {destination:preposition}"
                },
                "right": {
                    "default": "Tourner Ã  droite",
                    "name": "Tourner Ã  droite sur {way_name:article}",
                    "destination": "Tourner Ã  droite en direction {destination:preposition}"
                },
                "straight": {
                    "default": "Continuer tout droit",
                    "name": "Continuer tout droit sur {way_name:article}",
                    "destination": "Continuer tout droit en direction {destination:preposition}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Sortir du rond-point",
                    "name": "Sortir du rond-point sur {way_name:article}",
                    "destination": "Sortir du rond-point en direction {destination:preposition}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Sortir du rond-point",
                    "name": "Sortir du rond-point sur {way_name:article}",
                    "destination": "Sortir du rond-point en direction {destination:preposition}"
                }
            },
            "turn": {
                "default": {
                    "default": "Tourner {modifier}",
                    "name": "Tourner {modifier} sur {way_name:article}",
                    "destination": "Tourner {modifier} en direction {destination:preposition}"
                },
                "left": {
                    "default": "Tourner Ã  gauche",
                    "name": "Tourner Ã  gauche sur {way_name:article}",
                    "destination": "Tourner Ã  gauche en direction {destination:preposition}"
                },
                "right": {
                    "default": "Tourner Ã  droite",
                    "name": "Tourner Ã  droite sur {way_name:article}",
                    "destination": "Tourner Ã  droite en direction {destination:preposition}"
                },
                "straight": {
                    "default": "Aller tout droit",
                    "name": "Aller tout droit sur {way_name:article}",
                    "destination": "Aller tout droit en direction {destination:preposition}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Continuer tout droit"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],31:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "×¨××©×•× ×”",
                    "2": "×©× ×™×”",
                    "3": "×©×œ×™×©×™×ª",
                    "4": "×¨×‘×™×¢×™×ª",
                    "5": "×—×ž×™×©×™×ª",
                    "6": "×©×™×©×™×ª",
                    "7": "×©×‘×™×¢×™×ª",
                    "8": "×©×ž×™× ×™×ª",
                    "9": "×ª×©×™×¢×™×ª",
                    "10": "×¢×©×™×¨×™×ª"
                },
                "direction": {
                    "north": "×¦×¤×•×Ÿ",
                    "northeast": "×¦×¤×•×Ÿ ×ž×–×¨×—",
                    "east": "×ž×–×¨×—",
                    "southeast": "×“×¨×•× ×ž×–×¨×—",
                    "south": "×“×¨×•×",
                    "southwest": "×“×¨×•× ×ž×¢×¨×‘",
                    "west": "×ž×¢×¨×‘",
                    "northwest": "×¦×¤×•×Ÿ ×ž×¢×¨×‘"
                },
                "modifier": {
                    "left": "×©×ž××œ×”",
                    "right": "×™×ž×™× ×”",
                    "sharp left": "×—×“×” ×©×ž××œ×”",
                    "sharp right": "×—×“×” ×™×ž×™× ×”",
                    "slight left": "×§×œ×” ×©×ž××œ×”",
                    "slight right": "×§×œ×” ×™×ž×™× ×”",
                    "straight": "×™×©×¨",
                    "uturn": "×¤× ×™×™×ª ×¤×¨×¡×”"
                },
                "lanes": {
                    "xo": "×”×™×¦×ž×“ ×œ×™×ž×™×Ÿ",
                    "ox": "×”×™×¦×ž×“ ×œ×©×ž××œ",
                    "xox": "×”×ž×©×š ×‘× ×ª×™×‘ ×”××ž×¦×¢×™",
                    "oxo": "×”×™×¦×ž×“ ×œ×™×ž×™×Ÿ ××• ×œ×©×ž××œ"
                }
            },
            "modes": {
                "ferry": {
                    "default": "×¢×œ×” ×¢×œ ×”×ž×¢×‘×•×¨×ª",
                    "name": "×¢×œ×” ×¢×œ ×”×ž×¢×‘×•×¨×ª {way_name}",
                    "destination": "×¢×œ×” ×¢×œ ×”×ž×¢×‘×•×¨×ª ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, ×•××–, ×‘×¢×•×“{distance}, {instruction_two}",
                "two linked": "{instruction_one}, ×•××– {instruction_two}",
                "one in distance": "×‘×¢×•×“ {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "×™×¦×™××” {exit}"
            },
            "arrive": {
                "default": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name}"
                },
                "left": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×©×ž××œ×š"
                },
                "right": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×™×ž×™× ×š"
                },
                "sharp left": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×©×ž××œ×š"
                },
                "sharp right": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×™×ž×™× ×š"
                },
                "slight right": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×™×ž×™× ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×™×ž×™× ×š"
                },
                "slight left": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š ×ž×©×ž××œ×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name} ×©×œ×š ×ž×©×ž××œ×š"
                },
                "straight": {
                    "default": "×”×’×¢×ª ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š, ×‘×”×ž×©×š",
                    "upcoming": "××ª×” ×ª×’×™×¢ ××œ ×”×™×¢×“ ×”{nth} ×©×œ×š, ×‘×”×ž×©×š",
                    "short": "×”×’×¢×ª",
                    "short-upcoming": "×ª×’×™×¢",
                    "named": "×”×’×¢×ª ××œ {waypoint_name}, ×‘×”×ž×©×š"
                }
            },
            "continue": {
                "default": {
                    "default": "×¤× ×” {modifier}",
                    "name": "×¤× ×” {modifier} ×›×“×™ ×œ×”×™×©××¨ ×‘{way_name}",
                    "destination": "×¤× ×” {modifier} ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¤× ×” {modifier} ×¢×œ {way_name}"
                },
                "straight": {
                    "default": "×”×ž×©×š ×™×©×¨",
                    "name": "×”×ž×©×š ×™×©×¨ ×›×“×™ ×œ×”×™×©××¨ ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×œ×›×™×•×•×Ÿ {destination}",
                    "distance": "×”×ž×©×š ×™×©×¨ ×œ××•×¨×š {distance}",
                    "namedistance": "×”×ž×©×š ×¢×œ {way_name} ×œ××•×¨×š {distance}"
                },
                "sharp left": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×”",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×›×“×™ ×œ×”×™×©××¨ ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×”",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×›×“×™ ×œ×”×™×©××¨ ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×¤× ×” ×§×œ×•×ª ×©×ž××œ×”",
                    "name": "×¤× ×” ×§×œ×•×ª ×©×ž××œ×” ×›×“×™ ×œ×”×™×©××¨ ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×§×œ×•×ª ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×¤× ×” ×§×œ×•×ª ×™×ž×™× ×”",
                    "name": "×¤× ×” ×§×œ×•×ª ×™×ž×™× ×” ×›×“×™ ×œ×”×™×©××¨ ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×§×œ×•×ª ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×”",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×•×”×ž×©×š ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "×”×ª×›×•×•× ×Ÿ {direction}",
                    "name": "×”×ª×›×•×•× ×Ÿ {direction} ×¢×œ {way_name}",
                    "namedistance": "×”×ª×›×•×•× ×Ÿ {direction} ×¢×œ {way_name} ×œ××•×¨×š {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "×¤× ×” {modifier}",
                    "name": "×¤× ×” {modifier} ×¢×œ {way_name}",
                    "destination": "×¤× ×” {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "straight": {
                    "default": "×”×ž×©×š ×™×©×¨",
                    "name": "×”×ž×©×š ×™×©×¨ ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×™×©×¨ ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×‘×¡×•×£ ×”×“×¨×š",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×¢×œ {way_name} ×‘×¡×•×£ ×”×“×¨×š",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination} ×‘×¡×•×£ ×”×“×¨×š"
                }
            },
            "fork": {
                "default": {
                    "default": "×”×™×¦×ž×“ {modifier} ×‘×”×ª×¤×¦×œ×•×ª",
                    "name": "×”×™×¦×ž×“ {modifier} ×¢×œ {way_name}",
                    "destination": "×”×™×¦×ž×“ {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×”×™×¦×ž×“ ×œ×©×ž××œ ×‘×”×ª×¤×¦×œ×•×ª",
                    "name": "×”×™×¦×ž×“ ×œ×©×ž××œ ×¢×œ {way_name}",
                    "destination": "×”×™×¦×ž×“ ×œ×©×ž××œ ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×”×™×¦×ž×“ ×™×ž×™× ×” ×‘×”×ª×¤×¦×œ×•×ª",
                    "name": "×”×™×¦×ž×“ ×œ×™×ž×™×Ÿ ×¢×œ {way_name}",
                    "destination": "×”×™×¦×ž×“ ×œ×™×ž×™×Ÿ ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp left": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×‘×”×ª×¤×¦×œ×•×ª",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×‘×”×ª×¤×¦×œ×•×ª",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×”",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "×”×©×ª×œ×‘ {modifier}",
                    "name": "×”×©×ª×œ×‘ {modifier} ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "straight": {
                    "default": "×”×©×ª×œ×‘",
                    "name": "×”×©×ª×œ×‘ ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×”×©×ª×œ×‘ ×©×ž××œ×”",
                    "name": "×”×©×ª×œ×‘ ×©×ž××œ×” ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×”×©×ª×œ×‘ ×™×ž×™× ×”",
                    "name": "×”×©×ª×œ×‘ ×™×ž×™× ×” ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp left": {
                    "default": "×”×©×ª×œ×‘ ×©×ž××œ×”",
                    "name": "×”×©×ª×œ×‘ ×©×ž××œ×” ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×”×©×ª×œ×‘ ×™×ž×™× ×”",
                    "name": "×”×©×ª×œ×‘ ×™×ž×™× ×” ×¢×œ {way_name}",
                    "destination": "×”×©×ª×œ×‘ ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×”",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "×”×ž×©×š {modifier}",
                    "name": "×”×ž×©×š {modifier} ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "straight": {
                    "default": "×”×ž×©×š ×™×©×¨",
                    "name": "×”×ž×©×š ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp left": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×”",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×”",
                    "name": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×‘×—×“×•×ª ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×©×ž××œ×”",
                    "name": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×©×ž××œ×” ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×™×ž×™× ×”",
                    "name": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×™×ž×™× ×” ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×‘× ×˜×™×™×” ×§×œ×” ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×”",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "×”×ž×©×š {modifier}",
                    "name": "×”×ž×©×š {modifier} ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "uturn": {
                    "default": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×”",
                    "name": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×¢×œ {way_name}",
                    "destination": "×¤× ×” ×¤× ×™×™×ª ×¤×¨×¡×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "×¦× ×‘×™×¦×™××”",
                    "name": "×¦× ×‘×™×¦×™××” ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit}",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×‘×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×‘×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}",
                    "exit": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š",
                    "exit_destination": "×¦× ×‘×™×¦×™××” {exit} ×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "×¦× ×‘×™×¦×™××”",
                    "name": "×¦× ×‘×™×¦×™××” ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×‘×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×‘×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "sharp right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight left": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×‘×©×ž××œ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×©×ž××œ×š ×œ×›×™×•×•×Ÿ {destination}"
                },
                "slight right": {
                    "default": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š",
                    "name": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×¢×œ {way_name}",
                    "destination": "×¦× ×‘×™×¦×™××” ×©×ž×™×ž×™× ×š ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×”",
                        "name": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×¢×œ {way_name}",
                        "destination": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×œ×›×™×•×•×Ÿ {destination}"
                    },
                    "name": {
                        "default": "×”×™×›× ×¡ ×œ{rotary_name}",
                        "name": "×”×™×›× ×¡ ×œ{rotary_name} ×•×¦× ×¢×œ {way_name}",
                        "destination": "×”×™×›× ×¡ ×œ{rotary_name} ×•×¦× ×œ×›×™×•×•×Ÿ {destination}"
                    },
                    "exit": {
                        "default": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number}",
                        "name": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number} ×œ{way_name}",
                        "destination": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number} ×œ×›×™×•×•×Ÿ {destination}"
                    },
                    "name_exit": {
                        "default": "×”×™×›× ×¡ ×œ{rotary_name} ×•×¦× ×‘×™×¦×™××” ×”{exit_number}",
                        "name": "×”×™×›× ×¡ ×œ{rotary_name} ×•×¦× ×‘×™×¦×™××” ×”{exit_number} ×œ{way_name}",
                        "destination": "×”×™×›× ×¡ ×œ{rotary_name} ×•×¦× ×‘×™×¦×™××” ×”{exit_number} ×œ×›×™×•×•×Ÿ {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number}",
                        "name": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number} ×œ{way_name}",
                        "destination": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×‘×™×¦×™××” {exit_number} ×œ×›×™×•×•×Ÿ {destination}"
                    },
                    "default": {
                        "default": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×”",
                        "name": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×¢×œ {way_name}",
                        "destination": "×”×©×ª×œ×‘ ×‘×ž×¢×’×œ ×”×ª× ×•×¢×” ×•×¦× ×œ×›×™×•×•×Ÿ {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "×¤× ×” {modifier}",
                    "name": "×¤× ×” {modifier} ×¢×œ {way_name}",
                    "destination": "×¤× ×” {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "left": {
                    "default": "×¤× ×” ×©×ž××œ×”",
                    "name": "×¤× ×” ×©×ž××œ×” ×œ{way_name}",
                    "destination": "×¤× ×” ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "right": {
                    "default": "×¤× ×” ×™×ž×™× ×”",
                    "name": "×¤× ×” ×™×ž×™× ×” ×œ{way_name}",
                    "destination": "×¤× ×” ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "straight": {
                    "default": "×”×ž×©×š ×™×©×¨",
                    "name": "×”×ž×©×š ×™×©×¨ ×¢×œ {way_name}",
                    "destination": "×”×ž×©×š ×™×©×¨ ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×”",
                    "name": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×” ×œ{way_name}",
                    "destination": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×”",
                    "name": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×” ×œ{way_name}",
                    "destination": "×¦× ×ž×ž×¢×’×œ ×”×ª× ×•×¢×” ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "×¤× ×” {modifier}",
                    "name": "×¤× ×” {modifier} ×¢×œ {way_name}",
                    "destination": "×¤× ×” {modifier} ×œ×›×™×•×•×Ÿ {destination}"
                },
                "left": {
                    "default": "×¤× ×” ×©×ž××œ×”",
                    "name": "×¤× ×” ×©×ž××œ×” ×œ{way_name}",
                    "destination": "×¤× ×” ×©×ž××œ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "right": {
                    "default": "×¤× ×” ×™×ž×™× ×”",
                    "name": "×¤× ×” ×™×ž×™× ×” ×œ{way_name}",
                    "destination": "×¤× ×” ×™×ž×™× ×” ×œ×›×™×•×•×Ÿ {destination}"
                },
                "straight": {
                    "default": "×”×ž×©×š ×™×©×¨",
                    "name": "×”×ž×©×š ×™×©×¨ ×œ{way_name}",
                    "destination": "×”×ž×©×š ×™×©×¨ ×œ×›×™×•×•×Ÿ {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "×”×ž×©×š ×™×©×¨"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],32:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1",
                    "2": "2",
                    "3": "3",
                    "4": "4",
                    "5": "5",
                    "6": "6",
                    "7": "7",
                    "8": "8",
                    "9": "9",
                    "10": "10"
                },
                "direction": {
                    "north": "utara",
                    "northeast": "timur laut",
                    "east": "timur",
                    "southeast": "tenggara",
                    "south": "selatan",
                    "southwest": "barat daya",
                    "west": "barat",
                    "northwest": "barat laut"
                },
                "modifier": {
                    "left": "kiri",
                    "right": "kanan",
                    "sharp left": "tajam kiri",
                    "sharp right": "tajam kanan",
                    "slight left": "agak ke kiri",
                    "slight right": "agak ke kanan",
                    "straight": "lurus",
                    "uturn": "putar balik"
                },
                "lanes": {
                    "xo": "Tetap di kanan",
                    "ox": "Tetap di kiri",
                    "xox": "Tetap di tengah",
                    "oxo": "Tetap di kiri atau kanan"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Naik ferry",
                    "name": "Naik ferry di {way_name}",
                    "destination": "Naik ferry menuju {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, then, in {distance}, {instruction_two}",
                "two linked": "{instruction_one}, then {instruction_two}",
                "one in distance": "In {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Anda telah tiba di tujuan ke-{nth}",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}"
                },
                "left": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kiri"
                },
                "right": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kanan"
                },
                "sharp left": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kiri"
                },
                "sharp right": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kanan"
                },
                "slight right": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kanan",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kanan"
                },
                "slight left": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, di sebelah kiri",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, di sebelah kiri"
                },
                "straight": {
                    "default": "Anda telah tiba di tujuan ke-{nth}, lurus saja",
                    "upcoming": "Anda telah tiba di tujuan ke-{nth}, lurus saja",
                    "short": "Anda telah tiba di tujuan ke-{nth}",
                    "short-upcoming": "Anda telah tiba di tujuan ke-{nth}",
                    "named": "Anda telah tiba di {waypoint_name}, lurus saja"
                }
            },
            "continue": {
                "default": {
                    "default": "Belok {modifier}",
                    "name": "Terus {modifier} ke {way_name}",
                    "destination": "Belok {modifier} menuju {destination}",
                    "exit": "Belok {modifier} ke {way_name}"
                },
                "straight": {
                    "default": "Lurus terus",
                    "name": "Terus ke {way_name}",
                    "destination": "Terus menuju {destination}",
                    "distance": "Continue straight for {distance}",
                    "namedistance": "Continue on {way_name} for {distance}"
                },
                "sharp left": {
                    "default": "Belok kiri tajam",
                    "name": "Make a sharp left to stay on {way_name}",
                    "destination": "Belok kiri tajam menuju {destination}"
                },
                "sharp right": {
                    "default": "Belok kanan tajam",
                    "name": "Make a sharp right to stay on {way_name}",
                    "destination": "Belok kanan tajam menuju {destination}"
                },
                "slight left": {
                    "default": "Tetap agak di kiri",
                    "name": "Tetap agak di kiri ke {way_name}",
                    "destination": "Tetap agak di kiri menuju {destination}"
                },
                "slight right": {
                    "default": "Tetap agak di kanan",
                    "name": "Tetap agak di kanan ke {way_name}",
                    "destination": "Tetap agak di kanan menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik",
                    "name": "Putar balik ke arah {way_name}",
                    "destination": "Putar balik menuju {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Arah {direction}",
                    "name": "Arah {direction} di {way_name}",
                    "namedistance": "Head {direction} on {way_name} for {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Belok {modifier}",
                    "name": "Belok {modifier} ke {way_name}",
                    "destination": "Belok {modifier} menuju {destination}"
                },
                "straight": {
                    "default": "Lurus terus",
                    "name": "Tetap lurus ke {way_name} ",
                    "destination": "Tetap lurus menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik di akhir jalan",
                    "name": "Putar balik di {way_name} di akhir jalan",
                    "destination": "Putar balik menuju {destination} di akhir jalan"
                }
            },
            "fork": {
                "default": {
                    "default": "Tetap {modifier} di pertigaan",
                    "name": "Tetap {modifier} di pertigaan ke {way_name}",
                    "destination": "Tetap {modifier} di pertigaan menuju {destination}"
                },
                "slight left": {
                    "default": "Tetap di kiri pada pertigaan",
                    "name": "Tetap di kiri pada pertigaan ke arah {way_name}",
                    "destination": "Tetap di kiri pada pertigaan menuju {destination}"
                },
                "slight right": {
                    "default": "Tetap di kanan pada pertigaan",
                    "name": "Tetap di kanan pada pertigaan ke arah {way_name}",
                    "destination": "Tetap di kanan pada pertigaan menuju {destination}"
                },
                "sharp left": {
                    "default": "Belok kiri pada pertigaan",
                    "name": "Belok kiri tajam ke arah {way_name}",
                    "destination": "Belok kiri tajam menuju {destination}"
                },
                "sharp right": {
                    "default": "Belok kanan pada pertigaan",
                    "name": "Belok kanan tajam ke arah {way_name}",
                    "destination": "Belok kanan tajam menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik",
                    "name": "Putar balik ke arah {way_name}",
                    "destination": "Putar balik menuju {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Bergabung {modifier}",
                    "name": "Bergabung {modifier} ke arah {way_name}",
                    "destination": "Bergabung {modifier} menuju {destination}"
                },
                "straight": {
                    "default": "Bergabung lurus",
                    "name": "Bergabung lurus ke arah {way_name}",
                    "destination": "Bergabung lurus menuju {destination}"
                },
                "slight left": {
                    "default": "Bergabung di kiri",
                    "name": "Bergabung di kiri ke arah {way_name}",
                    "destination": "Bergabung di kiri menuju {destination}"
                },
                "slight right": {
                    "default": "Bergabung di kanan",
                    "name": "Bergabung di kanan ke arah {way_name}",
                    "destination": "Bergabung di kanan menuju {destination}"
                },
                "sharp left": {
                    "default": "Bergabung di kiri",
                    "name": "Bergabung di kiri ke arah {way_name}",
                    "destination": "Bergabung di kiri menuju {destination}"
                },
                "sharp right": {
                    "default": "Bergabung di kanan",
                    "name": "Bergabung di kanan ke arah {way_name}",
                    "destination": "Bergabung di kanan menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik",
                    "name": "Putar balik ke arah {way_name}",
                    "destination": "Putar balik menuju {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Lanjutkan {modifier}",
                    "name": "Lanjutkan {modifier} menuju {way_name}",
                    "destination": "Lanjutkan {modifier} menuju {destination}"
                },
                "straight": {
                    "default": "Lurus terus",
                    "name": "Terus ke {way_name}",
                    "destination": "Terus menuju {destination}"
                },
                "sharp left": {
                    "default": "Belok kiri tajam",
                    "name": "Belok kiri tajam ke arah {way_name}",
                    "destination": "Belok kiri tajam menuju {destination}"
                },
                "sharp right": {
                    "default": "Belok kanan tajam",
                    "name": "Belok kanan tajam ke arah {way_name}",
                    "destination": "Belok kanan tajam menuju {destination}"
                },
                "slight left": {
                    "default": "Lanjut dengan agak ke kiri",
                    "name": "Lanjut dengan agak di kiri ke {way_name}",
                    "destination": "Tetap agak di kiri menuju {destination}"
                },
                "slight right": {
                    "default": "Tetap agak di kanan",
                    "name": "Tetap agak di kanan ke {way_name}",
                    "destination": "Tetap agak di kanan menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik",
                    "name": "Putar balik ke arah {way_name}",
                    "destination": "Putar balik menuju {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Lanjutkan {modifier}",
                    "name": "Lanjutkan {modifier} menuju {way_name}",
                    "destination": "Lanjutkan {modifier} menuju {destination}"
                },
                "uturn": {
                    "default": "Putar balik",
                    "name": "Putar balik ke arah {way_name}",
                    "destination": "Putar balik menuju {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ambil jalan melandai",
                    "name": "Ambil jalan melandai ke {way_name}",
                    "destination": "Ambil jalan melandai menuju {destination}",
                    "exit": "Take exit {exit}",
                    "exit_destination": "Take exit {exit} towards {destination}"
                },
                "left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan menuju {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                },
                "sharp left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "sharp right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan menuju {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                },
                "slight left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}",
                    "exit": "Take exit {exit} on the left",
                    "exit_destination": "Take exit {exit} on the left towards {destination}"
                },
                "slight right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan  menuju {destination}",
                    "exit": "Take exit {exit} on the right",
                    "exit_destination": "Take exit {exit} on the right towards {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Ambil jalan melandai",
                    "name": "Ambil jalan melandai ke {way_name}",
                    "destination": "Ambil jalan melandai menuju {destination}"
                },
                "left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}"
                },
                "right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan  menuju {destination}"
                },
                "sharp left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}"
                },
                "sharp right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan  menuju {destination}"
                },
                "slight left": {
                    "default": "Ambil jalan yang melandai di sebelah kiri",
                    "name": "Ambil jalan melandai di sebelah kiri ke arah {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kiri menuju {destination}"
                },
                "slight right": {
                    "default": "Ambil jalan melandai di sebelah kanan",
                    "name": "Ambil jalan melandai di sebelah kanan ke {way_name}",
                    "destination": "Ambil jalan melandai di sebelah kanan  menuju {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Masuk bundaran",
                        "name": "Masuk bundaran dan keluar arah {way_name}",
                        "destination": "Masuk bundaran dan keluar menuju {destination}"
                    },
                    "name": {
                        "default": "Masuk {rotary_name}",
                        "name": "Masuk {rotary_name} dan keluar arah {way_name}",
                        "destination": "Masuk {rotary_name} dan keluar menuju {destination}"
                    },
                    "exit": {
                        "default": "Masuk bundaran dan ambil jalan keluar {exit_number}",
                        "name": "Masuk bundaran dan ambil jalan keluar {exit_number} arah {way_name}",
                        "destination": "Masuk bundaran dan ambil jalan keluar {exit_number} menuju {destination}"
                    },
                    "name_exit": {
                        "default": "Masuk {rotary_name} dan ambil jalan keluar {exit_number}",
                        "name": "Masuk {rotary_name} dan ambil jalan keluar {exit_number} arah {way_name}",
                        "destination": "Masuk {rotary_name} dan ambil jalan keluar {exit_number} menuju {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Masuk bundaran dan ambil jalan keluar {exit_number}",
                        "name": "Masuk bundaran dan ambil jalan keluar {exit_number} arah {way_name}",
                        "destination": "Masuk bundaran dan ambil jalan keluar {exit_number} menuju {destination}"
                    },
                    "default": {
                        "default": "Masuk bundaran",
                        "name": "Masuk bundaran dan keluar arah {way_name}",
                        "destination": "Masuk bundaran dan keluar menuju {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Lakukan {modifier}",
                    "name": "Lakukan {modifier} ke arah {way_name}",
                    "destination": "Lakukan {modifier} menuju {destination}"
                },
                "left": {
                    "default": "Belok kiri",
                    "name": "Belok kiri ke {way_name}",
                    "destination": "Belok kiri menuju {destination}"
                },
                "right": {
                    "default": "Belok kanan",
                    "name": "Belok kanan ke {way_name}",
                    "destination": "Belok kanan menuju {destination}"
                },
                "straight": {
                    "default": "Lurus terus",
                    "name": "Tetap lurus ke {way_name} ",
                    "destination": "Tetap lurus menuju {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Lakukan {modifier}",
                    "name": "Lakukan {modifier} ke arah {way_name}",
                    "destination": "Lakukan {modifier} menuju {destination}"
                },
                "left": {
                    "default": "Belok kiri",
                    "name": "Belok kiri ke {way_name}",
                    "destination": "Belok kiri menuju {destination}"
                },
                "right": {
                    "default": "Belok kanan",
                    "name": "Belok kanan ke {way_name}",
                    "destination": "Belok kanan menuju {destination}"
                },
                "straight": {
                    "default": "Lurus terus",
                    "name": "Tetap lurus ke {way_name} ",
                    "destination": "Tetap lurus menuju {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Lakukan {modifier}",
                    "name": "Lakukan {modifier} ke arah {way_name}",
                    "destination": "Lakukan {modifier} menuju {destination}"
                },
                "left": {
                    "default": "Belok kiri",
                    "name": "Belok kiri ke {way_name}",
                    "destination": "Belok kiri menuju {destination}"
                },
                "right": {
                    "default": "Belok kanan",
                    "name": "Belok kanan ke {way_name}",
                    "destination": "Belok kanan menuju {destination}"
                },
                "straight": {
                    "default": "Lurus",
                    "name": "Lurus arah {way_name}",
                    "destination": "Lurus menuju {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Lakukan {modifier}",
                    "name": "Lakukan {modifier} ke arah {way_name}",
                    "destination": "Lakukan {modifier} menuju {destination}"
                },
                "left": {
                    "default": "Belok kiri",
                    "name": "Belok kiri ke {way_name}",
                    "destination": "Belok kiri menuju {destination}"
                },
                "right": {
                    "default": "Belok kanan",
                    "name": "Belok kanan ke {way_name}",
                    "destination": "Belok kanan menuju {destination}"
                },
                "straight": {
                    "default": "Lurus",
                    "name": "Lurus arah {way_name}",
                    "destination": "Lurus menuju {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Lurus terus"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],33:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Âª",
                    "2": "2Âª",
                    "3": "3Âª",
                    "4": "4Âª",
                    "5": "5Âª",
                    "6": "6Âª",
                    "7": "7Âª",
                    "8": "8Âª",
                    "9": "9Âª",
                    "10": "10Âª"
                },
                "direction": {
                    "north": "nord",
                    "northeast": "nord-est",
                    "east": "est",
                    "southeast": "sud-est",
                    "south": "sud",
                    "southwest": "sud-ovest",
                    "west": "ovest",
                    "northwest": "nord-ovest"
                },
                "modifier": {
                    "left": "sinistra",
                    "right": "destra",
                    "sharp left": "sinistra",
                    "sharp right": "destra",
                    "slight left": "sinistra leggermente",
                    "slight right": "destra leggermente",
                    "straight": "dritto",
                    "uturn": "inversione a U"
                },
                "lanes": {
                    "xo": "Mantieni la destra",
                    "ox": "Mantieni la sinistra",
                    "xox": "Rimani in mezzo",
                    "oxo": "Mantieni la destra o la sinistra"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Prendi il traghetto",
                    "name": "Prendi il traghetto {way_name}",
                    "destination": "Prendi il traghetto verso {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, poi tra {distance},{instruction_two}",
                "two linked": "{instruction_one}, poi {instruction_two}",
                "one in distance": "tra {distance} {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Sei arrivato alla tua {nth} destinazione",
                    "upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "Sei arrivato a {waypoint_name}"
                },
                "left": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla sinistra"
                },
                "right": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla destra"
                },
                "sharp left": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla sinistra"
                },
                "sharp right": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla destra"
                },
                "slight right": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla destra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla destra"
                },
                "slight left": {
                    "default": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, sulla sinistra",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, sulla sinistra"
                },
                "straight": {
                    "default": "sei arrivato alla tua {nth} destinazione, si trova davanti a te",
                    "upcoming": "sei arrivato alla tua {nth} destinazione, si trova davanti a te",
                    "short": "Sei arrivato alla tua {nth} destinazione",
                    "short-upcoming": "Sei arrivato alla tua {nth} destinazione",
                    "named": "sei arrivato a {waypoint_name}, si trova davanti a te"
                }
            },
            "continue": {
                "default": {
                    "default": "Gira a {modifier}",
                    "name": "Gira a {modifier} per stare su {way_name}",
                    "destination": "Gira a {modifier} verso {destination}",
                    "exit": "Gira a {modifier} in {way_name}"
                },
                "straight": {
                    "default": "Continua dritto",
                    "name": "Continua dritto per stare su {way_name}",
                    "destination": "Continua verso {destination}",
                    "distance": "Continua dritto per {distance}",
                    "namedistance": "Continua su {way_name} per {distance}"
                },
                "sharp left": {
                    "default": "Svolta a sinistra",
                    "name": "Fai una stretta curva a sinistra per stare su {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Svolta a destra",
                    "name": "Fau una stretta curva a destra per stare su {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "slight left": {
                    "default": "Fai una leggera curva a sinistra",
                    "name": "Fai una leggera curva a sinistra per stare su {way_name}",
                    "destination": "Fai una leggera curva a sinistra verso {destination}"
                },
                "slight right": {
                    "default": "Fai una leggera curva a destra",
                    "name": "Fai una leggera curva a destra per stare su {way_name}",
                    "destination": "Fai una leggera curva a destra verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U",
                    "name": "Fai un'inversione ad U poi continua su {way_name}",
                    "destination": "Fai un'inversione a U verso {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Continua verso {direction}",
                    "name": "Continua verso {direction} in {way_name}",
                    "namedistance": "Head {direction} on {way_name} for {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Gira a {modifier}",
                    "name": "Gira a {modifier} in {way_name}",
                    "destination": "Gira a {modifier} verso {destination}"
                },
                "straight": {
                    "default": "Continua dritto",
                    "name": "Continua dritto in {way_name}",
                    "destination": "Continua dritto verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U alla fine della strada",
                    "name": "Fai un'inversione a U in {way_name} alla fine della strada",
                    "destination": "Fai un'inversione a U verso {destination} alla fine della strada"
                }
            },
            "fork": {
                "default": {
                    "default": "Mantieni la {modifier} al bivio",
                    "name": "Mantieni la {modifier} al bivio in {way_name}",
                    "destination": "Mantieni la {modifier} al bivio verso {destination}"
                },
                "slight left": {
                    "default": "Mantieni la sinistra al bivio",
                    "name": "Mantieni la sinistra al bivio in {way_name}",
                    "destination": "Mantieni la sinistra al bivio verso {destination}"
                },
                "slight right": {
                    "default": "Mantieni la destra al bivio",
                    "name": "Mantieni la destra al bivio in {way_name}",
                    "destination": "Mantieni la destra al bivio verso {destination}"
                },
                "sharp left": {
                    "default": "Svolta a sinistra al bivio",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Svolta a destra al bivio",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U",
                    "name": "Fai un'inversione a U in {way_name}",
                    "destination": "Fai un'inversione a U verso {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Immettiti a {modifier}",
                    "name": "Immettiti {modifier} in {way_name}",
                    "destination": "Immettiti {modifier} verso {destination}"
                },
                "straight": {
                    "default": "Immettiti a dritto",
                    "name": "Immettiti dritto in {way_name}",
                    "destination": "Immettiti dritto verso {destination}"
                },
                "slight left": {
                    "default": "Immettiti a sinistra",
                    "name": "Immettiti a sinistra in {way_name}",
                    "destination": "Immettiti a sinistra verso {destination}"
                },
                "slight right": {
                    "default": "Immettiti a destra",
                    "name": "Immettiti a destra in {way_name}",
                    "destination": "Immettiti a destra verso {destination}"
                },
                "sharp left": {
                    "default": "Immettiti a sinistra",
                    "name": "Immettiti a sinistra in {way_name}",
                    "destination": "Immettiti a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Immettiti a destra",
                    "name": "Immettiti a destra in {way_name}",
                    "destination": "Immettiti a destra verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U",
                    "name": "Fai un'inversione a U in {way_name}",
                    "destination": "Fai un'inversione a U verso {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Continua a {modifier}",
                    "name": "Continua a {modifier} in {way_name}",
                    "destination": "Continua a {modifier} verso {destination}"
                },
                "straight": {
                    "default": "Continua dritto",
                    "name": "Continua in {way_name}",
                    "destination": "Continua verso {destination}"
                },
                "sharp left": {
                    "default": "Svolta a sinistra",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Svolta a destra",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "slight left": {
                    "default": "Continua leggermente a sinistra",
                    "name": "Continua leggermente a sinistra in {way_name}",
                    "destination": "Continua leggermente a sinistra verso {destination}"
                },
                "slight right": {
                    "default": "Continua leggermente a destra",
                    "name": "Continua leggermente a destra in {way_name} ",
                    "destination": "Continua leggermente a destra verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U",
                    "name": "Fai un'inversione a U in {way_name}",
                    "destination": "Fai un'inversione a U verso {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Continua a {modifier}",
                    "name": "Continua a {modifier} in {way_name}",
                    "destination": "Continua a {modifier} verso {destination}"
                },
                "uturn": {
                    "default": "Fai un'inversione a U",
                    "name": "Fai un'inversione a U in {way_name}",
                    "destination": "Fai un'inversione a U verso {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Prendi la rampa",
                    "name": "Prendi la rampa in {way_name}",
                    "destination": "Prendi la rampa verso {destination}",
                    "exit": "Prendi l'uscita {exit}",
                    "exit_destination": "Prendi l'uscita  {exit} verso {destination}"
                },
                "left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}",
                    "exit": "Prendi l'uscita {exit} a sinistra",
                    "exit_destination": "Prendi la {exit}  uscita a sinistra verso {destination}"
                },
                "right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}",
                    "exit": "Prendi la {exit} uscita a destra",
                    "exit_destination": "Prendi la {exit} uscita a destra verso {destination}"
                },
                "sharp left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}",
                    "exit": "Prendi l'uscita {exit} a sinistra",
                    "exit_destination": "Prendi la {exit}  uscita a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}",
                    "exit": "Prendi la {exit} uscita a destra",
                    "exit_destination": "Prendi la {exit} uscita a destra verso {destination}"
                },
                "slight left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}",
                    "exit": "Prendi l'uscita {exit} a sinistra",
                    "exit_destination": "Prendi la {exit}  uscita a sinistra verso {destination}"
                },
                "slight right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}",
                    "exit": "Prendi la {exit} uscita a destra",
                    "exit_destination": "Prendi la {exit} uscita a destra verso {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Prendi la rampa",
                    "name": "Prendi la rampa in {way_name}",
                    "destination": "Prendi la rampa verso {destination}"
                },
                "left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}"
                },
                "right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}"
                },
                "sharp left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}"
                },
                "sharp right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}"
                },
                "slight left": {
                    "default": "Prendi la rampa a sinistra",
                    "name": "Prendi la rampa a sinistra in {way_name}",
                    "destination": "Prendi la rampa a sinistra verso {destination}"
                },
                "slight right": {
                    "default": "Prendi la rampa a destra",
                    "name": "Prendi la rampa a destra in {way_name}",
                    "destination": "Prendi la rampa a destra verso {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Immettiti nella rotonda",
                        "name": "Immettiti nella ritonda ed esci in {way_name}",
                        "destination": "Immettiti nella ritonda ed esci verso {destination}"
                    },
                    "name": {
                        "default": "Immettiti in {rotary_name}",
                        "name": "Immettiti in {rotary_name} ed esci su {way_name}",
                        "destination": "Immettiti in {rotary_name} ed esci verso {destination}"
                    },
                    "exit": {
                        "default": "Immettiti nella rotonda e prendi la {exit_number} uscita",
                        "name": "Immettiti nella rotonda e prendi la {exit_number} uscita in {way_name}",
                        "destination": "Immettiti nella rotonda e prendi la {exit_number} uscita verso   {destination}"
                    },
                    "name_exit": {
                        "default": "Immettiti in {rotary_name} e prendi la {exit_number} uscita",
                        "name": "Immettiti in {rotary_name} e prendi la {exit_number} uscita in {way_name}",
                        "destination": "Immettiti in {rotary_name} e prendi la {exit_number}  uscita verso {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Immettiti nella rotonda e prendi la {exit_number} uscita",
                        "name": "Immettiti nella rotonda e prendi la {exit_number} uscita in {way_name}",
                        "destination": "Immettiti nella rotonda e prendi la {exit_number} uscita verso {destination}"
                    },
                    "default": {
                        "default": "Entra nella rotonda",
                        "name": "Entra nella rotonda e prendi l'uscita in {way_name}",
                        "destination": "Entra nella rotonda e prendi l'uscita verso {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Fai una {modifier}",
                    "name": "Fai una {modifier} in {way_name}",
                    "destination": "Fai una {modifier} verso {destination}"
                },
                "left": {
                    "default": "Svolta a sinistra",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "right": {
                    "default": "Gira a destra",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "straight": {
                    "default": "Continua dritto",
                    "name": "Continua dritto in {way_name}",
                    "destination": "Continua dritto verso {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Fai una {modifier}",
                    "name": "Fai una {modifier} in {way_name}",
                    "destination": "Fai una {modifier} verso {destination}"
                },
                "left": {
                    "default": "Svolta a sinistra",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "right": {
                    "default": "Gira a destra",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "straight": {
                    "default": "Continua dritto",
                    "name": "Continua dritto in {way_name}",
                    "destination": "Continua dritto verso {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Fai una {modifier}",
                    "name": "Fai una {modifier} in {way_name}",
                    "destination": "Fai una {modifier} verso {destination}"
                },
                "left": {
                    "default": "Svolta a sinistra",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "right": {
                    "default": "Gira a destra",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "straight": {
                    "default": "Prosegui dritto",
                    "name": "Continua su {way_name}",
                    "destination": "Continua verso {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Fai una {modifier}",
                    "name": "Fai una {modifier} in {way_name}",
                    "destination": "Fai una {modifier} verso {destination}"
                },
                "left": {
                    "default": "Svolta a sinistra",
                    "name": "Svolta a sinistra in {way_name}",
                    "destination": "Svolta a sinistra verso {destination}"
                },
                "right": {
                    "default": "Gira a destra",
                    "name": "Svolta a destra in {way_name}",
                    "destination": "Svolta a destra verso {destination}"
                },
                "straight": {
                    "default": "Prosegui dritto",
                    "name": "Continua su {way_name}",
                    "destination": "Continua verso {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Continua dritto"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],34:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": false
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "ì²«ë²ˆì©¨",
                    "2": "ë‘ë²ˆì§¸",
                    "3": "ì„¸ë²ˆì§¸",
                    "4": "ë„¤ë²ˆì©¨",
                    "5": "ë‹¤ì„¯ë²ˆì§¸",
                    "6": "ì—¬ì„¯ë²ˆì§¸",
                    "7": "ì¼ê³±ë²ˆì§¸",
                    "8": "ì—¬ëŸë²ˆì§¸",
                    "9": "ì•„í™‰ë²ˆì§¸",
                    "10": "ì—´ë²ˆì§¸"
                },
                "direction": {
                    "north": "ë¶ìª½",
                    "northeast": "ë¶ë™ìª½",
                    "east": "ë™ìª½",
                    "southeast": "ë‚¨ë™ìª½",
                    "south": "ë‚¨ìª½",
                    "southwest": "ë‚¨ì„œìª½",
                    "west": "ì„œìª½",
                    "northwest": "ë¶ì„œìª½"
                },
                "modifier": {
                    "left": "ì¢ŒíšŒì „",
                    "right": "ìš°íšŒì „",
                    "sharp left": "ë°”ë¡œì¢ŒíšŒì „",
                    "sharp right": "ë°”ë¡œìš°íšŒì „",
                    "slight left": "ì¡°ê¸ˆì™¼ìª½",
                    "slight right": "ì¡°ê¸ˆì˜¤ë¥¸ìª½",
                    "straight": "ì§ì§„",
                    "uturn": "ìœ í„´"
                },
                "lanes": {
                    "xo": "ìš°ì¸¡ì°¨ì„  ìœ ì§€",
                    "ox": "ì¢Œì¸¡ì°¨ì„  ìœ ì§€",
                    "xox": "ì¤‘ì•™ìœ ì§€",
                    "oxo": "ê³„ì† ì¢Œì¸¡ ë˜ëŠ” ìš°ì¸¡ ì°¨ì„ "
                }
            },
            "modes": {
                "ferry": {
                    "default": "íŽ˜ë¦¬ë¥¼ íƒ€ì‹œì˜¤",
                    "name": "íŽ˜ë¦¬ë¥¼ íƒ€ì‹œì˜¤ {way_name}",
                    "destination": "íŽ˜ë¦¬ë¥¼ íƒ€ê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, ê·¸ë¦¬ê³ , {distance} ì•ˆì—, {instruction_two}",
                "two linked": "{instruction_one}, ê·¸ë¦¬ê³  {instruction_two}",
                "one in distance": "{distance} ë‚´ì—, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "{exit}ë²ˆìœ¼ë¡œ ë‚˜ê°€ì„¸ìš”."
            },
            "arrive": {
                "default": {
                    "default": " {nth}ëª©ì ì§€ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤.",
                    "upcoming": "{nth}ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "left": {
                    "default": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ì¢Œì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "right": {
                    "default": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ìš°ì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "sharp left": {
                    "default": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ì¢Œì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "sharp right": {
                    "default": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ìš°ì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "slight right": {
                    "default": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ìš°ì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ìš°ì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "slight left": {
                    "default": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ì¢Œì¸¡ì— {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ì¢Œì¸¡ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                },
                "straight": {
                    "default": "ë°”ë¡œ ì•žì— {nth} ëª©ì ì§€ê°€ ìžˆìŠµë‹ˆë‹¤.",
                    "upcoming": "ì§ì§„í•˜ì‹œë©´ {nth} ëª©ì ì§€ì— ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "short": "ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤",
                    "short-upcoming": "ëª©ì ì§€ì— ê³§ ë„ì°©í•  ì˜ˆì •ìž…ë‹ˆë‹¤.",
                    "named": "ì •ë©´ì— ê²½ìœ ì§€ {waypoint_name}ì— ë„ì°©í•˜ì˜€ìŠµë‹ˆë‹¤."
                }
            },
            "continue": {
                "default": {
                    "default": "{modifier} íšŒì „",
                    "name": "{modifier} íšŒì „í•˜ê³  {way_name}ë¡œ ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "destination": "{modifier} íšŒì „í•˜ê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{way_name} ìª½ìœ¼ë¡œ {modifier} íšŒì „ í•˜ì„¸ìš”."
                },
                "straight": {
                    "default": "ê³„ì† ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "name": "{way_name} ë¡œ ê³„ì† ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "destination": "{destination}ê¹Œì§€ ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "distance": "{distance}ê¹Œì§€ ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "namedistance": "{distance}ê¹Œì§€ {way_name}ë¡œ ê°€ì£¼ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ê¸‰ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ì¢ŒíšŒì „ í•˜ì‹  í›„ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ì¢ŒíšŒì „ í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ê¸‰ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ìš°íšŒì „ í•˜ê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ìš°íšŒì „ í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "slight left": {
                    "default": "ì•½ê°„ ì¢ŒíšŒì „í•˜ì„¸ìš”.",
                    "name": "ì•½ê°„ ì¢ŒíšŒì „ í•˜ê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì•½ê°„ ì¢ŒíšŒì „ í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ì•½ê°„ ìš°íšŒì „í•˜ì„¸ìš”.",
                    "name": "ì•½ê°„ ìš°íšŒì „ í•˜ê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì•½ê°„ ìš°íšŒì „ í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "uturn": {
                    "default": "ìœ í„´ í•˜ì„¸ìš”",
                    "name": "ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìœ í„´í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                }
            },
            "depart": {
                "default": {
                    "default": "{direction}ë¡œ ê°€ì„¸ìš”",
                    "name": "{direction} ë¡œ ê°€ì„œ {way_name} ë¥¼ ì´ìš©í•˜ì„¸ìš”. ",
                    "namedistance": "{direction}ë¡œ ê°€ì„œ{way_name} ë¥¼ {distance}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "end of road": {
                "default": {
                    "default": "{modifier} íšŒì „í•˜ì„¸ìš”.",
                    "name": "{modifier}íšŒì „í•˜ê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier}íšŒì „ í•˜ì‹  í›„ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "straight": {
                    "default": "ê³„ì† ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "name": "{way_name}ë¡œ ê³„ì† ì§ì§„í•´ ì£¼ì„¸ìš”.",
                    "destination": "{destination}ê¹Œì§€ ì§ì§„í•´ ì£¼ì„¸ìš”."
                },
                "uturn": {
                    "default": "ë„ë¡œ ëê¹Œì§€ ê°€ì„œ ìœ í„´í•´ ì£¼ì„¸ìš”.",
                    "name": "ë„ë¡œ ëê¹Œì§€ ê°€ì„œ ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ë„ë¡œ ëê¹Œì§€ ê°€ì„œ ìœ í„´í•´ì„œ {destination} ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "fork": {
                "default": {
                    "default": "ê°ˆë¦¼ê¸¸ì—ì„œ {modifier} ìœ¼ë¡œ ê°€ì„¸ìš”.",
                    "name": "{modifier}í•˜ê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier}í•˜ê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight left": {
                    "default": "ê°ˆë¦¼ê¸¸ì—ì„œ ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ì¢ŒíšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì¢ŒíšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ê°ˆë¦¼ê¸¸ì—ì„œ ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ìš°íšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìš°íšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ê°ˆë¦¼ê¸¸ì—ì„œ ê¸‰ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ì¢ŒíšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ì¢ŒíšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ê°ˆë¦¼ê¸¸ì—ì„œ ê¸‰ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ìš°íšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ìš°íšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "uturn": {
                    "default": "ìœ í„´í•˜ì„¸ìš”.",
                    "name": "ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìœ í„´í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "merge": {
                "default": {
                    "default": "{modifier} í•©ë¥˜",
                    "name": "{modifier} í•©ë¥˜í•˜ì—¬ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier} í•©ë¥˜í•˜ì—¬ {destination}ë¡œ ê°€ì„¸ìš”."
                },
                "straight": {
                    "default": "í•©ë¥˜",
                    "name": "{way_name}ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "destination": "{destination}ë¡œ í•©ë¥˜í•˜ì„¸ìš”."
                },
                "slight left": {
                    "default": "ì¢Œì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "name": "ì¢Œì¸¡{way_name}ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "destination": "ì¢Œì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì—¬ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ìš°ì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "name": "ìš°ì¸¡{way_name}ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "destination": "ìš°ì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì—¬ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ì¢Œì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "name": "ì¢Œì¸¡{way_name}ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "destination": "ì¢Œì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì—¬ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ìš°ì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "name": "ìš°ì¸¡{way_name}ë¡œ í•©ë¥˜í•˜ì„¸ìš”.",
                    "destination": "ìš°ì¸¡ìœ¼ë¡œ í•©ë¥˜í•˜ì—¬ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "uturn": {
                    "default": "ìœ í„´í•˜ì„¸ìš”.",
                    "name": "ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìœ í„´í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "new name": {
                "default": {
                    "default": "{modifier} ìœ ì§€í•˜ì„¸ìš”.",
                    "name": "{modifier} ìœ ì§€í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier} ìœ ì§€í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "straight": {
                    "default": "ì§ì§„í•´ì£¼ì„¸ìš”.",
                    "name": "{way_name}ë¡œ ê³„ì† ê°€ì„¸ìš”.",
                    "destination": "{destination}ê¹Œì§€ ê³„ì† ê°€ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ê¸‰ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ì¢ŒíšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ì¢ŒíšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ê¸‰ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ê¸‰ìš°íšŒì „ í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ê¸‰ìš°íšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight left": {
                    "default": "ì•½ê°„ ì¢ŒíšŒì „ í•´ì„¸ìš”.",
                    "name": "ì•½ê°„ ì¢ŒíšŒì „í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì•½ê°„ ì¢ŒíšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ì•½ê°„ ìš°íšŒì „ í•´ì„¸ìš”.",
                    "name": "ì•½ê°„ ìš°íšŒì „í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì•½ê°„ ìš°íšŒì „ í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "uturn": {
                    "default": "ìœ í„´í•´ì£¼ì„¸ìš”.",
                    "name": "ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìœ í„´í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "notification": {
                "default": {
                    "default": "{modifier} í•˜ì„¸ìš”.",
                    "name": "{modifier}í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier}í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "uturn": {
                    "default": "ìœ í„´í•˜ì„¸ìš”.",
                    "name": "ìœ í„´í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìœ í„´í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "off ramp": {
                "default": {
                    "default": "ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”..",
                    "name": "ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì¶œêµ¬ë¡œ ë‚˜ê°€ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì™¼ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”.",
                    "exit": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                    "exit_destination": "{exit} ì˜¤ë¥¸ìª½ì˜ ì¶œêµ¬ë¡œ ê°€ë‚˜ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "on ramp": {
                "default": {
                    "default": "ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”..",
                    "name": "ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "sharp right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight left": {
                    "default": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì™¼ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "slight right": {
                    "default": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ ì£¼ì„¸ìš”.",
                    "name": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì˜¤ë¥¸ìª½ì˜ ëž¨í”„ë¡œ ì§„ìž…í•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•˜ì„¸ìš”.",
                        "name": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {way_name} ë‚˜ê°€ì„¸ìš”.",
                        "destination": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {destination}ë¡œ ë‚˜ê°€ì„¸ìš”."
                    },
                    "name": {
                        "default": "{rotary_name}ë¡œ ì§„ìž…í•˜ì„¸ìš”.",
                        "name": "{rotary_name}ë¡œ ì§„ìž…í•´ì„œ {way_name}ë¡œ ë‚˜ê°€ì„¸ìš”.",
                        "destination": "{rotary_name}ë¡œ ì§„ìž…í•´ì„œ {destination}ë¡œ ë‚˜ê°€ì„¸ìš”."
                    },
                    "exit": {
                        "default": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number} ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                        "name": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number} ì¶œêµ¬ë¡œ ë‚˜ê°€ {way_name}ë¡œ ê°€ì„¸ìš”.",
                        "destination": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number} ì¶œêµ¬ë¡œ ë‚˜ê°€ {destination}ë¡œ ê°€ì„¸ìš”."
                    },
                    "name_exit": {
                        "default": "{rotary_name}ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë²ˆ ì¶œêµ¬ë¡œ ë‚˜ê°€ì„¸ìš”.",
                        "name": "{rotary_name}ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë²ˆ ì¶œêµ¬ë¡œ ë‚˜ê°€ {way_name}ë¡œ ê°€ì„¸ìš”.",
                        "destination": "{rotary_name}ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë²ˆ ì¶œêµ¬ë¡œ ë‚˜ê°€ {destination}ë¡œ ê°€ì„¸ìš”."
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë¡œ ë‚˜ê°€ì„¸ìš”.",
                        "name": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë¡œ ë‚˜ê°€ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                        "destination": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {exit_number}ë¡œ ë‚˜ê°€ì„œ {destination}ë¡œ ê°€ì„¸ìš”."
                    },
                    "default": {
                        "default": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•˜ì„¸ìš”.",
                        "name": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {way_name} ë‚˜ê°€ì„¸ìš”.",
                        "destination": "ë¡œí„°ë¦¬ë¡œ ì§„ìž…í•´ì„œ {destination}ë¡œ ë‚˜ê°€ì„¸ìš”."
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier} í•˜ì„¸ìš”.",
                    "name": "{modifier} í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier} í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "left": {
                    "default": "ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ì¢ŒíšŒì „ í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì¢ŒíšŒì „ í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "right": {
                    "default": "ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ìš°íšŒì „ í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìš°íšŒì „ í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "straight": {
                    "default": "ì§ì§„ í•˜ì„¸ìš”.",
                    "name": "ì§ì§„í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì§ì§„í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•˜ì„¸ìš”.",
                    "name": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "exit rotary": {
                "default": {
                    "default": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•˜ì„¸ìš”.",
                    "name": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•´ì„œ {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ë¡œíƒ€ë¦¬ì—ì„œ ì§„ì¶œí•´ì„œ {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier} í•˜ì„¸ìš”.",
                    "name": "{modifier} í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "{modifier} í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "left": {
                    "default": "ì¢ŒíšŒì „ í•˜ì„¸ìš”.",
                    "name": "ì¢ŒíšŒì „ í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì¢ŒíšŒì „ í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "right": {
                    "default": "ìš°íšŒì „ í•˜ì„¸ìš”.",
                    "name": "ìš°íšŒì „ í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ìš°íšŒì „ í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                },
                "straight": {
                    "default": "ì§ì§„ í•˜ì„¸ìš”.",
                    "name": "ì§ì§„í•˜ì‹œê³  {way_name}ë¡œ ê°€ì„¸ìš”.",
                    "destination": "ì§ì§„í•˜ì‹œê³  {destination}ê¹Œì§€ ê°€ì„¸ìš”."
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ì§ì§„í•˜ì„¸ìš”."
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],35:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": false
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "á€•á€‘á€™",
                    "2": "á€’á€¯á€á€­á€š",
                    "3": "á€á€á€­á€š",
                    "4": "á€…á€á€¯á€á³",
                    "5": "á€•á€¥á¥á€™",
                    "6": "á€†á€Œá€™",
                    "7": "á€žá€á±á€™",
                    "8": "á€¡á€Œá€™",
                    "9": "á€”á€á€™",
                    "10": "á€’á€žá€™"
                },
                "direction": {
                    "north": "á€±á€»á€™á€¬á€€á€¹á€¡á€›á€•á€¹",
                    "northeast": "á€¡á€±á€›á€½á‚•á€±á€»á€™á€¬á€€á€¹á€¡á€›á€•á€¹",
                    "east": "á€¡á€±á€›á€½á‚•á€¡á€›á€•á€¹",
                    "southeast": "á€¡á€±á€›á€½á‚•á€±á€á€¬á€„á€¹á€¡á€›á€•á€¹",
                    "south": "á€±á€á€¬á€„á€¹á€¡á€›á€•á€¹",
                    "southwest": "á€¡á€±á€”á€¬á€€á€¹á€±á€á€¬á€„á€¹á€¡á€›á€•á€¹",
                    "west": "á€¡á€±á€”á€¬á€€á€¹á€¡á€›á€•á€¹",
                    "northwest": "á€¡á€±á€”á€¬á€€á€¹á€±á€»á€™á€¬á€€á€¹á€¡á€›á€•á€¹"
                },
                "modifier": {
                    "left": "á€˜á€šá€¹á€˜á€€á€¹",
                    "right": "á€Šá€¬á€˜á€€á€¹",
                    "sharp left": "á€˜á€šá€¹á€˜á€€á€¹ á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸",
                    "sharp right": "á€Šá€¬á€˜á€€á€¹ á€±á€‘á€¬á€„á€¹á‚”á€á€ºá€­á€³á€¸",
                    "slight left": "á€˜á€šá€¹á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹",
                    "slight right": "á€Šá€¬á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹",
                    "straight": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸",
                    "uturn": "á€‚-á€±á€€á€¼á‚”"
                },
                "lanes": {
                    "xo": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "ox": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "xox": "á€¡á€œá€šá€¹á€á€¼á€„á€¹á€†á€€á€¹á€±á€”á€•á€«",
                    "oxo": "á€˜á€šá€¹ á€žá€­á€¯á‚•á€™á€Ÿá€¯á€á€¹ á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚• á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                }
            },
            "modes": {
                "ferry": {
                    "default": "á€–á€šá€¹á€›á€® á€…á€®á€¸á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}á€€á€­á€¯ á€–á€šá€¹á€›á€®á€…á€®á€¸á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€–á€šá€¹á€›á€®á€…á€®á€¸á€žá€¼á€¬á€¸á€•á€«"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}á€»á€•á€®á€¸á€±á€”á€¬á€€á€¹ {distance}á€¡á€á€¼á€„á€¹á€¸ {instruction_two}",
                "two linked": "{instruction_one}á€»á€•á€®á€¸á€±á€”á€¬á€€á€¹ {instruction_two}",
                "one in distance": "{distance}á€¡á€á€¼á€„á€¹á€¸ {instruction_one}",
                "name and ref": "{name}( {ref})",
                "exit with number": "{exit}á€™á€½á€‘á€¼á€€á€¹á€•á€«"
            },
            "arrive": {
                "default": {
                    "default": "{nth}á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name} á€™á€½á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "left": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name}á€™á€½á€¬á€˜á€šá€¹á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "right": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬{nth} á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name} á€™á€½á€¬á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "sharp left": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name}á€™á€½á€¬á€˜á€šá€¹á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "sharp right": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬{nth} á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name} á€™á€½á€¬á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "slight right": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬{nth} á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€­á€½á¿á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name} á€™á€½á€¬á€Šá€¬á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "slight left": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name}á€™á€½á€¬á€˜á€šá€¹á€˜á€€á€¹á€±á€€á€¼á‚•á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                },
                "straight": {
                    "default": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€žá€¼á€¬á€¸á€€á€¬á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "upcoming": "á€žá€„á€¹ á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ {nth}á€á€›á€®á€¸á€•á€”á€¹á€¸á€á€­á€¯á€„á€¹á€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€žá€¼á€¬á€¸á€€á€¬á€›á€¬á€€á€¹á€›á€½á€­á€™á€Šá€¹",
                    "short": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®",
                    "short-upcoming": "á€žá€„á€¹á€žá€¼á€¬á€¸á€œá€­á€¯á€±á€žá€¬ á€±á€”á€›á€¬á€žá€­á€¯á‚” á€±á€›á€¬á€€á€¹á€œá€­á€™á€¹á€·á€™á€Šá€¹",
                    "named": "á€žá€„á€¹ á€žá€Šá€¹ {waypoint_name}á€™á€½á€¬á€á€Šá€¹á€·á€á€Šá€¹á€·á€žá€¼á€¬á€¸á€€á€¬ á€±á€›á€¬á€€á€¹á€›á€½á€­á€»á€•á€®"
                }
            },
            "continue": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ {modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€œá€½á€Šá€¹á‚•á€•á€«",
                    "exit": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«"
                },
                "straight": {
                    "default": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹á€á€Šá€¹á€á€Šá€¹á€·á€†á€€á€¹á€žá€¼á€¬á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "distance": "{distance}á€±á€œá€¬á€€á€¹ á€á€Šá€¹á€·á€á€Šá€¹á€· á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "namedistance": "{way_name}â€‹â€‹á€±á€•ášá€á€¼á€„á€¹{distance}á€±á€œá€¬á€€á€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "sharp left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                },
                "sharp right": {
                    "default": "á€Šá€¬á€˜á€€á€¹ á€±á€‘á€¬á€„á€¹á‚”á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                },
                "slight left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€±á€€á€¼á‚•á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€˜á€šá€¹á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€±á€€á€¼á‚•á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                },
                "slight right": {
                    "default": "á€Šá€¬á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€Šá€¬á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€±á€€á€¼á‚•á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                },
                "uturn": {
                    "default": "á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "name": "{way_name}á€œá€™á€¹á€¸á€˜á€€á€¹á€žá€­á€¯á‚• á€‚-á€±á€€á€¼á‚•á€±á€€á€¼á‚•á€»á€•á€®á€¸á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "depart": {
                "default": {
                    "default": "{direction}á€žá€­á€¯á‚• á€¥á€®á€¸á€á€Šá€¹á€•á€«",
                    "name": "{direction}á€€á€­á€¯ {way_name}á€¡á€±á€•ášá€á€¼á€„á€¹ á€¥á€®á€¸á€á€Šá€¹á€•á€«",
                    "namedistance": "{direction}á€€á€­á€¯ {way_name}á€¡á€±á€•ášá€á€¼á€„á€¹{distance}á€±á€œá€¬á€€á€¹ á€¥á€®á€¸á€á€Šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                }
            },
            "end of road": {
                "default": {
                    "default": "{modifier}á€žá€­á€¯á‚•á€œá€½á€Šá€¹á€·á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€œá€½á€Šá€¹á‚•á€•á€«"
                },
                "straight": {
                    "default": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "uturn": {
                    "default": "á€œá€™á€¹á€¸á€¡á€†á€¶á€¯á€¸á€á€¼á€„á€¹ á€‚-á€±á€€á€¼á‚•á€±á€€á€¼á‚•á€•á€«",
                    "name": "á€œá€™á€¹á€¸á€¡á€†á€¶á€¯á€¸á€á€¼á€„á€¹ {way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€‚-á€±á€€á€¼á‚•á€±á€€á€¼á‚•á€•á€«",
                    "destination": "á€œá€™á€¹á€¸á€¡á€†á€¶á€¯á€¸á€á€¼á€„á€¹{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "fork": {
                "default": {
                    "default": "á€œá€™á€¹á€¸á€†á€¶á€¯á€œá€™á€¹á€¸á€á€¼á€á€¼á€„á€¹ {modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "slight left": {
                    "default": "á€œá€™á€¹á€¸á€†á€¶á€¯á€œá€™á€¹á€¸á€á€¼á€á€¼á€„á€¹á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "slight right": {
                    "default": "á€œá€™á€¹á€¸á€†á€¶á€¯á€œá€™á€¹á€¸á€á€¼á€á€¼á€„á€¹á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "sharp left": {
                    "default": "á€œá€™á€¹á€¸á€†á€¶á€¯á€œá€™á€¹á€¸á€á€¼á€á€¼á€„á€¹á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€€á€­á€¯á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸ á€žá€¼á€¬á€¸á€•á€«"
                },
                "sharp right": {
                    "default": "á€œá€™á€¹á€¸á€†á€¶á€¯á€œá€™á€¹á€¸á€á€¼á€á€¼á€„á€¹á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€€á€­á€¯á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸ á€žá€¼á€¬á€¸á€•á€«"
                },
                "uturn": {
                    "default": "á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "name": "{way_name}á€žá€­á€¯á‚•á€‚-á€±á€€á€¼á‚•á€±á€€á€¼á‚•á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "merge": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "straight": {
                    "default": "á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "slight left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯ á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "slight right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯ á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "sharp left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯ á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "sharp right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯ á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«"
                },
                "uturn": {
                    "default": "á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚•á€•á€«",
                    "name": "{way_name}á€œá€™á€¹á€¸á€˜á€€á€¹á€žá€­á€¯á‚” á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€« ",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "new name": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "straight": {
                    "default": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "sharp left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€á€¼á€„á€¹á€±á€”á€›á€”á€¹ á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸ á€žá€¼á€¬á€¸á€•á€«"
                },
                "sharp right": {
                    "default": "á€Šá€¬á€˜á€€á€¹ á€±á€‘á€¬á€„á€¹á‚”á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€±á€‘á€¬á€„á€¹á€·á€á€ºá€­á€³á€¸ á€žá€¼á€¬á€¸á€•á€«"
                },
                "slight left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "slight right": {
                    "default": "á€Šá€¬á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€¡á€”á€Šá€¹á€¸á€„á€šá€¹á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "uturn": {
                    "default": "á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "name": "{way_name}á€œá€™á€¹á€¸á€˜á€€á€¹á€žá€­á€¯á‚” á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "notification": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚• {modifier}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• {modifier}á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "uturn": {
                    "default": "á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "name": "{way_name}á€œá€™á€¹á€¸á€˜á€€á€¹á€žá€­á€¯á‚” á€‚-á€±á€€á€¼á‚” á€±á€€á€¼á‚”á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€‚á€±á€€á€¼á‚•á€á€ºá€­á€³á€¸á€±á€€á€¼á‚•á€•á€«"
                }
            },
            "off ramp": {
                "default": {
                    "default": "á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚• {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€Šá€¬á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "sharp left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "sharp right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€Šá€¬á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "slight left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€˜á€šá€¹á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                },
                "slight right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "exit": "á€Šá€¬á€˜á€€á€¹á€á€¼á€„á€¹{exit}á€€á€­á€¯ á€šá€°á€•á€«",
                    "exit_destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€™á€½ {exit} á€€á€­á€¯á€šá€°á€•á€«"
                }
            },
            "on ramp": {
                "default": {
                    "default": "á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "sharp left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "sharp right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "slight left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€˜á€šá€¹á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                },
                "slight right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚•á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹ â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚• á€Šá€¬á€˜á€€á€¹â€‹á€±á€•ášá€á€¼á€„á€¹á€á€ºá€¥á€¹á€¸á€€á€•á€¹á€œá€™á€¹á€¸á€€á€­á€¯á€šá€°á€•á€«"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€žá€­á€¯á‚•á€á€„á€¹á€•á€«",
                        "name": "{way_name}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«Â ",
                        "destination": "{destination}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«"
                    },
                    "name": {
                        "default": "{rotary_name}á€žá€­á€¯á‚•á€á€„á€¹á€•á€«",
                        "name": "{rotary_name}á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{way_name}á€±á€•ášá€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«",
                        "destination": "{rotary_name}á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{destination}á€†á€®á€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«"
                    },
                    "exit": {
                        "default": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬á€»á€•á€”á€¹á€‘á€¼á€€á€¹á€•á€«",
                        "name": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€žá€­á€¯á‚•á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{way_name}á€±á€•ášá€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«",
                        "destination": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{destination}á€†á€®á€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«"
                    },
                    "name_exit": {
                        "default": "{rotary_name}á€€á€­á€¯á€á€„á€¹á€»á€•á€®á€¸ {exit_number}á€€á€­á€¯á€šá€°á€€á€¬á€‘á€¼á€€á€¹á€•á€«",
                        "name": "{rotary_name}á€€á€­á€¯á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{way_name}á€±á€•ášá€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«",
                        "destination": "{rotary_name}á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{destination}á€†á€®á€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "{exit_number}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                        "name": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{way_name}á€±á€•ášá€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«",
                        "destination": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€»á€•á€®á€¸{exit_number}á€€á€­á€¯á€šá€°á€€á€¬{destination}á€†á€®á€žá€­á€¯á‚•á€‘á€¼á€€á€¹á€•á€«"
                    },
                    "default": {
                        "default": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€á€„á€¹á€•á€«",
                        "name": "{way_name}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                        "destination": "{destination}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«Â ",
                    "name": "{modifier}â€‹á€±á€•ášá€žá€­á€¯{way_name}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â ",
                    "destination": "{modifier}á€†á€®á€žá€­á€¯á‚•{destination}á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â "
                },
                "left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€»á€•á€”á€¹á€œá€½á€Šá€¹á‚”á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â ",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€™á€½ á€±á€€á€¼á‚”á€•á€«"
                },
                "right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚”á€»á€•á€”á€¹á€œá€½á€Šá€¹á‚”á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«Â ",
                    "destination": "{destination}á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚” á€±á€€á€¼á‚”á€•á€«"
                },
                "straight": {
                    "default": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}â€‹â€‹á€±á€•ášá€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                    "name": "{way_name}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                    "destination": "á€¥á€®á€¸á€á€Šá€¹á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«{destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«á€¥á€®á€¸á€á€Šá€¹á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                    "name": "{way_name}á€±á€•ášá€žá€­á€¯á‚”á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«",
                    "destination": "á€¥á€®á€¸á€á€Šá€¹á€¡á€á€­á€¯á€„á€¹á€¸á€•á€á€¹á€œá€™á€¹á€¸á€™á€½á€‘á€¼á€€á€¹á€•á€«{destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier}á€€á€­á€¯á€œá€½á€Šá€¹á€·á€•á€«Â ",
                    "name": "{modifier}â€‹á€±á€•ášá€žá€­á€¯{way_name}á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â ",
                    "destination": "{modifier}á€†á€®á€žá€­á€¯á‚•{destination}á€€á€­á€¯ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â "
                },
                "left": {
                    "default": "á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚•á€»á€•á€”á€¹á€œá€½á€Šá€¹á‚”á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€˜á€šá€¹á€˜á€€á€¹á€€á€­á€¯á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«Â ",
                    "destination": "{destination}á€˜á€šá€¹á€˜á€€á€¹á€žá€­á€¯á‚” á€±á€€á€¼á‚”á€•á€«"
                },
                "right": {
                    "default": "á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚”á€»á€•á€”á€¹á€œá€½á€Šá€¹á‚”á€•á€«",
                    "name": "{way_name}â€‹á€±á€•ášá€žá€­á€¯á‚•á€Šá€¬á€˜á€€á€¹á€€á€­á€¯á€œá€¬á€±á€›á€¬á€€á€¹á€±á€•á€«á€„á€¹á€¸á€†á€¶á€¯á€•á€«Â ",
                    "destination": "{destination}á€Šá€¬á€˜á€€á€¹á€žá€­á€¯á‚” á€±á€€á€¼á‚”á€•á€«"
                },
                "straight": {
                    "default": "á€á€Šá€¹á‚”á€á€Šá€¹á‚”á€žá€¼á€¬á€¸á€•á€«",
                    "name": "{way_name}",
                    "destination": "{destination}á€†á€®á€žá€­á€¯á‚•á€á€Šá€¹á€·á€á€Šá€¹á€·á€žá€¼á€¬á€¸á€•á€«"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "á€±á€»á€–á€¬á€„á€¹á‚”á€±á€»á€–á€¬á€„á€¹á‚”á€á€”á€¹á€¸á€á€”á€¹á€¸ á€†á€€á€¹á€žá€¼á€¬á€¸á€•á€«"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],36:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1e",
                    "2": "2e",
                    "3": "3e",
                    "4": "4e",
                    "5": "5e",
                    "6": "6e",
                    "7": "7e",
                    "8": "8e",
                    "9": "9e",
                    "10": "10e"
                },
                "direction": {
                    "north": "noord",
                    "northeast": "noordoost",
                    "east": "oost",
                    "southeast": "zuidoost",
                    "south": "zuid",
                    "southwest": "zuidwest",
                    "west": "west",
                    "northwest": "noordwest"
                },
                "modifier": {
                    "left": "links",
                    "right": "rechts",
                    "sharp left": "scherpe bocht naar links",
                    "sharp right": "scherpe bocht naar rechts",
                    "slight left": "iets naar links",
                    "slight right": "iets naar rechts",
                    "straight": "rechtdoor",
                    "uturn": "omkeren"
                },
                "lanes": {
                    "xo": "Rechts aanhouden",
                    "ox": "Links aanhouden",
                    "xox": "In het midden blijven",
                    "oxo": "Links of rechts blijven"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Neem de veerpont",
                    "name": "Neem de veerpont {way_name}",
                    "destination": "Neem de veerpont richting {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, dan na {distance}, {instruction_two}",
                "two linked": "{instruction_one}, daarna {instruction_two}",
                "one in distance": "Over {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "afslag {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Je bent gearriveerd op de {nth} bestemming.",
                    "upcoming": "U arriveert op de {nth} bestemming",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name}"
                },
                "left": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich links.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de linkerkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name}, de bestemming is aan de linkerkant"
                },
                "right": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich rechts.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de rechterkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name}, de bestemming is aan de  rechterkant"
                },
                "sharp left": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich links.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de linkerkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name}, de bestemming is aan de linkerkant"
                },
                "sharp right": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich rechts.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de rechterkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name},  de bestemming is aan de rechterkant"
                },
                "slight right": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich rechts.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de rechterkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name},  de bestemming is aan de rechterkant"
                },
                "slight left": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich links.",
                    "upcoming": "Uw {nth} bestemming bevindt zich aan de linkerkant",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name},  de bestemming is aan de linkerkant"
                },
                "straight": {
                    "default": "Je bent gearriveerd. De {nth} bestemming bevindt zich voor je.",
                    "upcoming": "Uw {nth} bestemming is recht voor u",
                    "short": "U bent gearriveerd",
                    "short-upcoming": "U zult aankomen",
                    "named": "U bent gearriveerd bij {waypoint_name}, de bestemming is recht voor u"
                }
            },
            "continue": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Sla {modifier} om op {way_name} te blijven",
                    "destination": "Ga {modifier} richting {destination}",
                    "exit": "Ga {modifier} naar {way_name}"
                },
                "straight": {
                    "default": "Ga rechtdoor",
                    "name": "Blijf rechtdoor gaan op {way_name}",
                    "destination": "Ga rechtdoor richting {destination}",
                    "distance": "Ga rechtdoor voor {distance}",
                    "namedistance": "Ga verder op {way_name} voor {distance}"
                },
                "sharp left": {
                    "default": "Linksaf",
                    "name": "Sla scherp links af om op {way_name} te blijven",
                    "destination": "Linksaf richting {destination}"
                },
                "sharp right": {
                    "default": "Rechtsaf",
                    "name": "Sla scherp rechts af om op {way_name} te blijven",
                    "destination": "Rechtsaf richting {destination}"
                },
                "slight left": {
                    "default": "Ga links",
                    "name": "Links afbuigen om op {way_name} te blijven",
                    "destination": "Rechts afbuigen om op {destination} te blijven"
                },
                "slight right": {
                    "default": "Rechts afbuigen",
                    "name": "Rechts afbuigen om op {way_name} te blijven",
                    "destination": "Rechts afbuigen richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Draai om en ga verder op {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Vertrek in {direction}elijke richting",
                    "name": "Neem {way_name} in {direction}elijke richting",
                    "namedistance": "Ga richting {direction} op {way_name} voor {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Ga {modifier} naar {way_name}",
                    "destination": "Ga {modifier} richting {destination}"
                },
                "straight": {
                    "default": "Ga in de aangegeven richting",
                    "name": "Ga naar {way_name}",
                    "destination": "Ga richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Keer om naar {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "Ga {modifier} op de splitsing",
                    "name": "Houd {modifier} aan, tot {way_name}",
                    "destination": "Houd {modifier}, in de richting van {destination}"
                },
                "slight left": {
                    "default": "Links aanhouden op de splitsing",
                    "name": "Houd links aan, tot {way_name}",
                    "destination": "Houd links aan, richting {destination}"
                },
                "slight right": {
                    "default": "Rechts aanhouden op de splitsing",
                    "name": "Houd rechts aan, tot {way_name}",
                    "destination": "Houd rechts aan, richting {destination}"
                },
                "sharp left": {
                    "default": "Neem bij de splitsing, een scherpe bocht, naar links ",
                    "name": "Neem een scherpe bocht naar links, tot aan {way_name}",
                    "destination": "Neem een scherpe bocht naar links, richting {destination}"
                },
                "sharp right": {
                    "default": "Neem  op de splitsing, een scherpe bocht, naar rechts",
                    "name": "Neem een scherpe bocht naar rechts, tot aan {way_name}",
                    "destination": "Neem een scherpe bocht naar rechts, richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Keer om naar {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Bij de splitsing {modifier}",
                    "name": "Bij de splitsing {modifier} naar {way_name}",
                    "destination": "Bij de splitsing {modifier} richting {destination}"
                },
                "straight": {
                    "default": "Samenvoegen",
                    "name": "Ga verder op {way_name}",
                    "destination": "Ga verder richting {destination}"
                },
                "slight left": {
                    "default": "Bij de splitsing links aanhouden",
                    "name": "Bij de splitsing links aanhouden naar {way_name}",
                    "destination": "Bij de splitsing links aanhouden richting {destination}"
                },
                "slight right": {
                    "default": "Bij de splitsing rechts aanhouden",
                    "name": "Bij de splitsing rechts aanhouden naar {way_name}",
                    "destination": "Bij de splitsing rechts aanhouden richting {destination}"
                },
                "sharp left": {
                    "default": "Bij de splitsing linksaf",
                    "name": "Bij de splitsing linksaf naar {way_name}",
                    "destination": "Bij de splitsing linksaf richting {destination}"
                },
                "sharp right": {
                    "default": "Bij de splitsing rechtsaf",
                    "name": "Bij de splitsing rechtsaf naar {way_name}",
                    "destination": "Bij de splitsing rechtsaf richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Keer om naar {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Ga {modifier} naar {way_name}",
                    "destination": "Ga {modifier} richting {destination}"
                },
                "straight": {
                    "default": "Ga in de aangegeven richting",
                    "name": "Ga rechtdoor naar {way_name}",
                    "destination": "Ga rechtdoor richting {destination}"
                },
                "sharp left": {
                    "default": "Neem een scherpe bocht, naar links",
                    "name": "Linksaf naar {way_name}",
                    "destination": "Linksaf richting {destination}"
                },
                "sharp right": {
                    "default": "Neem een scherpe bocht, naar rechts",
                    "name": "Rechtsaf naar {way_name}",
                    "destination": "Rechtsaf richting {destination}"
                },
                "slight left": {
                    "default": "Links aanhouden",
                    "name": "Links aanhouden naar {way_name}",
                    "destination": "Links aanhouden richting {destination}"
                },
                "slight right": {
                    "default": "Rechts aanhouden",
                    "name": "Rechts aanhouden naar {way_name}",
                    "destination": "Rechts aanhouden richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Keer om naar {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Ga {modifier} naar {way_name}",
                    "destination": "Ga {modifier} richting {destination}"
                },
                "uturn": {
                    "default": "Keer om",
                    "name": "Keer om naar {way_name}",
                    "destination": "Keer om richting {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Neem de afrit",
                    "name": "Neem de afrit naar {way_name}",
                    "destination": "Neem de afrit richting {destination}",
                    "exit": "Neem afslag {exit}",
                    "exit_destination": "Neem afslag {exit} richting {destination}"
                },
                "left": {
                    "default": "Neem de afrit links",
                    "name": "Neem de afrit links naar {way_name}",
                    "destination": "Neem de afrit links richting {destination}",
                    "exit": "Neem afslag {exit} aan de linkerkant",
                    "exit_destination": "Neem afslag {exit} aan de linkerkant richting {destination}"
                },
                "right": {
                    "default": "Neem de afrit rechts",
                    "name": "Neem de afrit rechts naar {way_name}",
                    "destination": "Neem de afrit rechts richting {destination}",
                    "exit": "Neem afslag {exit} aan de rechterkant",
                    "exit_destination": "Neem afslag {exit} aan de rechterkant richting {destination}"
                },
                "sharp left": {
                    "default": "Neem de afrit links",
                    "name": "Neem de afrit links naar {way_name}",
                    "destination": "Neem de afrit links richting {destination}",
                    "exit": "Neem afslag {exit} aan de linkerkant",
                    "exit_destination": "Neem afslag {exit} aan de linkerkant richting {destination}"
                },
                "sharp right": {
                    "default": "Neem de afrit rechts",
                    "name": "Neem de afrit rechts naar {way_name}",
                    "destination": "Neem de afrit rechts richting {destination}",
                    "exit": "Neem afslag {exit} aan de rechterkant",
                    "exit_destination": "Neem afslag {exit} aan de rechterkant richting {destination}"
                },
                "slight left": {
                    "default": "Neem de afrit links",
                    "name": "Neem de afrit links naar {way_name}",
                    "destination": "Neem de afrit links richting {destination}",
                    "exit": "Neem afslag {exit} aan de linkerkant",
                    "exit_destination": "Neem afslag {exit} aan de linkerkant richting {destination}"
                },
                "slight right": {
                    "default": "Neem de afrit rechts",
                    "name": "Neem de afrit rechts naar {way_name}",
                    "destination": "Neem de afrit rechts richting {destination}",
                    "exit": "Neem afslag {exit} aan de rechterkant",
                    "exit_destination": "Neem afslag {exit} aan de rechterkant richting {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Neem de oprit",
                    "name": "Neem de oprit naar {way_name}",
                    "destination": "Neem de oprit richting {destination}"
                },
                "left": {
                    "default": "Neem de oprit links",
                    "name": "Neem de oprit links naar {way_name}",
                    "destination": "Neem de oprit links richting {destination}"
                },
                "right": {
                    "default": "Neem de oprit rechts",
                    "name": "Neem de oprit rechts naar {way_name}",
                    "destination": "Neem de oprit rechts richting {destination}"
                },
                "sharp left": {
                    "default": "Neem de oprit links",
                    "name": "Neem de oprit links naar {way_name}",
                    "destination": "Neem de oprit links richting {destination}"
                },
                "sharp right": {
                    "default": "Neem de oprit rechts",
                    "name": "Neem de oprit rechts naar {way_name}",
                    "destination": "Neem de oprit rechts richting {destination}"
                },
                "slight left": {
                    "default": "Neem de oprit links",
                    "name": "Neem de oprit links naar {way_name}",
                    "destination": "Neem de oprit links richting {destination}"
                },
                "slight right": {
                    "default": "Neem de oprit rechts",
                    "name": "Neem de oprit rechts naar {way_name}",
                    "destination": "Neem de oprit rechts richting {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Betreedt de rotonde",
                        "name": "Betreedt rotonde en sla af op {way_name}",
                        "destination": "Betreedt rotonde en sla af richting {destination}"
                    },
                    "name": {
                        "default": "Ga het knooppunt {rotary_name} op",
                        "name": "Verlaat het knooppunt {rotary_name} naar {way_name}",
                        "destination": "Verlaat het knooppunt {rotary_name} richting {destination}"
                    },
                    "exit": {
                        "default": "Betreedt rotonde en neem afslag {exit_number}",
                        "name": "Betreedt rotonde en neem afslag {exit_number} naar {way_name}",
                        "destination": "Betreedt rotonde en neem afslag {exit_number} richting {destination}"
                    },
                    "name_exit": {
                        "default": "Ga het knooppunt {rotary_name} op en neem afslag {exit_number}",
                        "name": "Ga het knooppunt {rotary_name} op en neem afslag {exit_number} naar {way_name}",
                        "destination": "Ga het knooppunt {rotary_name} op en neem afslag {exit_number} richting {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Betreedt rotonde en neem afslag {exit_number}",
                        "name": "Betreedt rotonde en neem afslag {exit_number} naar {way_name}",
                        "destination": "Betreedt rotonde en neem afslag {exit_number} richting {destination}"
                    },
                    "default": {
                        "default": "Betreedt de rotonde",
                        "name": "Betreedt rotonde en sla af op {way_name}",
                        "destination": "Betreedt rotonde en sla af richting {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Ga {modifier} naar {way_name}",
                    "destination": "Ga {modifier} richting {destination}"
                },
                "left": {
                    "default": "Ga linksaf",
                    "name": "Ga linksaf naar {way_name}",
                    "destination": "Ga linksaf richting {destination}"
                },
                "right": {
                    "default": "Ga rechtsaf",
                    "name": "Ga rechtsaf naar {way_name}",
                    "destination": "Ga rechtsaf richting {destination}"
                },
                "straight": {
                    "default": "Ga in de aangegeven richting",
                    "name": "Ga naar {way_name}",
                    "destination": "Ga richting {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Verlaat de rotonde",
                    "name": "Verlaat de rotonde en ga verder op {way_name}",
                    "destination": "Verlaat de rotonde richting {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Verlaat de rotonde",
                    "name": "Verlaat de rotonde en ga verder op {way_name}",
                    "destination": "Verlaat de rotonde richting {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Ga {modifier}",
                    "name": "Ga {modifier} naar {way_name}",
                    "destination": "Ga {modifier} richting {destination}"
                },
                "left": {
                    "default": "Ga linksaf",
                    "name": "Ga linksaf naar {way_name}",
                    "destination": "Ga linksaf richting {destination}"
                },
                "right": {
                    "default": "Ga rechtsaf",
                    "name": "Ga rechtsaf naar {way_name}",
                    "destination": "Ga rechtsaf richting {destination}"
                },
                "straight": {
                    "default": "Ga rechtdoor",
                    "name": "Ga rechtdoor naar {way_name}",
                    "destination": "Ga rechtdoor richting {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Rechtdoor"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],37:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1.",
                    "2": "2.",
                    "3": "3.",
                    "4": "4.",
                    "5": "5.",
                    "6": "6.",
                    "7": "7.",
                    "8": "8.",
                    "9": "9.",
                    "10": "10."
                },
                "direction": {
                    "north": "nord",
                    "northeast": "nordÃ¸st",
                    "east": "Ã¸st",
                    "southeast": "sÃ¸rÃ¸st",
                    "south": "sÃ¸r",
                    "southwest": "sÃ¸rvest",
                    "west": "vest",
                    "northwest": "nordvest"
                },
                "modifier": {
                    "left": "venstre",
                    "right": "hÃ¸yre",
                    "sharp left": "skarp venstre",
                    "sharp right": "skarp hÃ¸yre",
                    "slight left": "litt til venstre",
                    "slight right": "litt til hÃ¸yre",
                    "straight": "rett frem",
                    "uturn": "U-sving"
                },
                "lanes": {
                    "xo": "Hold til hÃ¸yre",
                    "ox": "Hold til venstre",
                    "xox": "Hold deg i midten",
                    "oxo": "Hold til venstre eller hÃ¸yre"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Ta ferja",
                    "name": "Ta ferja {way_name}",
                    "destination": "Ta ferja til {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, deretter {instruction_two} om {distance}",
                "two linked": "{instruction_one}, deretter {instruction_two}",
                "one in distance": "Om {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "avkjÃ¸rsel {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Du har ankommet din {nth} destinasjon",
                    "upcoming": "Du vil ankomme din {nth} destinasjon",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}"
                },
                "left": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din venstre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din venstre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din venstre side"
                },
                "right": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din hÃ¸yre side"
                },
                "sharp left": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din venstre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din venstre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din venstre side"
                },
                "sharp right": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din hÃ¸yre side"
                },
                "slight right": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din hÃ¸yre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din hÃ¸yre side"
                },
                "slight left": {
                    "default": "Du har ankommet din {nth} destinasjon, pÃ¥ din venstre side",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, pÃ¥ din venstre side",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, pÃ¥ din venstre side"
                },
                "straight": {
                    "default": "Du har ankommet din {nth} destinasjon, rett forut",
                    "upcoming": "Du vil ankomme din {nth} destinasjon, rett forut",
                    "short": "Du har ankommet",
                    "short-upcoming": "Du vil ankomme",
                    "named": "Du har ankommet {waypoint_name}, rett forut"
                }
            },
            "continue": {
                "default": {
                    "default": "Ta til {modifier}",
                    "name": "Ta til {modifier} for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Ta til {modifier} mot {destination}",
                    "exit": "Ta til {modifier} inn pÃ¥ {way_name}"
                },
                "straight": {
                    "default": "Fortsett rett frem",
                    "name": "Fortsett rett frem for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Fortsett mot {destination}",
                    "distance": "Fortsett rett frem, {distance} ",
                    "namedistance": "Fortsett pÃ¥ {way_name}, {distance}"
                },
                "sharp left": {
                    "default": "Sving skarpt til venstre",
                    "name": "Sving skarpt til venstre for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Sving skarpt til venstre mot {destination}"
                },
                "sharp right": {
                    "default": "Sving skarpt til hÃ¸yre",
                    "name": "Sving skarpt til hÃ¸yre for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Sving skarpt mot {destination}"
                },
                "slight left": {
                    "default": "Sving svakt til venstre",
                    "name": "Sving svakt til venstre for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Sving svakt til venstre mot {destination}"
                },
                "slight right": {
                    "default": "Sving svakt til hÃ¸yre",
                    "name": "Sving svakt til hÃ¸yre for Ã¥ bli vÃ¦rende pÃ¥ {way_name}",
                    "destination": "Sving svakt til hÃ¸yre mot {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving",
                    "name": "Ta en U-sving og fortsett pÃ¥ {way_name}",
                    "destination": "Ta en U-sving mot {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "KjÃ¸r i retning {direction}",
                    "name": "KjÃ¸r i retning {direction} pÃ¥ {way_name}",
                    "namedistance": "KjÃ¸r i retning {direction} pÃ¥ {way_name}, {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Sving {modifier}",
                    "name": "Ta til {modifier} inn pÃ¥ {way_name}",
                    "destination": "Sving {modifier} mot {destination}"
                },
                "straight": {
                    "default": "Fortsett rett frem",
                    "name": "Fortsett rett frem til  {way_name}",
                    "destination": "Fortsett rett frem mot {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving i enden av veien",
                    "name": "Ta en U-sving til {way_name} i enden av veien",
                    "destination": "Ta en U-sving mot {destination} i enden av veien"
                }
            },
            "fork": {
                "default": {
                    "default": "Hold til {modifier} i veikrysset",
                    "name": "Hold til {modifier} inn pÃ¥ {way_name}",
                    "destination": "Hold til {modifier} mot {destination}"
                },
                "slight left": {
                    "default": "Hold til venstre i veikrysset",
                    "name": "Hold til venstre inn pÃ¥ {way_name}",
                    "destination": "Hold til venstre mot {destination}"
                },
                "slight right": {
                    "default": "Hold til hÃ¸yre i veikrysset",
                    "name": "Hold til hÃ¸yre inn pÃ¥ {way_name}",
                    "destination": "Hold til hÃ¸yre mot {destination}"
                },
                "sharp left": {
                    "default": "Sving skarpt til venstre i veikrysset",
                    "name": "Sving skarpt til venstre inn pÃ¥ {way_name}",
                    "destination": "Sving skarpt til venstre mot {destination}"
                },
                "sharp right": {
                    "default": "Sving skarpt til hÃ¸yre i veikrysset",
                    "name": "Sving skarpt til hÃ¸yre inn pÃ¥ {way_name}",
                    "destination": "Svings skarpt til hÃ¸yre mot {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving",
                    "name": "Ta en U-sving til {way_name}",
                    "destination": "Ta en U-sving mot {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Hold {modifier} kjÃ¸refelt",
                    "name": "Hold {modifier} kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold {modifier} kjÃ¸refelt mot {destination}"
                },
                "straight": {
                    "default": "Hold kjÃ¸refelt",
                    "name": "Hold kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold kjÃ¸refelt mot {destination}"
                },
                "slight left": {
                    "default": "Hold venstre kjÃ¸refelt",
                    "name": "Hold venstre kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold venstre kjÃ¸refelt mot {destination}"
                },
                "slight right": {
                    "default": "Hold hÃ¸yre kjÃ¸refelt",
                    "name": "Hold hÃ¸yre kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold hÃ¸yre kjÃ¸refelt mot {destination}"
                },
                "sharp left": {
                    "default": "Hold venstre kjÃ¸refelt",
                    "name": "Hold venstre kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold venstre kjÃ¸refelt mot {destination}"
                },
                "sharp right": {
                    "default": "Hold hÃ¸yre kjÃ¸refelt",
                    "name": "Hold hÃ¸yre kjÃ¸refelt inn pÃ¥ {way_name}",
                    "destination": "Hold hÃ¸yre kjÃ¸refelt mot {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving",
                    "name": "Ta en U-sving til {way_name}",
                    "destination": "Ta en U-sving mot {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Fortsett {modifier}",
                    "name": "Fortsett {modifier} til {way_name}",
                    "destination": "Fortsett {modifier} mot  {destination}"
                },
                "straight": {
                    "default": "Fortsett rett frem",
                    "name": "Fortsett inn pÃ¥ {way_name}",
                    "destination": "Fortsett mot {destination}"
                },
                "sharp left": {
                    "default": "Sving skarpt til venstre",
                    "name": "Sving skarpt til venstre inn pÃ¥ {way_name}",
                    "destination": "Sving skarpt til venstre mot {destination}"
                },
                "sharp right": {
                    "default": "Sving skarpt til hÃ¸yre",
                    "name": "Sving skarpt til hÃ¸yre inn pÃ¥ {way_name}",
                    "destination": "Svings skarpt til hÃ¸yre mot {destination}"
                },
                "slight left": {
                    "default": "Fortsett litt mot venstre",
                    "name": "Fortsett litt mot venstre til {way_name}",
                    "destination": "Fortsett litt mot venstre mot {destination}"
                },
                "slight right": {
                    "default": "Fortsett litt mot hÃ¸yre",
                    "name": "Fortsett litt mot hÃ¸yre til {way_name}",
                    "destination": "Fortsett litt mot hÃ¸yre mot {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving",
                    "name": "Ta en U-sving til {way_name}",
                    "destination": "Ta en U-sving mot {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Fortsett {modifier}",
                    "name": "Fortsett {modifier} til {way_name}",
                    "destination": "Fortsett {modifier} mot  {destination}"
                },
                "uturn": {
                    "default": "Ta en U-sving",
                    "name": "Ta en U-sving til {way_name}",
                    "destination": "Ta en U-sving mot {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ta avkjÃ¸rselen",
                    "name": "Ta avkjÃ¸rselen inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit}",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} mot {destination}"
                },
                "left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side mot {destination}"
                },
                "right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side mot {destination}"
                },
                "sharp left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side mot {destination}"
                },
                "sharp right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side mot {destination}"
                },
                "slight left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ venstre side mot {destination}"
                },
                "slight right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}",
                    "exit": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side",
                    "exit_destination": "Ta avkjÃ¸rsel {exit} pÃ¥ hÃ¸yre side mot {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Ta avkjÃ¸rselen",
                    "name": "Ta avkjÃ¸rselen inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen mot {destination}"
                },
                "left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}"
                },
                "right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}"
                },
                "sharp left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}"
                },
                "sharp right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}"
                },
                "slight left": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ venstre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ venstre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ venstre side mot {destination}"
                },
                "slight right": {
                    "default": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side",
                    "name": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side inn pÃ¥ {way_name}",
                    "destination": "Ta avkjÃ¸rselen pÃ¥ hÃ¸yre side mot {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "KjÃ¸r inn i rundkjÃ¸ringen",
                        "name": "KjÃ¸r inn i rundkjÃ¸ringen og deretter ut pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i rundkjÃ¸ringen og deretter ut mot {destination}"
                    },
                    "name": {
                        "default": "KjÃ¸r inn i {rotary_name}",
                        "name": "KjÃ¸r inn i {rotary_name} og deretter ut pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i {rotary_name} og deretter ut mot {destination}"
                    },
                    "exit": {
                        "default": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel",
                        "name": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel ut pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel ut mot {destination} "
                    },
                    "name_exit": {
                        "default": "KjÃ¸r inn i {rotary_name} og ta {exit_number} avkjÃ¸rsel",
                        "name": "KjÃ¸r inn i {rotary_name} og ta {exit_number} avkjÃ¸rsel inn pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i {rotary_name} og ta {exit_number} avkjÃ¸rsel mot {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel",
                        "name": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel inn pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i rundkjÃ¸ringen og ta {exit_number} avkjÃ¸rsel ut mot {destination} "
                    },
                    "default": {
                        "default": "KjÃ¸r inn i rundkjÃ¸ringen",
                        "name": "KjÃ¸r inn i rundkjÃ¸ringen og deretter ut pÃ¥ {way_name}",
                        "destination": "KjÃ¸r inn i rundkjÃ¸ringen og deretter ut mot {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Ta en {modifier}",
                    "name": "Ta en {modifier} inn pÃ¥ {way_name}",
                    "destination": "Ta en {modifier} mot {destination}"
                },
                "left": {
                    "default": "Sving til venstre",
                    "name": "Sving til venstre inn pÃ¥ {way_name}",
                    "destination": "Sving til venstre mot {destination}"
                },
                "right": {
                    "default": "Sving til hÃ¸yre",
                    "name": "Sving til hÃ¸yre inn pÃ¥ {way_name}",
                    "destination": "Sving til hÃ¸yre mot {destination}"
                },
                "straight": {
                    "default": "Fortsett rett frem",
                    "name": "Fortsett rett frem til  {way_name}",
                    "destination": "Fortsett rett frem mot {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "KjÃ¸r ut av rundkjÃ¸ringen",
                    "name": "KjÃ¸r ut av rundkjÃ¸ringen og inn pÃ¥ {way_name}",
                    "destination": "KjÃ¸r ut av rundkjÃ¸ringen mot {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "KjÃ¸r ut av rundkjÃ¸ringen",
                    "name": "KjÃ¸r ut av rundkjÃ¸ringen og inn pÃ¥ {way_name}",
                    "destination": "KjÃ¸r ut av rundkjÃ¸ringen mot {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Ta en {modifier}",
                    "name": "Ta en {modifier} inn pÃ¥ {way_name}",
                    "destination": "Ta en {modifier} mot {destination}"
                },
                "left": {
                    "default": "Sving til venstre",
                    "name": "Sving til venstre inn pÃ¥ {way_name}",
                    "destination": "Sving til venstre mot {destination}"
                },
                "right": {
                    "default": "Sving til hÃ¸yre",
                    "name": "Sving til hÃ¸yre inn pÃ¥ {way_name}",
                    "destination": "Sving til hÃ¸yre mot {destination}"
                },
                "straight": {
                    "default": "KjÃ¸r rett frem",
                    "name": "KjÃ¸r rett frem og inn pÃ¥ {way_name}",
                    "destination": "KjÃ¸r rett frem mot {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Fortsett rett frem"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],38:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1.",
                    "2": "2.",
                    "3": "3.",
                    "4": "4.",
                    "5": "5.",
                    "6": "6.",
                    "7": "7.",
                    "8": "8.",
                    "9": "9.",
                    "10": "10."
                },
                "direction": {
                    "north": "pÃ³Å‚noc",
                    "northeast": "pÃ³Å‚nocny wschÃ³d",
                    "east": "wschÃ³d",
                    "southeast": "poÅ‚udniowy wschÃ³d",
                    "south": "poÅ‚udnie",
                    "southwest": "poÅ‚udniowy zachÃ³d",
                    "west": "zachÃ³d",
                    "northwest": "pÃ³Å‚nocny zachÃ³d"
                },
                "modifier": {
                    "left": "lewo",
                    "right": "prawo",
                    "sharp left": "ostro w lewo",
                    "sharp right": "ostro w prawo",
                    "slight left": "Å‚agodnie w lewo",
                    "slight right": "Å‚agodnie w prawo",
                    "straight": "prosto",
                    "uturn": "zawrÃ³Ä‡"
                },
                "lanes": {
                    "xo": "Trzymaj siÄ™ prawej strony",
                    "ox": "Trzymaj siÄ™ lewej strony",
                    "xox": "Trzymaj siÄ™ Å›rodka",
                    "oxo": "Trzymaj siÄ™ lewej lub prawej strony"
                }
            },
            "modes": {
                "ferry": {
                    "default": "WeÅº prom",
                    "name": "WeÅº prom {way_name}",
                    "destination": "WeÅº prom w kierunku {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, nastÄ™pnie za {distance} {instruction_two}",
                "two linked": "{instruction_one}, nastÄ™pnie {instruction_two}",
                "one in distance": "Za {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Dojechano do miejsca docelowego {nth}",
                    "upcoming": "Dojechano do miejsca docelowego {nth}",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}"
                },
                "left": {
                    "default": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po lewej stronie"
                },
                "right": {
                    "default": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po prawej stronie"
                },
                "sharp left": {
                    "default": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po lewej stronie"
                },
                "sharp right": {
                    "default": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po prawej stronie"
                },
                "slight right": {
                    "default": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po prawej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po prawej stronie"
                },
                "slight left": {
                    "default": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "upcoming": "Dojechano do miejsca docelowego {nth}, po lewej stronie",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, po lewej stronie"
                },
                "straight": {
                    "default": "Dojechano do miejsca docelowego {nth} , prosto",
                    "upcoming": "Dojechano do miejsca docelowego {nth} , prosto",
                    "short": "Dojechano do miejsca docelowego {nth}",
                    "short-upcoming": "Dojechano do miejsca docelowego {nth}",
                    "named": "Dojechano do {waypoint_name}, prosto"
                }
            },
            "continue": {
                "default": {
                    "default": "SkrÄ™Ä‡ {modifier}",
                    "name": "SkrÄ™Ä‡ w {modifier}, aby pozostaÄ‡ na {way_name}",
                    "destination": "SkrÄ™Ä‡ {modifier} w kierunku {destination}",
                    "exit": "SkrÄ™Ä‡ {modifier} na {way_name}"
                },
                "straight": {
                    "default": "Kontynuuj prosto",
                    "name": "JedÅº dalej prosto, aby pozostaÄ‡ na {way_name}",
                    "destination": "Kontynuuj w kierunku {destination}",
                    "distance": "JedÅº dalej prosto przez {distance}",
                    "namedistance": "JedÅº dalej {way_name} przez {distance}"
                },
                "sharp left": {
                    "default": "SkrÄ™Ä‡ ostro w lewo",
                    "name": "SkrÄ™Ä‡ w lewo w ostry zakrÄ™t, aby pozostaÄ‡ na {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w lewo w kierunku {destination}"
                },
                "sharp right": {
                    "default": "SkrÄ™Ä‡ ostro w prawo",
                    "name": "SkrÄ™Ä‡ w prawo w ostry zakrÄ™t, aby pozostaÄ‡ na {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w prawo w kierunku {destination}"
                },
                "slight left": {
                    "default": "SkrÄ™Ä‡ w lewo w Å‚agodny zakrÄ™t",
                    "name": "SkrÄ™Ä‡ w lewo w Å‚agodny zakrÄ™t, aby pozostaÄ‡ na {way_name}",
                    "destination": "SkrÄ™Ä‡ w lewo w Å‚agodny zakrÄ™t na {destination}"
                },
                "slight right": {
                    "default": "SkrÄ™Ä‡ w prawo w Å‚agodny zakrÄ™t",
                    "name": "SkrÄ™Ä‡ w prawo w Å‚agodny zakrÄ™t, aby pozostaÄ‡ na {way_name}",
                    "destination": "SkrÄ™Ä‡ w prawo w Å‚agodny zakrÄ™t na {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡",
                    "name": "ZawrÃ³Ä‡ i jedÅº dalej {way_name}",
                    "destination": "ZawrÃ³Ä‡ w kierunku {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Kieruj siÄ™ {direction}",
                    "name": "Kieruj siÄ™ {direction} na {way_name}",
                    "namedistance": "Head {direction} on {way_name} for {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "SkrÄ™Ä‡ {modifier}",
                    "name": "SkrÄ™Ä‡ {modifier} na {way_name}",
                    "destination": "SkrÄ™Ä‡ {modifier} w kierunku {destination}"
                },
                "straight": {
                    "default": "Kontynuuj prosto",
                    "name": "Kontynuuj prosto na {way_name}",
                    "destination": "Kontynuuj prosto w kierunku {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡ na koÅ„cu ulicy",
                    "name": "ZawrÃ³Ä‡ na koÅ„cu ulicy na {way_name}",
                    "destination": "ZawrÃ³Ä‡ na koÅ„cu ulicy w kierunku {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "Na rozwidleniu trzymaj siÄ™ {modifier}",
                    "name": "Na rozwidleniu trzymaj siÄ™ {modifier} na {way_name}",
                    "destination": "Na rozwidleniu trzymaj siÄ™ {modifier} w kierunku {destination}"
                },
                "slight left": {
                    "default": "Na rozwidleniu trzymaj siÄ™ lewej strony",
                    "name": "Na rozwidleniu trzymaj siÄ™ lewej strony w {way_name}",
                    "destination": "Na rozwidleniu trzymaj siÄ™ lewej strony w kierunku {destination}"
                },
                "slight right": {
                    "default": "Na rozwidleniu trzymaj siÄ™ prawej strony",
                    "name": "Na rozwidleniu trzymaj siÄ™ prawej strony na {way_name}",
                    "destination": "Na rozwidleniu trzymaj siÄ™ prawej strony w kierunku {destination}"
                },
                "sharp left": {
                    "default": "Na rozwidleniu skrÄ™Ä‡ ostro w lewo",
                    "name": "SkrÄ™Ä‡ ostro w lewo w {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w lewo w kierunku {destination}"
                },
                "sharp right": {
                    "default": "Na rozwidleniu skrÄ™Ä‡ ostro w prawo",
                    "name": "SkrÄ™Ä‡ ostro w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w prawo w kierunku {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡",
                    "name": "ZawrÃ³Ä‡ na {way_name}",
                    "destination": "ZawrÃ³Ä‡ w kierunku {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "WÅ‚Ä…cz siÄ™ {modifier}",
                    "name": "WÅ‚Ä…cz siÄ™ {modifier} na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ {modifier} w kierunku {destination}"
                },
                "straight": {
                    "default": "WÅ‚Ä…cz siÄ™ prosto",
                    "name": "WÅ‚Ä…cz siÄ™ prosto na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ prosto w kierunku {destination}"
                },
                "slight left": {
                    "default": "WÅ‚Ä…cz siÄ™ z lewej strony",
                    "name": "WÅ‚Ä…cz siÄ™ z lewej strony na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ z lewej strony w kierunku {destination}"
                },
                "slight right": {
                    "default": "WÅ‚Ä…cz siÄ™ z prawej strony",
                    "name": "WÅ‚Ä…cz siÄ™ z prawej strony na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ z prawej strony w kierunku {destination}"
                },
                "sharp left": {
                    "default": "WÅ‚Ä…cz siÄ™ z lewej strony",
                    "name": "WÅ‚Ä…cz siÄ™ z lewej strony na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ z lewej strony w kierunku {destination}"
                },
                "sharp right": {
                    "default": "WÅ‚Ä…cz siÄ™ z prawej strony",
                    "name": "WÅ‚Ä…cz siÄ™ z prawej strony na {way_name}",
                    "destination": "WÅ‚Ä…cz siÄ™ z prawej strony w kierunku {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡",
                    "name": "ZawrÃ³Ä‡ na {way_name}",
                    "destination": "ZawrÃ³Ä‡ w kierunku {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Kontynuuj {modifier}",
                    "name": "Kontynuuj {modifier} na {way_name}",
                    "destination": "Kontynuuj {modifier} w kierunku {destination}"
                },
                "straight": {
                    "default": "Kontynuuj prosto",
                    "name": "Kontynuuj na {way_name}",
                    "destination": "Kontynuuj w kierunku {destination}"
                },
                "sharp left": {
                    "default": "SkrÄ™Ä‡ ostro w lewo",
                    "name": "SkrÄ™Ä‡ ostro w lewo w {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w lewo w kierunku {destination}"
                },
                "sharp right": {
                    "default": "SkrÄ™Ä‡ ostro w prawo",
                    "name": "SkrÄ™Ä‡ ostro w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ ostro w prawo w kierunku {destination}"
                },
                "slight left": {
                    "default": "Kontynuuj Å‚agodnie w lewo",
                    "name": "Kontynuuj Å‚agodnie w lewo na {way_name}",
                    "destination": "Kontynuuj Å‚agodnie w lewo w kierunku {destination}"
                },
                "slight right": {
                    "default": "Kontynuuj Å‚agodnie w prawo",
                    "name": "Kontynuuj Å‚agodnie w prawo na {way_name}",
                    "destination": "Kontynuuj Å‚agodnie w prawo w kierunku {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡",
                    "name": "ZawrÃ³Ä‡ na {way_name}",
                    "destination": "ZawrÃ³Ä‡ w kierunku {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Kontynuuj {modifier}",
                    "name": "Kontynuuj {modifier} na {way_name}",
                    "destination": "Kontynuuj {modifier} w kierunku {destination}"
                },
                "uturn": {
                    "default": "ZawrÃ³Ä‡",
                    "name": "ZawrÃ³Ä‡ na {way_name}",
                    "destination": "ZawrÃ³Ä‡ w kierunku {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "ZjedÅº",
                    "name": "WeÅº zjazd na {way_name}",
                    "destination": "WeÅº zjazd w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit}",
                    "exit_destination": "ZjedÅº zjazdem {exit} na {destination}"
                },
                "left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po lewej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po lewej stronie na {destination}"
                },
                "right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po prawej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po prawej stronie na {destination}"
                },
                "sharp left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po lewej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po lewej stronie na {destination}"
                },
                "sharp right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po prawej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po prawej stronie na {destination}"
                },
                "slight left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po lewej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po lewej stronie na {destination}"
                },
                "slight right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}",
                    "exit": "ZjedÅº zjazdem {exit} po prawej stronie",
                    "exit_destination": "ZjedÅº zjazdem {exit} po prawej stronie na {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "WeÅº zjazd",
                    "name": "WeÅº zjazd na {way_name}",
                    "destination": "WeÅº zjazd w kierunku {destination}"
                },
                "left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}"
                },
                "right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}"
                },
                "sharp left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}"
                },
                "sharp right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}"
                },
                "slight left": {
                    "default": "WeÅº zjazd po lewej",
                    "name": "WeÅº zjazd po lewej na {way_name}",
                    "destination": "WeÅº zjazd po lewej w kierunku {destination}"
                },
                "slight right": {
                    "default": "WeÅº zjazd po prawej",
                    "name": "WeÅº zjazd po prawej na {way_name}",
                    "destination": "WeÅº zjazd po prawej w kierunku {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "WjedÅº na rondo",
                        "name": "WjedÅº na rondo i skrÄ™Ä‡ na {way_name}",
                        "destination": "WjedÅº na rondo i skrÄ™Ä‡ w kierunku {destination}"
                    },
                    "name": {
                        "default": "WjedÅº na {rotary_name}",
                        "name": "WjedÅº na {rotary_name} i skrÄ™Ä‡ na {way_name}",
                        "destination": "WjedÅº na {rotary_name} i skrÄ™Ä‡ w kierunku {destination}"
                    },
                    "exit": {
                        "default": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem",
                        "name": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem na {way_name}",
                        "destination": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem w kierunku {destination}"
                    },
                    "name_exit": {
                        "default": "WjedÅº na {rotary_name} i wyjedÅº {exit_number} zjazdem",
                        "name": "WjedÅº na {rotary_name} i wyjedÅº {exit_number} zjazdem na {way_name}",
                        "destination": "WjedÅº na {rotary_name} i wyjedÅº {exit_number} zjazdem w kierunku {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem",
                        "name": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem na {way_name}",
                        "destination": "WjedÅº na rondo i wyjedÅº {exit_number} zjazdem w kierunku {destination}"
                    },
                    "default": {
                        "default": "WjedÅº na rondo",
                        "name": "WjedÅº na rondo i wyjedÅº na {way_name}",
                        "destination": "WjedÅº na rondo i wyjedÅº w kierunku {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier}",
                    "name": "{modifier} na {way_name}",
                    "destination": "{modifier} w kierunku {destination}"
                },
                "left": {
                    "default": "SkrÄ™Ä‡ w lewo",
                    "name": "SkrÄ™Ä‡ w lewo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w lewo w kierunku {destination}"
                },
                "right": {
                    "default": "SkrÄ™Ä‡ w prawo",
                    "name": "SkrÄ™Ä‡ w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w prawo w kierunku {destination}"
                },
                "straight": {
                    "default": "Kontynuuj prosto",
                    "name": "Kontynuuj prosto na {way_name}",
                    "destination": "Kontynuuj prosto w kierunku {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "{modifier}",
                    "name": "{modifier} na {way_name}",
                    "destination": "{modifier} w kierunku {destination}"
                },
                "left": {
                    "default": "SkrÄ™Ä‡ w lewo",
                    "name": "SkrÄ™Ä‡ w lewo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w lewo w kierunku {destination}"
                },
                "right": {
                    "default": "SkrÄ™Ä‡ w prawo",
                    "name": "SkrÄ™Ä‡ w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w prawo w kierunku {destination}"
                },
                "straight": {
                    "default": "Kontynuuj prosto",
                    "name": "Kontynuuj prosto na {way_name}",
                    "destination": "Kontynuuj prosto w kierunku {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "{modifier}",
                    "name": "{modifier} na {way_name}",
                    "destination": "{modifier} w kierunku {destination}"
                },
                "left": {
                    "default": "SkrÄ™Ä‡ w lewo",
                    "name": "SkrÄ™Ä‡ w lewo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w lewo w kierunku {destination}"
                },
                "right": {
                    "default": "SkrÄ™Ä‡ w prawo",
                    "name": "SkrÄ™Ä‡ w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w prawo w kierunku {destination}"
                },
                "straight": {
                    "default": "JedÅº prosto",
                    "name": "JedÅº prosto na {way_name}",
                    "destination": "JedÅº prosto w kierunku {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier}",
                    "name": "{modifier} na {way_name}",
                    "destination": "{modifier} w kierunku {destination}"
                },
                "left": {
                    "default": "SkrÄ™Ä‡ w lewo",
                    "name": "SkrÄ™Ä‡ w lewo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w lewo w kierunku {destination}"
                },
                "right": {
                    "default": "SkrÄ™Ä‡ w prawo",
                    "name": "SkrÄ™Ä‡ w prawo na {way_name}",
                    "destination": "SkrÄ™Ä‡ w prawo w kierunku {destination}"
                },
                "straight": {
                    "default": "JedÅº prosto",
                    "name": "JedÅº prosto na {way_name}",
                    "destination": "JedÅº prosto w kierunku {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Kontynuuj prosto"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],39:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Âº",
                    "2": "2Âº",
                    "3": "3Âº",
                    "4": "4Âº",
                    "5": "5Âº",
                    "6": "6Âº",
                    "7": "7Âº",
                    "8": "8Âº",
                    "9": "9Âº",
                    "10": "10Âº"
                },
                "direction": {
                    "north": "norte",
                    "northeast": "nordeste",
                    "east": "leste",
                    "southeast": "sudeste",
                    "south": "sul",
                    "southwest": "sudoeste",
                    "west": "oeste",
                    "northwest": "noroeste"
                },
                "modifier": {
                    "left": "Ã  esquerda",
                    "right": "Ã  direita",
                    "sharp left": "fechada Ã  esquerda",
                    "sharp right": "fechada Ã  direita",
                    "slight left": "suave Ã  esquerda",
                    "slight right": "suave Ã  direita",
                    "straight": "em frente",
                    "uturn": "retorno"
                },
                "lanes": {
                    "xo": "Mantenha-se Ã  direita",
                    "ox": "Mantenha-se Ã  esquerda",
                    "xox": "Mantenha-se ao centro",
                    "oxo": "Mantenha-se Ã  esquerda ou direita"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Pegue a balsa",
                    "name": "Pegue a balsa {way_name}",
                    "destination": "Pegue a balsa sentido {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, entÃ£o, em {distance}, {instruction_two}",
                "two linked": "{instruction_one}, entÃ£o {instruction_two}",
                "one in distance": "Em {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "saÃ­da {exit}"
            },
            "arrive": {
                "default": {
                    "default": "VocÃª chegou ao seu {nth} destino",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou a {waypoint_name}"
                },
                "left": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  esquerda",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  esquerda"
                },
                "right": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  direita",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  direita"
                },
                "sharp left": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  esquerda",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  esquerda"
                },
                "sharp right": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  direita",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  direita"
                },
                "slight right": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  direita",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  direita"
                },
                "slight left": {
                    "default": "VocÃª chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "VocÃª chegarÃ¡ ao seu {nth} destino, Ã  esquerda",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "VocÃª chegou {waypoint_name}, Ã  esquerda"
                },
                "straight": {
                    "default": "VocÃª chegou ao seu {nth} destino, em frente",
                    "upcoming": "VocÃª vai chegar ao seu {nth} destino, em frente",
                    "short": "VocÃª chegou",
                    "short-upcoming": "VocÃª vai chegar",
                    "named": "You have arrived at {waypoint_name}, straight ahead"
                }
            },
            "continue": {
                "default": {
                    "default": "Vire {modifier}",
                    "name": "Vire {modifier} para manter-se na {way_name}",
                    "destination": "Vire {modifier} sentido {destination}",
                    "exit": "Vire {modifier} em {way_name}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente para manter-se na {way_name}",
                    "destination": "Continue em direÃ§Ã£o Ã  {destination}",
                    "distance": "Continue em frente por {distance}",
                    "namedistance": "Continue na {way_name} por {distance}"
                },
                "sharp left": {
                    "default": "FaÃ§a uma curva fechada a esquerda",
                    "name": "FaÃ§a uma curva fechada a esquerda para manter-se na {way_name}",
                    "destination": "FaÃ§a uma curva fechada a esquerda sentido {destination}"
                },
                "sharp right": {
                    "default": "FaÃ§a uma curva fechada a direita",
                    "name": "FaÃ§a uma curva fechada a direita para manter-se na {way_name}",
                    "destination": "FaÃ§a uma curva fechada a direita sentido {destination}"
                },
                "slight left": {
                    "default": "FaÃ§a uma curva suave a esquerda",
                    "name": "FaÃ§a uma curva suave a esquerda para manter-se na {way_name}",
                    "destination": "FaÃ§a uma curva suave a esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "FaÃ§a uma curva suave a direita",
                    "name": "FaÃ§a uma curva suave a direita para manter-se na {way_name}",
                    "destination": "FaÃ§a uma curva suave a direita em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno",
                    "name": "FaÃ§a o retorno e continue em {way_name}",
                    "destination": "FaÃ§a o retorno sentido {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Siga {direction}",
                    "name": "Siga {direction} em {way_name}",
                    "namedistance": "Siga {direction} na {way_name} por {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Vire {modifier}",
                    "name": "Vire {modifier} em {way_name}",
                    "destination": "Vire {modifier} sentido {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente em {way_name}",
                    "destination": "Continue em frente sentido {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno no fim da rua",
                    "name": "FaÃ§a o retorno em {way_name} no fim da rua",
                    "destination": "FaÃ§a o retorno sentido {destination} no fim da rua"
                }
            },
            "fork": {
                "default": {
                    "default": "Mantenha-se {modifier} na bifurcaÃ§Ã£o",
                    "name": "Mantenha-se {modifier} na bifurcaÃ§Ã£o em {way_name}",
                    "destination": "Mantenha-se {modifier} na bifurcaÃ§Ã£o sentido {destination}"
                },
                "slight left": {
                    "default": "Mantenha-se Ã  esquerda na bifurcaÃ§Ã£o",
                    "name": "Mantenha-se Ã  esquerda na bifurcaÃ§Ã£o em {way_name}",
                    "destination": "Mantenha-se Ã  esquerda na bifurcaÃ§Ã£o sentido {destination}"
                },
                "slight right": {
                    "default": "Mantenha-se Ã  direita na bifurcaÃ§Ã£o",
                    "name": "Mantenha-se Ã  direita na bifurcaÃ§Ã£o em {way_name}",
                    "destination": "Mantenha-se Ã  direita na bifurcaÃ§Ã£o sentido {destination}"
                },
                "sharp left": {
                    "default": "FaÃ§a uma curva fechada Ã  esquerda na bifurcaÃ§Ã£o",
                    "name": "FaÃ§a uma curva fechada Ã  esquerda em {way_name}",
                    "destination": "FaÃ§a uma curva fechada Ã  esquerda sentido {destination}"
                },
                "sharp right": {
                    "default": "FaÃ§a uma curva fechada Ã  direita na bifurcaÃ§Ã£o",
                    "name": "FaÃ§a uma curva fechada Ã  direita em {way_name}",
                    "destination": "FaÃ§a uma curva fechada Ã  direita sentido {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno",
                    "name": "FaÃ§a o retorno em {way_name}",
                    "destination": "FaÃ§a o retorno sentido {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Entre {modifier}",
                    "name": "Entre {modifier} na {way_name}",
                    "destination": "Entre {modifier} em direÃ§Ã£o Ã  {destination}"
                },
                "straight": {
                    "default": "Mesclar",
                    "name": "Entre reto na {way_name}",
                    "destination": "Entre reto em direÃ§Ã£o Ã  {destination}"
                },
                "slight left": {
                    "default": "Entre Ã  esquerda",
                    "name": "Entre Ã  esquerda na {way_name}",
                    "destination": "Entre Ã  esquerda em direÃ§Ã£o Ã  {destination}"
                },
                "slight right": {
                    "default": "Entre Ã  direita",
                    "name": "Entre Ã  direita na {way_name}",
                    "destination": "Entre Ã  direita em direÃ§Ã£o Ã  {destination}"
                },
                "sharp left": {
                    "default": "Entre Ã  esquerda",
                    "name": "Entre Ã  esquerda na {way_name}",
                    "destination": "Entre Ã  esquerda em direÃ§Ã£o Ã  {destination}"
                },
                "sharp right": {
                    "default": "Entre Ã  direita",
                    "name": "Entre Ã  direita na {way_name}",
                    "destination": "Entre Ã  direita em direÃ§Ã£o Ã  {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno",
                    "name": "FaÃ§a o retorno em {way_name}",
                    "destination": "FaÃ§a o retorno sentido {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} em {way_name}",
                    "destination": "Continue {modifier} sentido {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em {way_name}",
                    "destination": "Continue em direÃ§Ã£o Ã  {destination}"
                },
                "sharp left": {
                    "default": "FaÃ§a uma curva fechada Ã  esquerda",
                    "name": "FaÃ§a uma curva fechada Ã  esquerda em {way_name}",
                    "destination": "FaÃ§a uma curva fechada Ã  esquerda sentido {destination}"
                },
                "sharp right": {
                    "default": "FaÃ§a uma curva fechada Ã  direita",
                    "name": "FaÃ§a uma curva fechada Ã  direita em {way_name}",
                    "destination": "FaÃ§a uma curva fechada Ã  direita sentido {destination}"
                },
                "slight left": {
                    "default": "Continue ligeiramente Ã  esquerda",
                    "name": "Continue ligeiramente Ã  esquerda em {way_name}",
                    "destination": "Continue ligeiramente Ã  esquerda sentido {destination}"
                },
                "slight right": {
                    "default": "Continue ligeiramente Ã  direita",
                    "name": "Continue ligeiramente Ã  direita em {way_name}",
                    "destination": "Continue ligeiramente Ã  direita sentido {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno",
                    "name": "FaÃ§a o retorno em {way_name}",
                    "destination": "FaÃ§a o retorno sentido {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} em {way_name}",
                    "destination": "Continue {modifier} sentido {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a o retorno",
                    "name": "FaÃ§a o retorno em {way_name}",
                    "destination": "FaÃ§a o retorno sentido {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Pegue a rampa",
                    "name": "Pegue a rampa em {way_name}",
                    "destination": "Pegue a rampa sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit}",
                    "exit_destination": "Pegue a saÃ­da {exit} em direÃ§Ã£o Ã  {destination}"
                },
                "left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Pegue a saÃ­da {exit}  Ã  esquerda em direÃ§Ã£o Ã  {destination}"
                },
                "right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  direita",
                    "exit_destination": "Pegue a saÃ­da {exit} Ã  direita em direÃ§Ã£o Ã  {destination}"
                },
                "sharp left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Pegue a saÃ­da {exit}  Ã  esquerda em direÃ§Ã£o Ã  {destination}"
                },
                "sharp right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  direita",
                    "exit_destination": "Pegue a saÃ­da {exit} Ã  direita em direÃ§Ã£o Ã  {destination}"
                },
                "slight left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Pegue a saÃ­da {exit}  Ã  esquerda em direÃ§Ã£o Ã  {destination}"
                },
                "slight right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentido {destination}",
                    "exit": "Pegue a saÃ­da {exit} Ã  direita",
                    "exit_destination": "Pegue a saÃ­da {exit} Ã  direita em direÃ§Ã£o Ã  {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Pegue a rampa",
                    "name": "Pegue a rampa em {way_name}",
                    "destination": "Pegue a rampa sentido {destination}"
                },
                "left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}"
                },
                "right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentid {destination}"
                },
                "sharp left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}"
                },
                "sharp right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentido {destination}"
                },
                "slight left": {
                    "default": "Pegue a rampa Ã  esquerda",
                    "name": "Pegue a rampa Ã  esquerda em {way_name}",
                    "destination": "Pegue a rampa Ã  esquerda sentido {destination}"
                },
                "slight right": {
                    "default": "Pegue a rampa Ã  direita",
                    "name": "Pegue a rampa Ã  direita em {way_name}",
                    "destination": "Pegue a rampa Ã  direita sentido {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Entre na rotatÃ³ria",
                        "name": "Entre na rotatÃ³ria e saia na {way_name}",
                        "destination": "Entre na rotatÃ³ria e saia sentido {destination}"
                    },
                    "name": {
                        "default": "Entre em {rotary_name}",
                        "name": "Entre em {rotary_name} e saia em {way_name}",
                        "destination": "Entre em {rotary_name} e saia sentido {destination}"
                    },
                    "exit": {
                        "default": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da",
                        "name": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da na {way_name}",
                        "destination": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da sentido {destination}"
                    },
                    "name_exit": {
                        "default": "Entre em {rotary_name} e saia na {exit_number} saÃ­da",
                        "name": "Entre em {rotary_name} e saia na {exit_number} saÃ­da em {way_name}",
                        "destination": "Entre em {rotary_name} e saia na {exit_number} saÃ­da sentido {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da",
                        "name": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da na {way_name}",
                        "destination": "Entre na rotatÃ³ria e pegue a {exit_number} saÃ­da sentido {destination}"
                    },
                    "default": {
                        "default": "Entre na rotatÃ³ria",
                        "name": "Entre na rotatÃ³ria e saia na {way_name}",
                        "destination": "Entre na rotatÃ³ria e saia sentido {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Siga {modifier}",
                    "name": "Siga {modifier} em {way_name}",
                    "destination": "Siga {modifier} sentido {destination}"
                },
                "left": {
                    "default": "Vire Ã  esquerda",
                    "name": "Vire Ã  esquerda em {way_name}",
                    "destination": "Vire Ã  esquerda sentido {destination}"
                },
                "right": {
                    "default": "Vire Ã  direita",
                    "name": "Vire Ã  direita em {way_name}",
                    "destination": "Vire Ã  direita sentido {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente em {way_name}",
                    "destination": "Continue em frente sentido {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Saia da rotatÃ³ria",
                    "name": "Exit the traffic circle onto {way_name}",
                    "destination": "Exit the traffic circle towards {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Saia da rotatÃ³ria",
                    "name": "Exit the traffic circle onto {way_name}",
                    "destination": "Exit the traffic circle towards {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Siga {modifier}",
                    "name": "Siga {modifier} em {way_name}",
                    "destination": "Siga {modifier} sentido {destination}"
                },
                "left": {
                    "default": "Vire Ã  esquerda",
                    "name": "Vire Ã  esquerda em {way_name}",
                    "destination": "Vire Ã  esquerda sentido {destination}"
                },
                "right": {
                    "default": "Vire Ã  direita",
                    "name": "Vire Ã  direita em {way_name}",
                    "destination": "Vire Ã  direita sentido {destination}"
                },
                "straight": {
                    "default": "Siga em frente",
                    "name": "Siga em frente em {way_name}",
                    "destination": "Siga em frente sentido {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Continue em frente"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],40:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Âº",
                    "2": "2Âº",
                    "3": "3Âº",
                    "4": "4Âº",
                    "5": "5Âº",
                    "6": "6Âº",
                    "7": "7Âº",
                    "8": "8Âº",
                    "9": "9Âº",
                    "10": "10Âº"
                },
                "direction": {
                    "north": "norte",
                    "northeast": "nordeste",
                    "east": "este",
                    "southeast": "sudeste",
                    "south": "sul",
                    "southwest": "sudoeste",
                    "west": "oeste",
                    "northwest": "noroeste"
                },
                "modifier": {
                    "left": "Ã  esquerda",
                    "right": "Ã  direita",
                    "sharp left": "acentuadamente Ã  esquerda",
                    "sharp right": "acentuadamente Ã  direita",
                    "slight left": "ligeiramente Ã  esquerda",
                    "slight right": "ligeiramente Ã  direita",
                    "straight": "em frente",
                    "uturn": "inversÃ£o de marcha"
                },
                "lanes": {
                    "xo": "Mantenha-se Ã  direita",
                    "ox": "Mantenha-se Ã  esquerda",
                    "xox": "Mantenha-se ao meio",
                    "oxo": "Mantenha-se Ã  esquerda ou Ã  direita"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Apanhe o ferry",
                    "name": "Apanhe o ferry {way_name}",
                    "destination": "Apanhe o ferry para {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, depois, a {distance}, {instruction_two}",
                "two linked": "{instruction_one}, depois {instruction_two}",
                "one in distance": "A {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "saÃ­da {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Chegou ao seu {nth} destino",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}"
                },
                "left": {
                    "default": "Chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  esquerda",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  esquerda"
                },
                "right": {
                    "default": "Chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  direita",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  direita"
                },
                "sharp left": {
                    "default": "Chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  esquerda",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  esquerda"
                },
                "sharp right": {
                    "default": "Chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  direita",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  direita"
                },
                "slight right": {
                    "default": "Chegou ao seu {nth} destino, Ã  direita",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  direita",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  direita"
                },
                "slight left": {
                    "default": "Chegou ao seu {nth} destino, Ã  esquerda",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, Ã  esquerda",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, Ã  esquerda"
                },
                "straight": {
                    "default": "Chegou ao seu {nth} destino, em frente",
                    "upcoming": "EstÃ¡ a chegar ao seu {nth} destino, em frente",
                    "short": "Chegou",
                    "short-upcoming": "EstÃ¡ a chegar",
                    "named": "Chegou a {waypoint_name}, em frente"
                }
            },
            "continue": {
                "default": {
                    "default": "Vire {modifier}",
                    "name": "Vire {modifier} para se manter em {way_name}",
                    "destination": "Vire {modifier} em direÃ§Ã£o a {destination}",
                    "exit": "Vire {modifier} para {way_name}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente para se manter em {way_name}",
                    "destination": "Continue em direÃ§Ã£o a {destination}",
                    "distance": "Continue em frente por {distance}",
                    "namedistance": "Continue em {way_name} por {distance}"
                },
                "sharp left": {
                    "default": "Vire acentuadamente Ã  esquerda",
                    "name": "Vire acentuadamente Ã  esquerda para se manter em {way_name}",
                    "destination": "Vire acentuadamente Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "sharp right": {
                    "default": "Vire acentuadamente Ã  direita",
                    "name": "Vire acentuadamente Ã  direita para se manter em {way_name}",
                    "destination": "Vire acentuadamente Ã  direita em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Vire ligeiramente Ã  esquerda",
                    "name": "Vire ligeiramente Ã  esquerda para se manter em {way_name}",
                    "destination": "Vire ligeiramente Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Vire ligeiramente Ã  direita",
                    "name": "Vire ligeiramente Ã  direita para se manter em {way_name}",
                    "destination": "Vire ligeiramente Ã  direita em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a inversÃ£o de marcha",
                    "name": "FaÃ§a inversÃ£o de marcha e continue em {way_name}",
                    "destination": "FaÃ§a inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Dirija-se para {direction}",
                    "name": "Dirija-se para {direction} em {way_name}",
                    "namedistance": "Dirija-se para {direction} em {way_name} por {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Vire {modifier}",
                    "name": "Vire {modifier} para {way_name}",
                    "destination": "Vire {modifier} em direÃ§Ã£o a {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente para {way_name}",
                    "destination": "Continue em frente em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "No final da estrada faÃ§a uma inversÃ£o de marcha",
                    "name": "No final da estrada faÃ§a uma inversÃ£o de marcha para {way_name} ",
                    "destination": "No final da estrada faÃ§a uma inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "Na bifurcaÃ§Ã£o mantenha-se {modifier}",
                    "name": "Mantenha-se {modifier} para {way_name}",
                    "destination": "Mantenha-se {modifier} em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Na bifurcaÃ§Ã£o mantenha-se Ã  esquerda",
                    "name": "Mantenha-se Ã  esquerda para {way_name}",
                    "destination": "Mantenha-se Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Na bifurcaÃ§Ã£o mantenha-se Ã  direita",
                    "name": "Mantenha-se Ã  direita para {way_name}",
                    "destination": "Mantenha-se Ã  direita em direÃ§Ã£o a {destination}"
                },
                "sharp left": {
                    "default": "Na bifurcaÃ§Ã£o vire acentuadamente Ã  esquerda",
                    "name": "Vire acentuadamente Ã  esquerda para {way_name}",
                    "destination": "Vire acentuadamente Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "sharp right": {
                    "default": "Na bifurcaÃ§Ã£o vire acentuadamente Ã  direita",
                    "name": "Vire acentuadamente Ã  direita para {way_name}",
                    "destination": "Vire acentuadamente Ã  direita em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a inversÃ£o de marcha",
                    "name": "FaÃ§a inversÃ£o de marcha para {way_name}",
                    "destination": "FaÃ§a inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Una-se ao trÃ¡fego {modifier}",
                    "name": "Una-se ao trÃ¡fego {modifier} para {way_name}",
                    "destination": "Una-se ao trÃ¡fego {modifier} em direÃ§Ã£o a {destination}"
                },
                "straight": {
                    "default": "Una-se ao trÃ¡fego",
                    "name": " Una-se ao trÃ¡fego para {way_name}",
                    "destination": "Una-se ao trÃ¡fego em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Una-se ao trÃ¡fego Ã  esquerda",
                    "name": "Una-se ao trÃ¡fego Ã  esquerda para {way_name}",
                    "destination": "Una-se ao trÃ¡fego Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Una-se ao trÃ¡fego Ã  direita",
                    "name": "Una-se ao trÃ¡fego Ã  direita para {way_name}",
                    "destination": "Una-se ao trÃ¡fego Ã  direita em direÃ§Ã£o a {destination}"
                },
                "sharp left": {
                    "default": "Una-se ao trÃ¡fego Ã  esquerda",
                    "name": "Una-se ao trÃ¡fego Ã  esquerda para {way_name}",
                    "destination": "Una-se ao trÃ¡fego Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "sharp right": {
                    "default": "Una-se ao trÃ¡fego Ã  direita",
                    "name": "Una-se ao trÃ¡fego Ã  direita para {way_name}",
                    "destination": "Una-se ao trÃ¡fego Ã  direita em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a inversÃ£o de marcha",
                    "name": "FaÃ§a inversÃ£o de marcha para {way_name}",
                    "destination": "FaÃ§a inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} para {way_name}",
                    "destination": "Continue {modifier} em direÃ§Ã£o a {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue para {way_name}",
                    "destination": "Continue em direÃ§Ã£o a {destination}"
                },
                "sharp left": {
                    "default": "Vire acentuadamente Ã  esquerda",
                    "name": "Vire acentuadamente Ã  esquerda para {way_name}",
                    "destination": "Vire acentuadamente Ã  esquerda em direÃ§Ã£o a{destination}"
                },
                "sharp right": {
                    "default": "Vire acentuadamente Ã  direita",
                    "name": "Vire acentuadamente Ã  direita para {way_name}",
                    "destination": "Vire acentuadamente Ã  direita em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Continue ligeiramente Ã  esquerda",
                    "name": "Continue ligeiramente Ã  esquerda para {way_name}",
                    "destination": "Continue ligeiramente Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Continue ligeiramente Ã  direita",
                    "name": "Continue ligeiramente Ã  direita para {way_name}",
                    "destination": "Continue ligeiramente Ã  direita em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a inversÃ£o de marcha",
                    "name": "FaÃ§a inversÃ£o de marcha para {way_name}",
                    "destination": "FaÃ§a inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Continue {modifier}",
                    "name": "Continue {modifier} para {way_name}",
                    "destination": "Continue {modifier} em direÃ§Ã£o a {destination}"
                },
                "uturn": {
                    "default": "FaÃ§a inversÃ£o de marcha",
                    "name": "FaÃ§a inversÃ£o de marcha para {way_name}",
                    "destination": "FaÃ§a inversÃ£o de marcha em direÃ§Ã£o a {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Saia na saÃ­da",
                    "name": "Saia na saÃ­da para {way_name}",
                    "destination": "Saia na saÃ­da em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit}",
                    "exit_destination": "Saia na saÃ­da {exit} em direÃ§Ã£o a {destination}"
                },
                "left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  direita",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  direita em direÃ§Ã£o a {destination}"
                },
                "sharp left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "sharp right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  direita",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  direita em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  esquerda",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}",
                    "exit": "Saia na saÃ­da {exit} Ã  direita",
                    "exit_destination": "Saia na saÃ­da {exit} Ã  direita em direÃ§Ã£o a {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Saia na saÃ­da",
                    "name": "Saia na saÃ­da para {way_name}",
                    "destination": "Saia na saÃ­da em direÃ§Ã£o a {destination}"
                },
                "left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}"
                },
                "sharp left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "sharp right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}"
                },
                "slight left": {
                    "default": "Saia na saÃ­da Ã  esquerda",
                    "name": "Saia na saÃ­da Ã  esquerda para {way_name}",
                    "destination": "Saia na saÃ­da Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "slight right": {
                    "default": "Saia na saÃ­da Ã  direita",
                    "name": "Saia na saÃ­da Ã  direita para {way_name}",
                    "destination": "Saia na saÃ­da Ã  direita em direÃ§Ã£o a {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Entre na rotunda",
                        "name": "Entre na rotunda e saia para {way_name}",
                        "destination": "Entre na rotunda e saia em direÃ§Ã£o a {destination}"
                    },
                    "name": {
                        "default": "Entre em {rotary_name}",
                        "name": "Entre em {rotary_name} e saia para {way_name}",
                        "destination": "Entre em {rotary_name} e saia em direÃ§Ã£o a {destination}"
                    },
                    "exit": {
                        "default": "Entre na rotunda e saia na saÃ­da {exit_number}",
                        "name": "Entre na rotunda e saia na saÃ­da {exit_number} para {way_name}",
                        "destination": "Entre na rotunda e saia na saÃ­da {exit_number} em direÃ§Ã£o a {destination}"
                    },
                    "name_exit": {
                        "default": "Entre em {rotary_name} e saia na saÃ­da {exit_number}",
                        "name": "Entre em {rotary_name} e saia na saÃ­da {exit_number} para {way_name}",
                        "destination": "Entre em{rotary_name} e saia na saÃ­da {exit_number} em direÃ§Ã£o a {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Entre na rotunda e saia na saÃ­da {exit_number}",
                        "name": "Entre na rotunda e saia na saÃ­da {exit_number} para {way_name}",
                        "destination": "Entre na rotunda e saia na saÃ­da {exit_number} em direÃ§Ã£o a {destination}"
                    },
                    "default": {
                        "default": "Entre na rotunda",
                        "name": "Entre na rotunda e saia para {way_name}",
                        "destination": "Entre na rotunda e saia em direÃ§Ã£o a {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Siga {modifier}",
                    "name": "Siga {modifier} para {way_name}",
                    "destination": "Siga {modifier} em direÃ§Ã£o a {destination}"
                },
                "left": {
                    "default": "Vire Ã  esquerda",
                    "name": "Vire Ã  esquerda para {way_name}",
                    "destination": "Vire Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "right": {
                    "default": "Vire Ã  direita",
                    "name": "Vire Ã  direita para {way_name}",
                    "destination": "Vire Ã  direita em direÃ§Ã£o a {destination}"
                },
                "straight": {
                    "default": "Continue em frente",
                    "name": "Continue em frente para {way_name}",
                    "destination": "Continue em frente em direÃ§Ã£o a {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Saia da rotunda",
                    "name": "Saia da rotunda para {way_name}",
                    "destination": "Saia da rotunda em direÃ§Ã£o a {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Saia da rotunda",
                    "name": "Saia da rotunda para {way_name}",
                    "destination": "Saia da rotunda em direÃ§Ã£o a {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Siga {modifier}",
                    "name": "Siga {modifier} para{way_name}",
                    "destination": "Siga {modifier} em direÃ§Ã£o a {destination}"
                },
                "left": {
                    "default": "Vire Ã  esquerda",
                    "name": "Vire Ã  esquerda para {way_name}",
                    "destination": "Vire Ã  esquerda em direÃ§Ã£o a {destination}"
                },
                "right": {
                    "default": "Vire Ã  direita",
                    "name": "Vire Ã  direita para {way_name}",
                    "destination": "Vire Ã  direita em direÃ§Ã£o a {destination}"
                },
                "straight": {
                    "default": "VÃ¡ em frente",
                    "name": "VÃ¡ em frente para {way_name}",
                    "destination": "VÃ¡ em frente em direÃ§Ã£o a {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Continue em frente"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],41:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "prima",
                    "2": "a doua",
                    "3": "a treia",
                    "4": "a patra",
                    "5": "a cincea",
                    "6": "a È™asea",
                    "7": "a È™aptea",
                    "8": "a opta",
                    "9": "a noua",
                    "10": "a zecea"
                },
                "direction": {
                    "north": "nord",
                    "northeast": "nord-est",
                    "east": "est",
                    "southeast": "sud-est",
                    "south": "sud",
                    "southwest": "sud-vest",
                    "west": "vest",
                    "northwest": "nord-vest"
                },
                "modifier": {
                    "left": "stÃ¢nga",
                    "right": "dreapta",
                    "sharp left": "puternic stÃ¢nga",
                    "sharp right": "puternic dreapta",
                    "slight left": "uÈ™or stÃ¢nga",
                    "slight right": "uÈ™or dreapta",
                    "straight": "Ã®nainte",
                    "uturn": "Ã®ntoarcere"
                },
                "lanes": {
                    "xo": "ÈšineÈ›i stÃ¢nga",
                    "ox": "ÈšineÈ›i dreapta",
                    "xox": "ÈšineÈ›i pe mijloc",
                    "oxo": "ÈšineÈ›i pe laterale"
                }
            },
            "modes": {
                "ferry": {
                    "default": "LuaÈ›i feribotul",
                    "name": "LuaÈ›i feribotul {way_name}",
                    "destination": "LuaÈ›i feribotul spre {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, apoi Ã®n {distance}, {instruction_two}",
                "two linked": "{instruction_one} apoi {instruction_two}",
                "one in distance": "ÃŽn {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "ieÈ™irea {exit}"
            },
            "arrive": {
                "default": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}"
                },
                "left": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe stÃ¢nga"
                },
                "right": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe dreapta"
                },
                "sharp left": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe stÃ¢nga"
                },
                "sharp right": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe dreapta"
                },
                "slight right": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe dreapta",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe dreapta"
                },
                "slight left": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, pe stÃ¢nga",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, pe stÃ¢nga"
                },
                "straight": {
                    "default": "AÈ›i ajuns la {nth} destinaÈ›ie, Ã®n faÈ›Äƒ",
                    "upcoming": "AÈ›i ajuns la {nth} destinaÈ›ie, Ã®n faÈ›Äƒ",
                    "short": "AÈ›i ajuns",
                    "short-upcoming": "VeÈ›i ajunge",
                    "named": "AÈ›i ajuns {waypoint_name}, Ã®n faÈ›Äƒ"
                }
            },
            "continue": {
                "default": {
                    "default": "ViraÈ›i {modifier}",
                    "name": "ViraÈ›i {modifier} pe {way_name}",
                    "destination": "ViraÈ›i {modifier} spre {destination}",
                    "exit": "ViraÈ›i {modifier} pe {way_name}"
                },
                "straight": {
                    "default": "MergeÈ›i Ã®nainte",
                    "name": "MergeÈ›i Ã®nainte pe {way_name}",
                    "destination": "ContinuaÈ›i spre {destination}",
                    "distance": "MergeÈ›i Ã®nainte pentru {distance}",
                    "namedistance": "ContinuaÈ›i pe {way_name} pentru {distance}"
                },
                "sharp left": {
                    "default": "ViraÈ›i puternic la stÃ¢nga",
                    "name": "ViraÈ›i puternic la stÃ¢nga pe {way_name}",
                    "destination": "ViraÈ›i puternic la stÃ¢nga spre {destination}"
                },
                "sharp right": {
                    "default": "ViraÈ›i puternic la dreapta",
                    "name": "ViraÈ›i puternic la dreapta pe {way_name}",
                    "destination": "ViraÈ›i puternic la dreapta spre {destination}"
                },
                "slight left": {
                    "default": "ViraÈ›i uÈ™or la stÃ¢nga",
                    "name": "ViraÈ›i uÈ™or la stÃ¢nga pe {way_name}",
                    "destination": "ViraÈ›i uÈ™or la stÃ¢nga spre {destination}"
                },
                "slight right": {
                    "default": "ViraÈ›i uÈ™or la dreapta",
                    "name": "ViraÈ›i uÈ™or la dreapta pe {way_name}",
                    "destination": "ViraÈ›i uÈ™or la dreapta spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ",
                    "name": "ÃŽntoarceÈ›i-vÄƒ È™i continuaÈ›i pe {way_name}",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "MergeÈ›i spre {direction}",
                    "name": "MergeÈ›i spre {direction} pe {way_name}",
                    "namedistance": "MergeÈ›i spre {direction} pe {way_name} pentru {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "ViraÈ›i {modifier}",
                    "name": "ViraÈ›i {modifier} pe {way_name}",
                    "destination": "ViraÈ›i {modifier} spre {destination}"
                },
                "straight": {
                    "default": "ContinuaÈ›i Ã®nainte",
                    "name": "ContinuaÈ›i Ã®nainte pe {way_name}",
                    "destination": "ContinuaÈ›i Ã®nainte spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ la sfÃ¢rÈ™itul drumului",
                    "name": "ÃŽntoarceÈ›i-vÄƒ pe {way_name} la sfÃ¢rÈ™itul drumului",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination} la sfÃ¢rÈ™itul drumului"
                }
            },
            "fork": {
                "default": {
                    "default": "ÈšineÈ›i {modifier} la bifurcaÈ›ie",
                    "name": "ÈšineÈ›i {modifier} la bifurcaÈ›ie pe {way_name}",
                    "destination": "ÈšineÈ›i {modifier} la bifurcaÈ›ie spre {destination}"
                },
                "slight left": {
                    "default": "ÈšineÈ›i pe stÃ¢nga la bifurcaÈ›ie",
                    "name": "ÈšineÈ›i pe stÃ¢nga la bifurcaÈ›ie pe {way_name}",
                    "destination": "ÈšineÈ›i pe stÃ¢nga la bifurcaÈ›ie spre {destination}"
                },
                "slight right": {
                    "default": "ÈšineÈ›i pe dreapta la bifurcaÈ›ie",
                    "name": "ÈšineÈ›i pe dreapta la bifurcaÈ›ie pe {way_name}",
                    "destination": "ÈšineÈ›i pe dreapta la bifurcaÈ›ie spre {destination}"
                },
                "sharp left": {
                    "default": "ViraÈ›i puternic stÃ¢nga la bifurcaÈ›ie",
                    "name": "ViraÈ›i puternic stÃ¢nga la bifurcaÈ›ie pe {way_name}",
                    "destination": "ViraÈ›i puternic stÃ¢nga la bifurcaÈ›ie spre {destination}"
                },
                "sharp right": {
                    "default": "ViraÈ›i puternic dreapta la bifurcaÈ›ie",
                    "name": "ViraÈ›i puternic dreapta la bifurcaÈ›ie pe {way_name}",
                    "destination": "ViraÈ›i puternic dreapta la bifurcaÈ›ie spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ",
                    "name": "ÃŽntoarceÈ›i-vÄƒ pe {way_name}",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "IntraÈ›i Ã®n {modifier}",
                    "name": "IntraÈ›i Ã®n {modifier} pe {way_name}",
                    "destination": "IntraÈ›i Ã®n {modifier} spre {destination}"
                },
                "straight": {
                    "default": "IntraÈ›i",
                    "name": "IntraÈ›i pe {way_name}",
                    "destination": "IntraÈ›i spre {destination}"
                },
                "slight left": {
                    "default": "IntraÈ›i Ã®n stÃ¢nga",
                    "name": "IntraÈ›i Ã®n stÃ¢nga pe {way_name}",
                    "destination": "IntraÈ›i Ã®n stÃ¢nga spre {destination}"
                },
                "slight right": {
                    "default": "IntraÈ›i Ã®n dreapta",
                    "name": "IntraÈ›i Ã®n dreapta pe {way_name}",
                    "destination": "IntraÈ›i Ã®n dreapta spre {destination}"
                },
                "sharp left": {
                    "default": "IntraÈ›i Ã®n stÃ¢nga",
                    "name": "IntraÈ›i Ã®n stÃ¢nga pe {way_name}",
                    "destination": "IntraÈ›i Ã®n stÃ¢nga spre {destination}"
                },
                "sharp right": {
                    "default": "IntraÈ›i Ã®n dreapta",
                    "name": "IntraÈ›i Ã®n dreapta pe {way_name}",
                    "destination": "IntraÈ›i Ã®n dreapta spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ",
                    "name": "ÃŽntoarceÈ›i-vÄƒ pe {way_name}",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "ContinuaÈ›i {modifier}",
                    "name": "ContinuaÈ›i {modifier} pe {way_name}",
                    "destination": "ContinuaÈ›i {modifier} spre {destination}"
                },
                "straight": {
                    "default": "ContinuaÈ›i Ã®nainte",
                    "name": "ContinuaÈ›i pe {way_name}",
                    "destination": "ContinuaÈ›i spre {destination}"
                },
                "sharp left": {
                    "default": "ViraÈ›i puternic la stÃ¢nga",
                    "name": "ViraÈ›i puternic la stÃ¢nga pe {way_name}",
                    "destination": "ViraÈ›i puternic la stÃ¢nga spre {destination}"
                },
                "sharp right": {
                    "default": "ViraÈ›i puternic la dreapta",
                    "name": "ViraÈ›i puternic la dreapta pe {way_name}",
                    "destination": "ViraÈ›i puternic la dreapta spre {destination}"
                },
                "slight left": {
                    "default": "ContinuaÈ›i uÈ™or la stÃ¢nga",
                    "name": "ContinuaÈ›i uÈ™or la stÃ¢nga pe {way_name}",
                    "destination": "ContinuaÈ›i uÈ™or la stÃ¢nga spre {destination}"
                },
                "slight right": {
                    "default": "ContinuaÈ›i uÈ™or la dreapta",
                    "name": "ContinuaÈ›i uÈ™or la dreapta pe {way_name}",
                    "destination": "ContinuaÈ›i uÈ™or la dreapta spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ",
                    "name": "ÃŽntoarceÈ›i-vÄƒ pe {way_name}",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "ContinuaÈ›i {modifier}",
                    "name": "ContinuaÈ›i {modifier} pe {way_name}",
                    "destination": "ContinuaÈ›i {modifier} spre {destination}"
                },
                "uturn": {
                    "default": "ÃŽntoarceÈ›i-vÄƒ",
                    "name": "ÃŽntoarceÈ›i-vÄƒ pe {way_name}",
                    "destination": "ÃŽntoarceÈ›i-vÄƒ spre {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "UrmaÈ›i breteaua",
                    "name": "UrmaÈ›i breteaua pe {way_name}",
                    "destination": "UrmaÈ›i breteaua spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit}",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} spre {destination}"
                },
                "left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga spre {destination}"
                },
                "right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe dreapta",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe dreapta spre {destination}"
                },
                "sharp left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga spre {destination}"
                },
                "sharp right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe dreapta",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe dreapta spre {destination}"
                },
                "slight left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe stÃ¢nga spre {destination}"
                },
                "slight right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}",
                    "exit": "UrmaÈ›i ieÈ™irea {exit} pe dreapta",
                    "exit_destination": "UrmaÈ›i ieÈ™irea {exit} pe dreapta spre {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "UrmaÈ›i breteaua de intrare",
                    "name": "UrmaÈ›i breteaua pe {way_name}",
                    "destination": "UrmaÈ›i breteaua spre {destination}"
                },
                "left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}"
                },
                "right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}"
                },
                "sharp left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}"
                },
                "sharp right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}"
                },
                "slight left": {
                    "default": "UrmaÈ›i breteaua din stÃ¢nga",
                    "name": "UrmaÈ›i breteaua din stÃ¢nga pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din stÃ¢nga spre {destination}"
                },
                "slight right": {
                    "default": "UrmaÈ›i breteaua din dreapta",
                    "name": "UrmaÈ›i breteaua din dreapta pe {way_name}",
                    "destination": "UrmaÈ›i breteaua din dreapta spre {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "IntraÈ›i Ã®n sensul giratoriu",
                        "name": "IntraÈ›i Ã®n sensul giratoriu È™i ieÈ™iÈ›i pe {way_name}",
                        "destination": "IntraÈ›i Ã®n sensul giratoriu È™i ieÈ™iÈ›i spre {destination}"
                    },
                    "name": {
                        "default": "IntraÈ›i Ã®n {rotary_name}",
                        "name": "IntraÈ›i Ã®n {rotary_name} È™i ieÈ™iÈ›i pe {way_name}",
                        "destination": "IntraÈ›i Ã®n {rotary_name} È™i ieÈ™iÈ›i spre {destination}"
                    },
                    "exit": {
                        "default": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire",
                        "name": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire pe {way_name}",
                        "destination": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire spre {destination}"
                    },
                    "name_exit": {
                        "default": "IntraÈ›i Ã®n {rotary_name} È™i urmaÈ›i {exit_number} ieÈ™ire",
                        "name": "IntraÈ›i Ã®n {rotary_name} È™i urmaÈ›i {exit_number} ieÈ™ire pe {way_name}",
                        "destination": "IntraÈ›i Ã®n  {rotary_name} È™i urmaÈ›i {exit_number} ieÈ™ire spre {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire",
                        "name": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire pe {way_name}",
                        "destination": "IntraÈ›i Ã®n sensul giratoriu È™i urmaÈ›i {exit_number} ieÈ™ire spre {destination}"
                    },
                    "default": {
                        "default": "IntraÈ›i Ã®n sensul giratoriu",
                        "name": "IntraÈ›i Ã®n sensul giratoriu È™i ieÈ™iÈ›i pe {way_name}",
                        "destination": "IntraÈ›i Ã®n sensul giratoriu È™i ieÈ™iÈ›i spre {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "La sensul giratoriu viraÈ›i {modifier}",
                    "name": "La sensul giratoriu viraÈ›i {modifier} pe {way_name}",
                    "destination": "La sensul giratoriu viraÈ›i {modifier} spre {destination}"
                },
                "left": {
                    "default": "La sensul giratoriu viraÈ›i la stÃ¢nga",
                    "name": "La sensul giratoriu viraÈ›i la stÃ¢nga pe {way_name}",
                    "destination": "La sensul giratoriu viraÈ›i la stÃ¢nga spre {destination}"
                },
                "right": {
                    "default": "La sensul giratoriu viraÈ›i la dreapta",
                    "name": "La sensul giratoriu viraÈ›i la dreapta pe {way_name}",
                    "destination": "La sensul giratoriu viraÈ›i la dreapta spre {destination}"
                },
                "straight": {
                    "default": "La sensul giratoriu continuaÈ›i Ã®nainte",
                    "name": "La sensul giratoriu continuaÈ›i Ã®nainte pe {way_name}",
                    "destination": "La sensul giratoriu continuaÈ›i Ã®nainte spre {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "IeÈ™iÈ›i din sensul giratoriu",
                    "name": "IeÈ™iÈ›i din sensul giratoriu pe {way_name}",
                    "destination": "IeÈ™iÈ›i din sensul giratoriu spre {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "IeÈ™iÈ›i din sensul giratoriu",
                    "name": "IeÈ™iÈ›i din sensul giratoriu pe {way_name}",
                    "destination": "IeÈ™iÈ›i din sensul giratoriu spre {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "ViraÈ›i {modifier}",
                    "name": "ViraÈ›i {modifier} pe {way_name}",
                    "destination": "ViraÈ›i {modifier} spre {destination}"
                },
                "left": {
                    "default": "ViraÈ›i la stÃ¢nga",
                    "name": "ViraÈ›i la stÃ¢nga pe {way_name}",
                    "destination": "ViraÈ›i la stÃ¢nga spre {destination}"
                },
                "right": {
                    "default": "ViraÈ›i la dreapta",
                    "name": "ViraÈ›i la dreapta pe {way_name}",
                    "destination": "ViraÈ›i la dreapta spre {destination}"
                },
                "straight": {
                    "default": "MergeÈ›i Ã®nainte",
                    "name": "MergeÈ›i Ã®nainte pe {way_name}",
                    "destination": "MergeÈ›i Ã®nainte spre {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "MergeÈ›i Ã®nainte"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],42:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "Ð¿ÐµÑ€Ð²Ñ‹Ð¹",
                    "2": "Ð²Ñ‚Ð¾Ñ€Ð¾Ð¹",
                    "3": "Ñ‚Ñ€ÐµÑ‚Ð¸Ð¹",
                    "4": "Ñ‡ÐµÑ‚Ð²Ñ‘Ñ€Ñ‚Ñ‹Ð¹",
                    "5": "Ð¿ÑÑ‚Ñ‹Ð¹",
                    "6": "ÑˆÐµÑÑ‚Ð¾Ð¹",
                    "7": "ÑÐµÐ´ÑŒÐ¼Ð¾Ð¹",
                    "8": "Ð²Ð¾ÑÑŒÐ¼Ð¾Ð¹",
                    "9": "Ð´ÐµÐ²ÑÑ‚Ñ‹Ð¹",
                    "10": "Ð´ÐµÑÑÑ‚Ñ‹Ð¹"
                },
                "direction": {
                    "north": "ÑÐµÐ²ÐµÑ€Ð½Ð¾Ð¼",
                    "northeast": "ÑÐµÐ²ÐµÑ€Ð¾-Ð²Ð¾ÑÑ‚Ð¾Ñ‡Ð½Ð¾Ð¼",
                    "east": "Ð²Ð¾ÑÑ‚Ð¾Ñ‡Ð½Ð¾Ð¼",
                    "southeast": "ÑŽÐ³Ð¾-Ð²Ð¾ÑÑ‚Ð¾Ñ‡Ð½Ð¾Ð¼",
                    "south": "ÑŽÐ¶Ð½Ð¾Ð¼",
                    "southwest": "ÑŽÐ³Ð¾-Ð·Ð°Ð¿Ð°Ð´Ð½Ð¾Ð¼",
                    "west": "Ð·Ð°Ð¿Ð°Ð´Ð½Ð¾Ð¼",
                    "northwest": "ÑÐµÐ²ÐµÑ€Ð¾-Ð·Ð°Ð¿Ð°Ð´Ð½Ð¾Ð¼"
                },
                "modifier": {
                    "left": "Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "right": "Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "sharp left": "Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "sharp right": "Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "slight left": "Ð»ÐµÐ²ÐµÐµ",
                    "slight right": "Ð¿Ñ€Ð°Ð²ÐµÐµ",
                    "straight": "Ð¿Ñ€ÑÐ¼Ð¾",
                    "uturn": "Ð½Ð° Ñ€Ð°Ð·Ð²Ð¾Ñ€Ð¾Ñ‚"
                },
                "lanes": {
                    "xo": "Ð”ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ",
                    "ox": "Ð”ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ",
                    "xox": "Ð”ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð¿Ð¾ÑÐµÑ€ÐµÐ´Ð¸Ð½Ðµ",
                    "oxo": "Ð”ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ ÑÐ»ÐµÐ²Ð° Ð¸Ð»Ð¸ ÑÐ¿Ñ€Ð°Ð²Ð°"
                }
            },
            "modes": {
                "ferry": {
                    "default": "ÐŸÐ¾Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° Ð¿Ð°Ñ€Ð¾Ð¼",
                    "name": "ÐŸÐ¾Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° Ð¿Ð°Ñ€Ð¾Ð¼ {way_name}",
                    "destination": "ÐŸÐ¾Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° Ð¿Ð°Ñ€Ð¾Ð¼ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, Ð·Ð°Ñ‚ÐµÐ¼ Ñ‡ÐµÑ€ÐµÐ· {distance} {instruction_two}",
                "two linked": "{instruction_one}, Ð·Ð°Ñ‚ÐµÐ¼ {instruction_two}",
                "one in distance": "Ð§ÐµÑ€ÐµÐ· {distance} {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "ÑÑŠÐµÐ·Ð´ {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}"
                },
                "left": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð°",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ»ÐµÐ²Ð°",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð°"
                },
                "right": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð°",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ¿Ñ€Ð°Ð²Ð°",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð°"
                },
                "sharp left": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð° ÑÐ·Ð°Ð´Ð¸",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ»ÐµÐ²Ð° ÑÐ·Ð°Ð´Ð¸",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð° ÑÐ·Ð°Ð´Ð¸"
                },
                "sharp right": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð° ÑÐ·Ð°Ð´Ð¸",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ¿Ñ€Ð°Ð²Ð° ÑÐ·Ð°Ð´Ð¸",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð° ÑÐ·Ð°Ð´Ð¸"
                },
                "slight right": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ¿Ñ€Ð°Ð²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ¿Ñ€Ð°Ð²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸"
                },
                "slight left": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ ÑÐ»ÐµÐ²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ ÑÐ»ÐµÐ²Ð° Ð²Ð¿ÐµÑ€ÐµÐ´Ð¸"
                },
                "straight": {
                    "default": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ Ð¿ÐµÑ€ÐµÐ´ Ð’Ð°Ð¼Ð¸",
                    "upcoming": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ Ð² {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, Ð¾Ð½ Ð±ÑƒÐ´ÐµÑ‚ Ð¿ÐµÑ€ÐµÐ´ Ð’Ð°Ð¼Ð¸",
                    "short": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸",
                    "short-upcoming": "Ð’Ñ‹ ÑÐºÐ¾Ñ€Ð¾ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ñ‹ Ð¿Ñ€Ð¸Ð±Ñ‹Ð»Ð¸ Ð² Ð¿ÑƒÐ½ÐºÑ‚ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ, {waypoint_name}, Ð¾Ð½ Ð½Ð°Ñ…Ð¾Ð´Ð¸Ñ‚ÑÑ Ð¿ÐµÑ€ÐµÐ´ Ð’Ð°Ð¼Ð¸"
                }
            },
            "continue": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ {way_name:dative}",
                    "destination": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "distance": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ {distance}",
                    "namedistance": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ {distance} Ð¿Ð¾ {way_name:dative}"
                },
                "sharp left": {
                    "default": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð² {direction} Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð² {direction} Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ Ð¿Ð¾ {way_name:dative}",
                    "namedistance": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {distance} Ð² {direction} Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ Ð¿Ð¾ {way_name:dative}"
                }
            },
            "end of road": {
                "default": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier}",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "Ð’ ÐºÐ¾Ð½Ñ†Ðµ Ð´Ð¾Ñ€Ð¾Ð³Ð¸ Ñ€Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð² ÐºÐ¾Ð½Ñ†Ðµ {way_name:genitive}",
                    "destination": "Ð’ ÐºÐ¾Ð½Ñ†Ðµ Ð´Ð¾Ñ€Ð¾Ð³Ð¸ Ñ€Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ",
                    "name": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ",
                    "name": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð´ÐµÑ€Ð¶Ð¸Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp left": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ñ€ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ñ€ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ñ€Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ñ€Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° {way_name:prepositional}",
                    "destination": "ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ñ€Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ {way_name:dative}",
                    "destination": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp left": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð°Ð¸Ð²Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° {way_name:prepositional}",
                    "destination": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ {way_name:dative}",
                    "destination": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp left": {
                    "default": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð ÐµÐ·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ»Ð°Ð²Ð½Ð¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° {way_name:prepositional}",
                    "destination": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "uturn": {
                    "default": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ",
                    "name": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð½Ð° {way_name:prepositional}",
                    "destination": "Ð Ð°Ð·Ð²ÐµÑ€Ð½Ð¸Ñ‚ÐµÑÑŒ Ð¸ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit}",
                    "exit_destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "left": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} ÑÐ»ÐµÐ²Ð°",
                    "exit_destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} ÑÐ»ÐµÐ²Ð° Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "right": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} ÑÐ¿Ñ€Ð°Ð²Ð°",
                    "exit_destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} ÑÐ¿Ñ€Ð°Ð²Ð° Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit}",
                    "exit_destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit}",
                    "exit_destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° {exit}",
                    "exit_destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}",
                    "exit": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit}",
                    "exit_destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° ÑÑŠÐµÐ·Ð´ {exit} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð²ÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "left": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "right": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð»ÐµÐ²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° Ð¿Ñ€Ð°Ð²Ñ‹Ð¹ Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð»ÐµÐ²ÐµÐµ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° Ð²ÑŠÐµÐ·Ð´ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ",
                    "name": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²ÐµÐµ Ð½Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ð³Ð¸ÑÑ‚Ñ€Ð°Ð»ÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ",
                        "name": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    },
                    "name": {
                        "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ {rotary_name:dative}",
                        "name": "ÐÐ° {rotary_name:prepositional} ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° {rotary_name:prepositional} ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    },
                    "exit": {
                        "default": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´",
                        "name": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    },
                    "name_exit": {
                        "default": "ÐÐ° {rotary_name:prepositional} ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´",
                        "name": "ÐÐ° {rotary_name:prepositional} ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° {rotary_name:prepositional} ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´",
                        "name": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {exit_number} ÑÑŠÐµÐ·Ð´ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    },
                    "default": {
                        "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ð¾ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ",
                        "name": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð° {way_name:accusative}",
                        "destination": "ÐÐ° ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐµ ÑÐ²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "left": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "right": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸",
                    "name": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ Ð½Ð° {way_name:accusative}",
                    "destination": "Ð¡Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ñ ÐºÑ€ÑƒÐ³Ð¾Ð²Ð¾Ð¹ Ñ€Ð°Ð·Ð²ÑÐ·ÐºÐ¸ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name:accusative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}  Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð»ÐµÐ²Ð¾ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾ Ð½Ð° {way_name:accusative}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾  Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                },
                "straight": {
                    "default": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {way_name:dative}",
                    "destination": "Ð”Ð²Ð¸Ð³Ð°Ð¹Ñ‚ÐµÑÑŒ Ð² Ð½Ð°Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ð¸ {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð°Ð¹Ñ‚Ðµ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð¿Ñ€ÑÐ¼Ð¾"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],43:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1:a",
                    "2": "2:a",
                    "3": "3:e",
                    "4": "4:e",
                    "5": "5:e",
                    "6": "6:e",
                    "7": "7:e",
                    "8": "8:e",
                    "9": "9:e",
                    "10": "10:e"
                },
                "direction": {
                    "north": "norr",
                    "northeast": "nordost",
                    "east": "Ã¶ster",
                    "southeast": "sydost",
                    "south": "sÃ¶der",
                    "southwest": "sydvÃ¤st",
                    "west": "vÃ¤ster",
                    "northwest": "nordvÃ¤st"
                },
                "modifier": {
                    "left": "vÃ¤nster",
                    "right": "hÃ¶ger",
                    "sharp left": "vÃ¤nster",
                    "sharp right": "hÃ¶ger",
                    "slight left": "vÃ¤nster",
                    "slight right": "hÃ¶ger",
                    "straight": "rakt fram",
                    "uturn": "U-svÃ¤ng"
                },
                "lanes": {
                    "xo": "HÃ¥ll till hÃ¶ger",
                    "ox": "HÃ¥ll till vÃ¤nster",
                    "xox": "HÃ¥ll till mitten",
                    "oxo": "HÃ¥ll till vÃ¤nster eller hÃ¶ger"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Ta fÃ¤rjan",
                    "name": "Ta fÃ¤rjan pÃ¥ {way_name}",
                    "destination": "Ta fÃ¤rjan mot {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, sedan efter {distance}, {instruction_two}",
                "two linked": "{instruction_one}, sedan {instruction_two}",
                "one in distance": "Om {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Du Ã¤r framme vid din {nth} destination",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}"
                },
                "left": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till vÃ¤nster",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till vÃ¤nster",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till vÃ¤nster"
                },
                "right": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till hÃ¶ger",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till hÃ¶ger",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till hÃ¶ger"
                },
                "sharp left": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till vÃ¤nster",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till vÃ¤nster",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till vÃ¤nster"
                },
                "sharp right": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till hÃ¶ger",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till hÃ¶ger",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till hÃ¶ger"
                },
                "slight right": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till hÃ¶ger",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till hÃ¶ger",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till hÃ¶ger"
                },
                "slight left": {
                    "default": "Du Ã¤r framme vid din {nth} destination, till vÃ¤nster",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, till vÃ¤nster",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, till vÃ¤nster"
                },
                "straight": {
                    "default": "Du Ã¤r framme vid din {nth} destination, rakt fram",
                    "upcoming": "Du Ã¤r snart framme vid din {nth} destination, rakt fram",
                    "short": "Du Ã¤r framme",
                    "short-upcoming": "Du Ã¤r snart framme",
                    "named": "Du Ã¤r framme vid {waypoint_name}, rakt fram"
                }
            },
            "continue": {
                "default": {
                    "default": "SvÃ¤ng {modifier}",
                    "name": "SvÃ¤ng {modifier} och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng {modifier} mot {destination}",
                    "exit": "SvÃ¤ng {modifier} in pÃ¥ {way_name}"
                },
                "straight": {
                    "default": "FortsÃ¤tt rakt fram",
                    "name": "KÃ¶r rakt fram och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt mot {destination}",
                    "distance": "FortsÃ¤tt rakt fram i {distance}",
                    "namedistance": "FortsÃ¤tt pÃ¥ {way_name} i {distance}"
                },
                "sharp left": {
                    "default": "SvÃ¤ng vÃ¤nster",
                    "name": "SvÃ¤ng vÃ¤nster och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng vÃ¤nster mot {destination}"
                },
                "sharp right": {
                    "default": "SvÃ¤ng hÃ¶ger",
                    "name": "SvÃ¤ng hÃ¶ger och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng hÃ¶ger mot {destination}"
                },
                "slight left": {
                    "default": "SvÃ¤ng vÃ¤nster",
                    "name": "SvÃ¤ng vÃ¤nster och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng vÃ¤nster mot {destination}"
                },
                "slight right": {
                    "default": "SvÃ¤ng hÃ¶ger",
                    "name": "SvÃ¤ng hÃ¶ger och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng hÃ¶ger mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng",
                    "name": "GÃ¶r en U-svÃ¤ng och fortsÃ¤tt pÃ¥ {way_name}",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "KÃ¶r Ã¥t {direction}",
                    "name": "KÃ¶r Ã¥t {direction} pÃ¥ {way_name}",
                    "namedistance": "KÃ¶r {distance} Ã¥t {direction} pÃ¥ {way_name}"
                }
            },
            "end of road": {
                "default": {
                    "default": "SvÃ¤ng {modifier}",
                    "name": "SvÃ¤ng {modifier} in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng {modifier} mot {destination}"
                },
                "straight": {
                    "default": "FortsÃ¤tt rakt fram",
                    "name": "FortsÃ¤tt rakt fram in pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt rakt fram mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng i slutet av vÃ¤gen",
                    "name": "GÃ¶r en U-svÃ¤ng in pÃ¥ {way_name} i slutet av vÃ¤gen",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination} i slutet av vÃ¤gen"
                }
            },
            "fork": {
                "default": {
                    "default": "HÃ¥ll till {modifier} dÃ¤r vÃ¤gen delar sig",
                    "name": "HÃ¥ll till {modifier} in pÃ¥ {way_name}",
                    "destination": "HÃ¥ll till {modifier} mot {destination}"
                },
                "slight left": {
                    "default": "HÃ¥ll till vÃ¤nster dÃ¤r vÃ¤gen delar sig",
                    "name": "HÃ¥ll till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "HÃ¥ll till vÃ¤nster mot {destination}"
                },
                "slight right": {
                    "default": "HÃ¥ll till hÃ¶ger dÃ¤r vÃ¤gen delar sig",
                    "name": "HÃ¥ll till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "HÃ¥ll till hÃ¶ger mot {destination}"
                },
                "sharp left": {
                    "default": "SvÃ¤ng vÃ¤nster dÃ¤r vÃ¤gen delar sig",
                    "name": "SvÃ¤ng vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng vÃ¤nster mot {destination}"
                },
                "sharp right": {
                    "default": "SvÃ¤ng hÃ¶ger dÃ¤r vÃ¤gen delar sig",
                    "name": "SvÃ¤ng hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng hÃ¶ger mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng",
                    "name": "GÃ¶r en U-svÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Byt till {modifier} kÃ¶rfÃ¤lt",
                    "name": "Byt till {modifier} kÃ¶rfÃ¤lt, in pÃ¥ {way_name}",
                    "destination": "Byt till {modifier} kÃ¶rfÃ¤lt, mot {destination}"
                },
                "straight": {
                    "default": "FortsÃ¤tt",
                    "name": "KÃ¶r in pÃ¥ {way_name}",
                    "destination": "KÃ¶r mot {destination}"
                },
                "slight left": {
                    "default": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet",
                    "name": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet, in pÃ¥ {way_name}",
                    "destination": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet, mot {destination}"
                },
                "slight right": {
                    "default": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet",
                    "name": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet, in pÃ¥ {way_name}",
                    "destination": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet, mot {destination}"
                },
                "sharp left": {
                    "default": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet",
                    "name": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet, in pÃ¥ {way_name}",
                    "destination": "Byt till vÃ¤nstra kÃ¶rfÃ¤ltet, mot {destination}"
                },
                "sharp right": {
                    "default": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet",
                    "name": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet, in pÃ¥ {way_name}",
                    "destination": "Byt till hÃ¶gra kÃ¶rfÃ¤ltet, mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng",
                    "name": "GÃ¶r en U-svÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "FortsÃ¤tt {modifier}",
                    "name": "FortsÃ¤tt {modifier} pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt {modifier} mot {destination}"
                },
                "straight": {
                    "default": "FortsÃ¤tt rakt fram",
                    "name": "FortsÃ¤tt in pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt mot {destination}"
                },
                "sharp left": {
                    "default": "GÃ¶r en skarp vÃ¤nstersvÃ¤ng",
                    "name": "GÃ¶r en skarp vÃ¤nstersvÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en skarp vÃ¤nstersvÃ¤ng mot {destination}"
                },
                "sharp right": {
                    "default": "GÃ¶r en skarp hÃ¶gersvÃ¤ng",
                    "name": "GÃ¶r en skarp hÃ¶gersvÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en skarp hÃ¶gersvÃ¤ng mot {destination}"
                },
                "slight left": {
                    "default": "FortsÃ¤tt med lÃ¤tt vÃ¤nstersvÃ¤ng",
                    "name": "FortsÃ¤tt med lÃ¤tt vÃ¤nstersvÃ¤ng in pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt med lÃ¤tt vÃ¤nstersvÃ¤ng mot {destination}"
                },
                "slight right": {
                    "default": "FortsÃ¤tt med lÃ¤tt hÃ¶gersvÃ¤ng",
                    "name": "FortsÃ¤tt med lÃ¤tt hÃ¶gersvÃ¤ng in pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt med lÃ¤tt hÃ¶gersvÃ¤ng mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng",
                    "name": "GÃ¶r en U-svÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "FortsÃ¤tt {modifier}",
                    "name": "FortsÃ¤tt {modifier} pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt {modifier} mot {destination}"
                },
                "uturn": {
                    "default": "GÃ¶r en U-svÃ¤ng",
                    "name": "GÃ¶r en U-svÃ¤ng in pÃ¥ {way_name}",
                    "destination": "GÃ¶r en U-svÃ¤ng mot {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ta avfarten",
                    "name": "Ta avfarten in pÃ¥ {way_name}",
                    "destination": "Ta avfarten mot {destination}",
                    "exit": "Ta avfart {exit} ",
                    "exit_destination": "Ta avfart {exit} mot {destination}"
                },
                "left": {
                    "default": "Ta avfarten till vÃ¤nster",
                    "name": "Ta avfarten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till vÃ¤nster mot {destination}",
                    "exit": "Ta avfart {exit} till vÃ¤nster",
                    "exit_destination": "Ta avfart {exit} till vÃ¤nster mot {destination}"
                },
                "right": {
                    "default": "Ta avfarten till hÃ¶ger",
                    "name": "Ta avfarten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till hÃ¶ger mot {destination}",
                    "exit": "Ta avfart {exit} till hÃ¶ger",
                    "exit_destination": "Ta avfart {exit} till hÃ¶ger mot {destination}"
                },
                "sharp left": {
                    "default": "Ta avfarten till vÃ¤nster",
                    "name": "Ta avfarten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till vÃ¤nster mot {destination}",
                    "exit": "Ta avfart {exit} till vÃ¤nster",
                    "exit_destination": "Ta avfart {exit} till vÃ¤nster mot {destination}"
                },
                "sharp right": {
                    "default": "Ta avfarten till hÃ¶ger",
                    "name": "Ta avfarten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till hÃ¶ger mot {destination}",
                    "exit": "Ta avfart {exit} till hÃ¶ger",
                    "exit_destination": "Ta avfart {exit} till hÃ¶ger mot {destination}"
                },
                "slight left": {
                    "default": "Ta avfarten till vÃ¤nster",
                    "name": "Ta avfarten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till vÃ¤nster mot {destination}",
                    "exit": "Ta avfart {exit} till vÃ¤nster",
                    "exit_destination": "Ta avfart{exit} till vÃ¤nster mot {destination}"
                },
                "slight right": {
                    "default": "Ta avfarten till hÃ¶ger",
                    "name": "Ta avfarten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta avfarten till hÃ¶ger mot {destination}",
                    "exit": "Ta avfart {exit} till hÃ¶ger",
                    "exit_destination": "Ta avfart {exit} till hÃ¶ger mot {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Ta pÃ¥farten",
                    "name": "Ta pÃ¥farten in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten mot {destination}"
                },
                "left": {
                    "default": "Ta pÃ¥farten till vÃ¤nster",
                    "name": "Ta pÃ¥farten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till vÃ¤nster mot {destination}"
                },
                "right": {
                    "default": "Ta pÃ¥farten till hÃ¶ger",
                    "name": "Ta pÃ¥farten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till hÃ¶ger mot {destination}"
                },
                "sharp left": {
                    "default": "Ta pÃ¥farten till vÃ¤nster",
                    "name": "Ta pÃ¥farten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till vÃ¤nster mot {destination}"
                },
                "sharp right": {
                    "default": "Ta pÃ¥farten till hÃ¶ger",
                    "name": "Ta pÃ¥farten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till hÃ¶ger mot {destination}"
                },
                "slight left": {
                    "default": "Ta pÃ¥farten till vÃ¤nster",
                    "name": "Ta pÃ¥farten till vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till vÃ¤nster mot {destination}"
                },
                "slight right": {
                    "default": "Ta pÃ¥farten till hÃ¶ger",
                    "name": "Ta pÃ¥farten till hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "Ta pÃ¥farten till hÃ¶ger mot {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "KÃ¶r in i rondellen",
                        "name": "I rondellen, ta avfarten in pÃ¥ {way_name}",
                        "destination": "I rondellen, ta av mot {destination}"
                    },
                    "name": {
                        "default": "KÃ¶r in i {rotary_name}",
                        "name": "I {rotary_name}, ta av in pÃ¥ {way_name}",
                        "destination": "I {rotary_name}, ta av mot {destination}"
                    },
                    "exit": {
                        "default": "I rondellen, ta {exit_number} avfarten",
                        "name": "I rondellen, ta {exit_number} avfarten in pÃ¥ {way_name}",
                        "destination": "I rondellen, ta {exit_number} avfarten mot {destination}"
                    },
                    "name_exit": {
                        "default": "I {rotary_name}, ta {exit_number} avfarten",
                        "name": "I {rotary_name}, ta {exit_number}  avfarten in pÃ¥ {way_name}",
                        "destination": "I {rotary_name}, ta {exit_number} avfarten mot {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "I rondellen, ta {exit_number} avfarten",
                        "name": "I rondellen, ta {exit_number} avfarten in pÃ¥ {way_name}",
                        "destination": "I rondellen, ta {exit_number} avfarten mot {destination}"
                    },
                    "default": {
                        "default": "KÃ¶r in i rondellen",
                        "name": "I rondellen, ta avfarten in pÃ¥ {way_name}",
                        "destination": "I rondellen, ta av mot {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "SvÃ¤ng {modifier}",
                    "name": "SvÃ¤ng {modifier} in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng {modifier} mot {destination}"
                },
                "left": {
                    "default": "SvÃ¤ng vÃ¤nster",
                    "name": "SvÃ¤ng vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng vÃ¤nster mot {destination}"
                },
                "right": {
                    "default": "SvÃ¤ng hÃ¶ger",
                    "name": "SvÃ¤ng hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng hÃ¶ger mot {destination}"
                },
                "straight": {
                    "default": "FortsÃ¤tt rakt fram",
                    "name": "FortsÃ¤tt rakt fram in pÃ¥ {way_name}",
                    "destination": "FortsÃ¤tt rakt fram mot {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "KÃ¶r ut ur rondellen",
                    "name": "KÃ¶r ut ur rondellen in pÃ¥ {way_name}",
                    "destination": "KÃ¶r ut ur rondellen mot {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "KÃ¶r ut ur rondellen",
                    "name": "KÃ¶r ut ur rondellen in pÃ¥ {way_name}",
                    "destination": "KÃ¶r ut ur rondellen mot {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "SvÃ¤ng {modifier}",
                    "name": "SvÃ¤ng {modifier} in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng {modifier} mot {destination}"
                },
                "left": {
                    "default": "SvÃ¤ng vÃ¤nster",
                    "name": "SvÃ¤ng vÃ¤nster in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng vÃ¤nster mot {destination}"
                },
                "right": {
                    "default": "SvÃ¤ng hÃ¶ger",
                    "name": "SvÃ¤ng hÃ¶ger in pÃ¥ {way_name}",
                    "destination": "SvÃ¤ng hÃ¶ger mot {destination}"
                },
                "straight": {
                    "default": "KÃ¶r rakt fram",
                    "name": "KÃ¶r rakt fram in pÃ¥ {way_name}",
                    "destination": "KÃ¶r rakt fram mot {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "FortsÃ¤tt rakt fram"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],44:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "birinci",
                    "2": "ikinci",
                    "3": "Ã¼Ã§Ã¼ncÃ¼",
                    "4": "dÃ¶rdÃ¼ncÃ¼",
                    "5": "beÅŸinci",
                    "6": "altÄ±ncÄ±",
                    "7": "yedinci",
                    "8": "sekizinci",
                    "9": "dokuzuncu",
                    "10": "onuncu"
                },
                "direction": {
                    "north": "kuzey",
                    "northeast": "kuzeydoÄŸu",
                    "east": "doÄŸu",
                    "southeast": "gÃ¼neydoÄŸu",
                    "south": "gÃ¼ney",
                    "southwest": "gÃ¼neybatÄ±",
                    "west": "batÄ±",
                    "northwest": "kuzeybatÄ±"
                },
                "modifier": {
                    "left": "sol",
                    "right": "saÄŸ",
                    "sharp left": "keskin sol",
                    "sharp right": "keskin saÄŸ",
                    "slight left": "hafif sol",
                    "slight right": "hafif saÄŸ",
                    "straight": "dÃ¼z",
                    "uturn": "U dÃ¶nÃ¼ÅŸÃ¼"
                },
                "lanes": {
                    "xo": "SaÄŸda kalÄ±n",
                    "ox": "Solda kalÄ±n",
                    "xox": "Ortada kalÄ±n",
                    "oxo": "Solda veya saÄŸda kalÄ±n"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Vapur kullan",
                    "name": "{way_name} vapurunu kullan",
                    "destination": "{destination} istikametine giden vapuru kullan"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one} ve {distance} sonra {instruction_two}",
                "two linked": "{instruction_one} ve sonra {instruction_two}",
                "one in distance": "{distance} sonra, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "exit {exit}"
            },
            "arrive": {
                "default": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z"
                },
                "left": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r"
                },
                "right": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r"
                },
                "sharp left": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r"
                },
                "sharp right": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r"
                },
                "slight right": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz saÄŸÄ±nÄ±zdadÄ±r"
                },
                "slight left": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz solunuzdadÄ±r"
                },
                "straight": {
                    "default": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz karÅŸÄ±nÄ±zdadÄ±r",
                    "upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z, hedefiniz karÅŸÄ±nÄ±zdadÄ±r",
                    "short": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "short-upcoming": "{nth} hedefinize ulaÅŸtÄ±nÄ±z",
                    "named": "{waypoint_name} ulaÅŸtÄ±nÄ±z, hedefiniz karÅŸÄ±nÄ±zdadÄ±r"
                }
            },
            "continue": {
                "default": {
                    "default": "{modifier} yÃ¶ne dÃ¶n",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n",
                    "exit": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z devam edin",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in dÃ¼z devam et",
                    "destination": "{destination} istikametinde devam et",
                    "distance": "{distance} boyunca dÃ¼z devam et",
                    "namedistance": "{distance} boyunca {way_name} Ã¼zerinde devam et"
                },
                "sharp left": {
                    "default": "Sola keskin dÃ¶nÃ¼ÅŸ yap",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in sola keskin dÃ¶nÃ¼ÅŸ yap",
                    "destination": "{destination} istikametinde sola keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "sharp right": {
                    "default": "SaÄŸa keskin dÃ¶nÃ¼ÅŸ yap",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in saÄŸa keskin dÃ¶nÃ¼ÅŸ yap",
                    "destination": "{destination} istikametinde saÄŸa keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "slight left": {
                    "default": "Sola hafif dÃ¶nÃ¼ÅŸ yap",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in sola hafif dÃ¶nÃ¼ÅŸ yap",
                    "destination": "{destination} istikametinde sola hafif dÃ¶nÃ¼ÅŸ yap"
                },
                "slight right": {
                    "default": "SaÄŸa hafif dÃ¶nÃ¼ÅŸ yap",
                    "name": "{way_name} Ã¼zerinde kalmak iÃ§in saÄŸa hafif dÃ¶nÃ¼ÅŸ yap",
                    "destination": "{destination} istikametinde saÄŸa hafif dÃ¶nÃ¼ÅŸ yap"
                },
                "uturn": {
                    "default": "U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "Bir U-dÃ¶nÃ¼ÅŸÃ¼ yap ve {way_name} devam et",
                    "destination": "{destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "depart": {
                "default": {
                    "default": "{direction} tarafÄ±na yÃ¶nelin",
                    "name": "{way_name} Ã¼zerinde {direction} yÃ¶ne git",
                    "namedistance": "Head {direction} on {way_name} for {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "{modifier} tarafa dÃ¶nÃ¼n",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z devam edin",
                    "name": "{way_name} Ã¼zerinde dÃ¼z devam et",
                    "destination": "{destination} istikametinde dÃ¼z devam et"
                },
                "uturn": {
                    "default": "Yolun sonunda U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "Yolun sonunda {way_name} Ã¼zerinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap",
                    "destination": "Yolun sonunda {destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "fork": {
                "default": {
                    "default": "Yol ayrÄ±mÄ±nda {modifier} yÃ¶nde kal",
                    "name": "{way_name} Ã¼zerindeki yol ayrÄ±mÄ±nda {modifier} yÃ¶nde kal",
                    "destination": "{destination} istikametindeki yol ayrÄ±mÄ±nda {modifier} yÃ¶nde kal"
                },
                "slight left": {
                    "default": "Ã‡atalÄ±n solundan devam edin",
                    "name": "Ã‡atalÄ±n solundan {way_name} yoluna doÄŸru ",
                    "destination": "{destination} istikametindeki yol ayrÄ±mÄ±nda solda kal"
                },
                "slight right": {
                    "default": "Ã‡atalÄ±n saÄŸÄ±ndan devam edin",
                    "name": "{way_name} Ã¼zerindeki yol ayrÄ±mÄ±nda saÄŸda kal",
                    "destination": "{destination} istikametindeki yol ayrÄ±mÄ±nda saÄŸda kal"
                },
                "sharp left": {
                    "default": "Ã‡atalda keskin sola dÃ¶nÃ¼n",
                    "name": "{way_name} yoluna doÄŸru sola keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "destination": "{destination} istikametinde sola keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "sharp right": {
                    "default": "Ã‡atalda keskin saÄŸa dÃ¶nÃ¼n",
                    "name": "{way_name} yoluna doÄŸru saÄŸa keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "destination": "{destination} istikametinde saÄŸa keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "uturn": {
                    "default": "U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "{way_name} yoluna U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "destination": "{destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "merge": {
                "default": {
                    "default": "{modifier} yÃ¶ne gir",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne gir",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne gir"
                },
                "straight": {
                    "default": "dÃ¼z yÃ¶ne gir",
                    "name": "{way_name} Ã¼zerinde dÃ¼z yÃ¶ne gir",
                    "destination": "{destination} istikametinde dÃ¼z yÃ¶ne gir"
                },
                "slight left": {
                    "default": "Sola gir",
                    "name": "{way_name} Ã¼zerinde sola gir",
                    "destination": "{destination} istikametinde sola gir"
                },
                "slight right": {
                    "default": "SaÄŸa gir",
                    "name": "{way_name} Ã¼zerinde saÄŸa gir",
                    "destination": "{destination} istikametinde saÄŸa gir"
                },
                "sharp left": {
                    "default": "Sola gir",
                    "name": "{way_name} Ã¼zerinde sola gir",
                    "destination": "{destination} istikametinde sola gir"
                },
                "sharp right": {
                    "default": "SaÄŸa gir",
                    "name": "{way_name} Ã¼zerinde saÄŸa gir",
                    "destination": "{destination} istikametinde saÄŸa gir"
                },
                "uturn": {
                    "default": "U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "{way_name} yoluna U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "destination": "{destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "new name": {
                "default": {
                    "default": "{modifier} yÃ¶nde devam et",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶nde devam et",
                    "destination": "{destination} istikametinde {modifier} yÃ¶nde devam et"
                },
                "straight": {
                    "default": "DÃ¼z devam et",
                    "name": "{way_name} Ã¼zerinde devam et",
                    "destination": "{destination} istikametinde devam et"
                },
                "sharp left": {
                    "default": "Sola keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "name": "{way_name} yoluna doÄŸru sola keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "destination": "{destination} istikametinde sola keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "sharp right": {
                    "default": "SaÄŸa keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "name": "{way_name} yoluna doÄŸru saÄŸa keskin dÃ¶nÃ¼ÅŸ yapÄ±n",
                    "destination": "{destination} istikametinde saÄŸa keskin dÃ¶nÃ¼ÅŸ yap"
                },
                "slight left": {
                    "default": "Hafif soldan devam edin",
                    "name": "{way_name} Ã¼zerinde hafif solda devam et",
                    "destination": "{destination} istikametinde hafif solda devam et"
                },
                "slight right": {
                    "default": "Hafif saÄŸdan devam edin",
                    "name": "{way_name} Ã¼zerinde hafif saÄŸda devam et",
                    "destination": "{destination} istikametinde hafif saÄŸda devam et"
                },
                "uturn": {
                    "default": "U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "{way_name} yoluna U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "destination": "{destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "notification": {
                "default": {
                    "default": "{modifier} yÃ¶nde devam et",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶nde devam et",
                    "destination": "{destination} istikametinde {modifier} yÃ¶nde devam et"
                },
                "uturn": {
                    "default": "U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "name": "{way_name} yoluna U dÃ¶nÃ¼ÅŸÃ¼ yapÄ±n",
                    "destination": "{destination} istikametinde bir U-dÃ¶nÃ¼ÅŸÃ¼ yap"
                }
            },
            "off ramp": {
                "default": {
                    "default": "BaÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden baÄŸlantÄ± yoluna geÃ§",
                    "exit": "{exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§",
                    "exit": "Soldaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} sol Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "exit": "SaÄŸdaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} saÄŸ Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "sharp left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§",
                    "exit": "Soldaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} sol Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "sharp right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "exit": "SaÄŸdaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} saÄŸ Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "slight left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§",
                    "exit": "Soldaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} sol Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                },
                "slight right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "exit": "SaÄŸdaki {exit} Ã§Ä±kÄ±ÅŸ yoluna geÃ§",
                    "exit_destination": "{destination} istikametindeki {exit} saÄŸ Ã§Ä±kÄ±ÅŸ yoluna geÃ§"
                }
            },
            "on ramp": {
                "default": {
                    "default": "BaÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden baÄŸlantÄ± yoluna geÃ§"
                },
                "left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§"
                },
                "right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§"
                },
                "sharp left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§"
                },
                "sharp right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§"
                },
                "slight left": {
                    "default": "Soldaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki sol baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden sol baÄŸlantÄ± yoluna geÃ§"
                },
                "slight right": {
                    "default": "SaÄŸdaki baÄŸlantÄ± yoluna geÃ§",
                    "name": "{way_name} Ã¼zerindeki saÄŸ baÄŸlantÄ± yoluna geÃ§",
                    "destination": "{destination} istikametine giden saÄŸ baÄŸlantÄ± yoluna geÃ§"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "DÃ¶nel kavÅŸaÄŸa gir",
                        "name": "DÃ¶nel kavÅŸaÄŸa gir ve {way_name} Ã¼zerinde Ã§Ä±k",
                        "destination": "DÃ¶nel kavÅŸaÄŸa gir ve {destination} istikametinde Ã§Ä±k"
                    },
                    "name": {
                        "default": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir",
                        "name": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir ve {way_name} Ã¼zerinde Ã§Ä±k",
                        "destination": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir ve {destination} istikametinde Ã§Ä±k"
                    },
                    "exit": {
                        "default": "DÃ¶nel kavÅŸaÄŸa gir ve {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "name": "DÃ¶nel kavÅŸaÄŸa gir ve {way_name} Ã¼zerindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "destination": "DÃ¶nel kavÅŸaÄŸa gir ve {destination} istikametindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir"
                    },
                    "name_exit": {
                        "default": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir ve {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "name": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir ve {way_name} Ã¼zerindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "destination": "{rotary_name} dÃ¶nel kavÅŸaÄŸa gir ve {destination} istikametindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "GÃ¶bekli kavÅŸaÄŸa gir ve {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "name": "GÃ¶bekli kavÅŸaÄŸa gir ve {way_name} Ã¼zerindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir",
                        "destination": "GÃ¶bekli kavÅŸaÄŸa gir ve {destination} istikametindeki {exit_number} numaralÄ± Ã§Ä±kÄ±ÅŸa gir"
                    },
                    "default": {
                        "default": "GÃ¶bekli kavÅŸaÄŸa gir",
                        "name": "GÃ¶bekli kavÅŸaÄŸa gir ve {way_name} Ã¼zerinde Ã§Ä±k",
                        "destination": "GÃ¶bekli kavÅŸaÄŸa gir ve {destination} istikametinde Ã§Ä±k"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier} yÃ¶ne dÃ¶n",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n"
                },
                "left": {
                    "default": "Sola dÃ¶n",
                    "name": "{way_name} Ã¼zerinde sola dÃ¶n",
                    "destination": "{destination} istikametinde sola dÃ¶n"
                },
                "right": {
                    "default": "SaÄŸa dÃ¶n",
                    "name": "{way_name} Ã¼zerinde saÄŸa dÃ¶n",
                    "destination": "{destination} istikametinde saÄŸa dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z devam et",
                    "name": "{way_name} Ã¼zerinde dÃ¼z devam et",
                    "destination": "{destination} istikametinde dÃ¼z devam et"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "{modifier} yÃ¶ne dÃ¶n",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n"
                },
                "left": {
                    "default": "Sola dÃ¶n",
                    "name": "{way_name} Ã¼zerinde sola dÃ¶n",
                    "destination": "{destination} istikametinde sola dÃ¶n"
                },
                "right": {
                    "default": "SaÄŸa dÃ¶n",
                    "name": "{way_name} Ã¼zerinde saÄŸa dÃ¶n",
                    "destination": "{destination} istikametinde saÄŸa dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z devam et",
                    "name": "{way_name} Ã¼zerinde dÃ¼z devam et",
                    "destination": "{destination} istikametinde dÃ¼z devam et"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "{modifier} yÃ¶ne dÃ¶n",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n"
                },
                "left": {
                    "default": "Sola dÃ¶n",
                    "name": "{way_name} Ã¼zerinde sola dÃ¶n",
                    "destination": "{destination} istikametinde sola dÃ¶n"
                },
                "right": {
                    "default": "SaÄŸa dÃ¶n",
                    "name": "{way_name} Ã¼zerinde saÄŸa dÃ¶n",
                    "destination": "{destination} istikametinde saÄŸa dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z devam et",
                    "name": "{way_name} Ã¼zerinde dÃ¼z devam et",
                    "destination": "{destination} istikametinde dÃ¼z devam et"
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier} yÃ¶ne dÃ¶n",
                    "name": "{way_name} Ã¼zerinde {modifier} yÃ¶ne dÃ¶n",
                    "destination": "{destination} istikametinde {modifier} yÃ¶ne dÃ¶n"
                },
                "left": {
                    "default": "Sola dÃ¶nÃ¼n",
                    "name": "{way_name} Ã¼zerinde sola dÃ¶n",
                    "destination": "{destination} istikametinde sola dÃ¶n"
                },
                "right": {
                    "default": "SaÄŸa dÃ¶nÃ¼n",
                    "name": "{way_name} Ã¼zerinde saÄŸa dÃ¶n",
                    "destination": "{destination} istikametinde saÄŸa dÃ¶n"
                },
                "straight": {
                    "default": "DÃ¼z git",
                    "name": "{way_name} Ã¼zerinde dÃ¼z git",
                    "destination": "{destination} istikametinde dÃ¼z git"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "DÃ¼z devam edin"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],45:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "1Ð¹",
                    "2": "2Ð¹",
                    "3": "3Ð¹",
                    "4": "4Ð¹",
                    "5": "5Ð¹",
                    "6": "6Ð¹",
                    "7": "7Ð¹",
                    "8": "8Ð¹",
                    "9": "9Ð¹",
                    "10": "10Ð¹"
                },
                "direction": {
                    "north": "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡",
                    "northeast": "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡Ð½Ð¸Ð¹ ÑÑ…Ñ–Ð´",
                    "east": "ÑÑ…Ñ–Ð´",
                    "southeast": "Ð¿Ñ–Ð²Ð´ÐµÐ½Ð½Ð¸Ð¹ ÑÑ…Ñ–Ð´",
                    "south": "Ð¿Ñ–Ð²Ð´ÐµÐ½ÑŒ",
                    "southwest": "Ð¿Ñ–Ð²Ð´ÐµÐ½Ð½Ð¸Ð¹ Ð·Ð°Ñ…Ñ–Ð´",
                    "west": "Ð·Ð°Ñ…Ñ–Ð´",
                    "northwest": "Ð¿Ñ–Ð²Ð½Ñ–Ñ‡Ð½Ð¸Ð¹ Ð·Ð°Ñ…Ñ–Ð´"
                },
                "modifier": {
                    "left": "Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "right": "Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "sharp left": "Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "sharp right": "Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "slight left": "Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "slight right": "Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "straight": "Ð¿Ñ€ÑÐ¼Ð¾",
                    "uturn": "Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚"
                },
                "lanes": {
                    "xo": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "ox": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "xox": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑŒ Ð² ÑÐµÑ€ÐµÐ´Ð¸Ð½Ñ–",
                    "oxo": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð°Ð±Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡"
                }
            },
            "modes": {
                "ferry": {
                    "default": "Ð¡ÐºÐ¾Ñ€Ð¸ÑÑ‚Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾Ñ€Ð¾Ð¼Ð¾Ð¼",
                    "name": "Ð¡ÐºÐ¾Ñ€Ð¸ÑÑ‚Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾Ñ€Ð¾Ð¼Ð¾Ð¼ {way_name}",
                    "destination": "Ð¡ÐºÐ¾Ñ€Ð¸ÑÑ‚Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾Ñ€Ð¾Ð¼Ð¾Ð¼ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, Ð¿Ð¾Ñ‚Ñ–Ð¼, Ñ‡ÐµÑ€ÐµÐ· {distance}, {instruction_two}",
                "two linked": "{instruction_one}, Ð¿Ð¾Ñ‚Ñ–Ð¼ {instruction_two}",
                "one in distance": "Ð§ÐµÑ€ÐµÐ· {distance}, {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "Ð·'Ñ—Ð·Ð´ {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name}"
                },
                "left": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½Â â€“ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "right": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "sharp left": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "sharp right": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "slight right": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "slight left": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡"
                },
                "straight": {
                    "default": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ Ð²Ð°Ñˆ {nth} Ð¿ÑƒÐ½ÐºÑ‚ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð²Ñ–Ð½ â€“ Ð¿Ñ€ÑÐ¼Ð¾ Ð¿ÐµÑ€ÐµÐ´ Ð²Ð°Ð¼Ð¸",
                    "upcoming": "Ð’Ð¸ Ð½Ð°Ð±Ð»Ð¸Ð¶Ð°Ñ”Ñ‚ÐµÑÑŒ Ð´Ð¾ Ð²Ð°ÑˆÐ¾Ð³Ð¾ {nth} Ð¼Ñ–ÑÑ†Ñ Ð¿Ñ€Ð¸Ð·Ð½Ð°Ñ‡ÐµÐ½Ð½Ñ, Ð¿Ñ€ÑÐ¼Ð¾ Ð¿ÐµÑ€ÐµÐ´ Ð²Ð°Ð¼Ð¸",
                    "short": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸",
                    "short-upcoming": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ´ÐµÑ‚Ðµ",
                    "named": "Ð’Ð¸ Ð¿Ñ€Ð¸Ð±ÑƒÐ»Ð¸ Ñƒ {waypoint_name} Ð¿Ñ€ÑÐ¼Ð¾ Ð¿ÐµÑ€ÐµÐ´ Ð²Ð°Ð¼Ð¸"
                }
            },
            "continue": {
                "default": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier}",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ{modifier} Ð·Ð°Ð»Ð¸ÑˆÐ°ÑŽÑ‡Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier} Ð½Ð° {way_name}"
                },
                "straight": {
                    "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ Ð·Ð°Ð»Ð¸ÑˆÐ°ÑŽÑ‡Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "distance": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ {distance}",
                    "namedistance": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ð¾ {way_name} {distance}"
                },
                "sharp left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñ‰Ð¾Ð± Ð·Ð°Ð»Ð¸ÑˆÐ¸Ñ‚Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñ‰Ð¾Ð± Ð·Ð°Ð»Ð¸ÑˆÐ¸Ñ‚Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñ‰Ð¾Ð± Ð·Ð°Ð»Ð¸ÑˆÐ¸Ñ‚Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñ‰Ð¾Ð± Ð·Ð°Ð»Ð¸ÑˆÐ¸Ñ‚Ð¸ÑÑŒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñ‚Ð° Ñ€ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {way_name}",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "ÐŸÑ€ÑÐ¼ÑƒÐ¹Ñ‚Ðµ Ð½Ð° {direction}",
                    "name": "ÐŸÑ€ÑÐ¼ÑƒÐ¹Ñ‚Ðµ Ð½Ð° {direction} Ð¿Ð¾ {way_name}",
                    "namedistance": "ÐŸÑ€ÑÐ¼ÑƒÐ¹Ñ‚Ðµ Ð½Ð° {direction} Ð¿Ð¾ {way_name} {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier}",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier} Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ {modifier} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "straight": {
                    "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ Ð´Ð¾ {way_name}",
                    "destination": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð² ÐºÑ–Ð½Ñ†Ñ– Ð´Ð¾Ñ€Ð¾Ð³Ð¸",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð° {way_name} Ð² ÐºÑ–Ð½Ñ†Ñ– Ð´Ð¾Ñ€Ð¾Ð³Ð¸",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination} Ð² ÐºÑ–Ð½Ñ†Ñ– Ð´Ð¾Ñ€Ð¾Ð³Ð¸"
                }
            },
            "fork": {
                "default": {
                    "default": "ÐÐ° Ñ€Ð¾Ð·Ð´Ð¾Ñ€Ñ–Ð¶Ð¶Ñ– Ñ‚Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ {modifier}",
                    "name": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ {modifier} Ñ– Ñ€ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° {way_name}",
                    "destination": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ {modifier} Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "ÐÐ° Ñ€Ð¾Ð·Ð´Ð¾Ñ€Ñ–Ð¶Ð¶Ñ– Ñ‚Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñ– Ñ€ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° {way_name}",
                    "destination": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "ÐÐ° Ñ€Ð¾Ð·Ð´Ð¾Ñ€Ñ–Ð¶Ð¶Ñ– Ñ‚Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñ– Ñ€ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° {way_name}",
                    "destination": "Ð¢Ñ€Ð¸Ð¼Ð°Ð¹Ñ‚ÐµÑÑ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp left": {
                    "default": "ÐÐ° Ñ€Ð¾Ð·Ð´Ð¾Ñ€Ñ–Ð¶Ð¶Ñ– Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "ÐÐ° Ñ€Ð¾Ð·Ð´Ð¾Ñ€Ñ–Ð¶Ð¶Ñ– Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð° {way_name}",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ {modifier}",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ {modifier} Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ {modifier} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "straight": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp left": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ñ”Ð´Ð½Ð°Ð¹Ñ‚ÐµÑÑ Ð´Ð¾ Ð¿Ð¾Ñ‚Ð¾ÐºÑƒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð° {way_name}",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "straight": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp left": {
                    "default": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÑ€Ð¸Ð¹Ð¼Ñ–Ñ‚ÑŒ Ñ€Ñ–Ð·ÐºÐ¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð° {way_name}",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "uturn": {
                    "default": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚",
                    "name": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð° {way_name}",
                    "destination": "Ð—Ð´Ñ–Ð¹ÑÐ½Ñ–Ñ‚ÑŒ Ñ€Ð¾Ð·Ð²Ð¾Ñ€Ð¾Ñ‚ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit}",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð·Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}",
                    "exit": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "exit_destination": "ÐžÐ±ÐµÑ€Ñ–Ñ‚ÑŒ Ð·'Ñ—Ð·Ð´ {exit} Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "sharp right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight left": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "slight right": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð½Ð° Ð²Ê¼Ñ—Ð·Ð´ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ð´Ð¾ {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    },
                    "name": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name}",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name} Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð½Ð° {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name} Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    },
                    "exit": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€ÐµÐ½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ð½Ð° {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    },
                    "name_exit": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name} Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name} Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ð½Ð° {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ {rotary_name} Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€ÐµÐ½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ð½Ð° {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ñ‚Ð° Ð¿Ð¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ñƒ {exit_number} Ð·'Ñ—Ð·Ð´ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    },
                    "default": {
                        "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ",
                        "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ð´Ð¾ {way_name}",
                        "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ð¾ ÐºÐ¾Ð»Ñƒ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "straight": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ Ð´Ð¾ {way_name}",
                    "destination": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾",
                    "name": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾ Ð½Ð° {way_name} Ð·Ê¼Ñ—Ð·Ð´Ñ–",
                    "destination": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾",
                    "name": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾ Ð½Ð° {way_name} Ð·Ê¼Ñ—Ð·Ð´Ñ–",
                    "destination": "Ð—Ð°Ð»Ð¸ÑˆÐ¸Ñ‚ÑŒ ÐºÐ¾Ð»Ð¾ Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier}",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð½Ð° {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ {modifier} Ð² Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "left": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð»Ñ–Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "right": {
                    "default": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡",
                    "name": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ð½Ð° {way_name}",
                    "destination": "ÐŸÐ¾Ð²ÐµÑ€Ð½Ñ–Ñ‚ÑŒ Ð¿Ñ€Ð°Ð²Ð¾Ñ€ÑƒÑ‡ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                },
                "straight": {
                    "default": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾",
                    "name": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ð¿Ð¾ {way_name}",
                    "destination": "Ð ÑƒÑ…Ð°Ð¹Ñ‚ÐµÑÑŒ Ð¿Ñ€ÑÐ¼Ð¾ Ñƒ Ð½Ð°Ð¿Ñ€ÑÐ¼ÐºÑƒ {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ÐŸÑ€Ð¾Ð´Ð¾Ð²Ð¶ÑƒÐ¹Ñ‚Ðµ Ñ€ÑƒÑ… Ð¿Ñ€ÑÐ¼Ð¾"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],46:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": true
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "Ä‘áº§u tiÃªn",
                    "2": "thá»© 2",
                    "3": "thá»© 3",
                    "4": "thá»© 4",
                    "5": "thá»© 5",
                    "6": "thÃº 6",
                    "7": "thá»© 7",
                    "8": "thá»© 8",
                    "9": "thá»© 9",
                    "10": "thá»© 10"
                },
                "direction": {
                    "north": "báº¯c",
                    "northeast": "Ä‘Ã´ng báº¯c",
                    "east": "Ä‘Ã´ng",
                    "southeast": "Ä‘Ã´ng nam",
                    "south": "nam",
                    "southwest": "tÃ¢y nam",
                    "west": "tÃ¢y",
                    "northwest": "tÃ¢y báº¯c"
                },
                "modifier": {
                    "left": "trÃ¡i",
                    "right": "pháº£i",
                    "sharp left": "trÃ¡i gáº¯t",
                    "sharp right": "pháº£i gáº¯t",
                    "slight left": "trÃ¡i nghiÃªng",
                    "slight right": "pháº£i nghiÃªng",
                    "straight": "tháº³ng",
                    "uturn": "ngÆ°á»£c"
                },
                "lanes": {
                    "xo": "Äi bÃªn pháº£i",
                    "ox": "Äi bÃªn trÃ¡i",
                    "xox": "Äi vÃ o giá»¯a",
                    "oxo": "Äi bÃªn trÃ¡i hay bÃªn pháº£i"
                }
            },
            "modes": {
                "ferry": {
                    "default": "LÃªn phÃ ",
                    "name": "LÃªn phÃ  {way_name}",
                    "destination": "LÃªn phÃ  Ä‘i {destination}"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}, rá»“i {distance} ná»¯a thÃ¬ {instruction_two}",
                "two linked": "{instruction_one}, rá»“i {instruction_two}",
                "one in distance": "{distance} ná»¯a thÃ¬ {instruction_one}",
                "name and ref": "{name} ({ref})",
                "exit with number": "lá»‘i ra {exit}"
            },
            "arrive": {
                "default": {
                    "default": "Äáº¿n nÆ¡i {nth}",
                    "upcoming": "Äáº¿n nÆ¡i {nth}",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name}"
                },
                "left": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn trÃ¡i"
                },
                "right": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn pháº£i"
                },
                "sharp left": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn trÃ¡i"
                },
                "sharp right": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn pháº£i"
                },
                "slight right": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn pháº£i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn pháº£i"
                },
                "slight left": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ bÃªn trÃ¡i",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ bÃªn trÃ¡i"
                },
                "straight": {
                    "default": "Äáº¿n nÆ¡i {nth} á»Ÿ trÆ°á»›c máº·t",
                    "upcoming": "Äáº¿n nÆ¡i {nth} á»Ÿ trÆ°á»›c máº·t",
                    "short": "Äáº¿n nÆ¡i",
                    "short-upcoming": "Äáº¿n nÆ¡i",
                    "named": "Äáº¿n {waypoint_name} á»Ÿ trÆ°á»›c máº·t"
                }
            },
            "continue": {
                "default": {
                    "default": "Quáº¹o {modifier}",
                    "name": "Quáº¹o {modifier} Ä‘á»ƒ cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Quáº¹o {modifier} vá» {destination}",
                    "exit": "Quáº¹o {modifier} vÃ o {way_name}"
                },
                "straight": {
                    "default": "Cháº¡y tháº³ng",
                    "name": "Cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p vá» {destination}",
                    "distance": "Cháº¡y tháº³ng cho {distance}",
                    "namedistance": "Cháº¡y tiáº¿p trÃªn {way_name} cho {distance}"
                },
                "sharp left": {
                    "default": "Quáº¹o gáº¯t bÃªn trÃ¡i",
                    "name": "Quáº¹o gáº¯t bÃªn trÃ¡i Ä‘á»ƒ cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Quáº¹o gáº¯t bÃªn pháº£i",
                    "name": "Quáº¹o gáº¯t bÃªn pháº£i Ä‘á»ƒ cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn pháº£i vá» {destination}"
                },
                "slight left": {
                    "default": "NghiÃªng vá» bÃªn trÃ¡i",
                    "name": "NghiÃªng vá» bÃªn trÃ¡i Ä‘á»ƒ cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "NghiÃªng vá» bÃªn trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "NghiÃªng vá» bÃªn pháº£i",
                    "name": "NghiÃªng vá» bÃªn pháº£i Ä‘á»ƒ cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "NghiÃªng vá» bÃªn pháº£i vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i",
                    "name": "Quáº¹o ngÆ°á»£c láº¡i trÃªn {way_name}",
                    "destination": "Quáº¹o ngÆ°á»£c vá» {destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "Äi vá» hÆ°á»›ng {direction}",
                    "name": "Äi vá» hÆ°á»›ng {direction} trÃªn {way_name}",
                    "namedistance": "Äi vá» hÆ°á»›ng {direction} trÃªn {way_name} cho {distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "Quáº¹o {modifier}",
                    "name": "Quáº¹o {modifier} vÃ o {way_name}",
                    "destination": "Quáº¹o {modifier} vá» {destination}"
                },
                "straight": {
                    "default": "Cháº¡y tháº³ng",
                    "name": "Cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i táº¡i cuá»‘i Ä‘Æ°á»ng",
                    "name": "Quáº¹o ngÆ°á»£c vÃ o {way_name} táº¡i cuá»‘i Ä‘Æ°á»ng",
                    "destination": "Quáº¹o ngÆ°á»£c vá» {destination} táº¡i cuá»‘i Ä‘Æ°á»ng"
                }
            },
            "fork": {
                "default": {
                    "default": "Äi bÃªn {modifier} á»Ÿ ngÃ£ ba",
                    "name": "Giá»¯ bÃªn {modifier} vÃ o {way_name}",
                    "destination": "Giá»¯ bÃªn {modifier} vá» {destination}"
                },
                "slight left": {
                    "default": "NghiÃªng vá» bÃªn trÃ¡i á»Ÿ ngÃ£ ba",
                    "name": "Giá»¯ bÃªn trÃ¡i vÃ o {way_name}",
                    "destination": "Giá»¯ bÃªn trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "NghiÃªng vá» bÃªn pháº£i á»Ÿ ngÃ£ ba",
                    "name": "Giá»¯ bÃªn pháº£i vÃ o {way_name}",
                    "destination": "Giá»¯ bÃªn pháº£i vá» {destination}"
                },
                "sharp left": {
                    "default": "Quáº¹o gáº¯t bÃªn trÃ¡i á»Ÿ ngÃ£ ba",
                    "name": "Quáº¹o gáº¯t bÃªn trÃ¡i vÃ o {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Quáº¹o gáº¯t bÃªn pháº£i á»Ÿ ngÃ£ ba",
                    "name": "Quáº¹o gáº¯t bÃªn pháº£i vÃ o {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn pháº£i vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i",
                    "name": "Quáº¹o ngÆ°á»£c láº¡i {way_name}",
                    "destination": "Quáº¹o ngÆ°á»£c láº¡i vá» {destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "Nháº­p sang {modifier}",
                    "name": "Nháº­p sang {modifier} vÃ o {way_name}",
                    "destination": "Nháº­p sang {modifier} vá» {destination}"
                },
                "straight": {
                    "default": "Nháº­p Ä‘Æ°á»ng",
                    "name": "Nháº­p vÃ o {way_name}",
                    "destination": "Nháº­p Ä‘Æ°á»ng vá» {destination}"
                },
                "slight left": {
                    "default": "Nháº­p sang trÃ¡i",
                    "name": "Nháº­p sang trÃ¡i vÃ o {way_name}",
                    "destination": "Nháº­p sang trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "Nháº­p sang pháº£i",
                    "name": "Nháº­p sang pháº£i vÃ o {way_name}",
                    "destination": "Nháº­p sang pháº£i vá» {destination}"
                },
                "sharp left": {
                    "default": "Nháº­p sang trÃ¡i",
                    "name": "Nháº­p sang trÃ¡i vÃ o {way_name}",
                    "destination": "Nháº­p sang trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Nháº­p sang pháº£i",
                    "name": "Nháº­p sang pháº£i vÃ o {way_name}",
                    "destination": "Nháº­p sang pháº£i vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i",
                    "name": "Quáº¹o ngÆ°á»£c láº¡i {way_name}",
                    "destination": "Quáº¹o ngÆ°á»£c láº¡i vá» {destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "Cháº¡y tiáº¿p bÃªn {modifier}",
                    "name": "Cháº¡y tiáº¿p bÃªn {modifier} trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p bÃªn {modifier} vá» {destination}"
                },
                "straight": {
                    "default": "Cháº¡y tháº³ng",
                    "name": "Cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p vá» {destination}"
                },
                "sharp left": {
                    "default": "Quáº¹o gáº¯t bÃªn trÃ¡i",
                    "name": "Quáº¹o gáº¯t bÃªn trÃ¡i vÃ o {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Quáº¹o gáº¯t bÃªn pháº£i",
                    "name": "Quáº¹o gáº¯t bÃªn pháº£i vÃ o {way_name}",
                    "destination": "Quáº¹o gáº¯t bÃªn pháº£i vá» {destination}"
                },
                "slight left": {
                    "default": "NghiÃªng vá» bÃªn trÃ¡i",
                    "name": "NghiÃªng vá» bÃªn trÃ¡i vÃ o {way_name}",
                    "destination": "NghiÃªng vá» bÃªn trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "NghiÃªng vá» bÃªn pháº£i",
                    "name": "NghiÃªng vá» bÃªn pháº£i vÃ o {way_name}",
                    "destination": "NghiÃªng vá» bÃªn pháº£i vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i",
                    "name": "Quáº¹o ngÆ°á»£c láº¡i {way_name}",
                    "destination": "Quáº¹o ngÆ°á»£c láº¡i vá» {destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "Cháº¡y tiáº¿p bÃªn {modifier}",
                    "name": "Cháº¡y tiáº¿p bÃªn {modifier} trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p bÃªn {modifier} vá» {destination}"
                },
                "uturn": {
                    "default": "Quáº¹o ngÆ°á»£c láº¡i",
                    "name": "Quáº¹o ngÆ°á»£c láº¡i {way_name}",
                    "destination": "Quáº¹o ngÆ°á»£c láº¡i vá» {destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name}",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit}",
                    "exit_destination": "Äi theo lá»‘i ra {exit} vá» {destination}"
                },
                "left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i vá» {destination}"
                },
                "right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn pháº£i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn pháº£i vá» {destination}"
                },
                "sharp left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn pháº£i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn pháº£i vá» {destination}"
                },
                "slight left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}",
                    "exit": "Äi theo lá»‘i ra {exit} bÃªn pháº£i",
                    "exit_destination": "Äi theo lá»‘i ra {exit} bÃªn pháº£i vá» {destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name}",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh vá» {destination}"
                },
                "left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}"
                },
                "right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}"
                },
                "sharp left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}"
                },
                "sharp right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}"
                },
                "slight left": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn trÃ¡i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn trÃ¡i vá» {destination}"
                },
                "slight right": {
                    "default": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i",
                    "name": "Äi Ä‘Æ°á»ng nhÃ¡nh {way_name} bÃªn pháº£i",
                    "destination": "Äi Ä‘Æ°á»ng nhÃ¡nh bÃªn pháº£i vá» {destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "Äi vÃ o bÃ¹ng binh",
                        "name": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i {way_name}",
                        "destination": "Äi vÃ o bÃ¹ng binh vÃ  ra vá» {destination}"
                    },
                    "name": {
                        "default": "Äi vÃ o {rotary_name}",
                        "name": "Äi vÃ o {rotary_name} vÃ  ra táº¡i {way_name}",
                        "destination": "Äi vÃ  {rotary_name} vÃ  ra vá» {destination}"
                    },
                    "exit": {
                        "default": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number}",
                        "name": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} tá»©c {way_name}",
                        "destination": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} vá» {destination}"
                    },
                    "name_exit": {
                        "default": "Äi vÃ o {rotary_name} vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number}",
                        "name": "Äi vÃ o {rotary_name} vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} tá»©c {way_name}",
                        "destination": "Äi vÃ o {rotary_name} vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} vá» {destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number}",
                        "name": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} tá»©c {way_name}",
                        "destination": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i Ä‘Æ°á»ng {exit_number} vá» {destination}"
                    },
                    "default": {
                        "default": "Äi vÃ o bÃ¹ng binh",
                        "name": "Äi vÃ o bÃ¹ng binh vÃ  ra táº¡i {way_name}",
                        "destination": "Äi vÃ o bÃ¹ng binh vÃ  ra vá» {destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "Quáº¹o {modifier}",
                    "name": "Quáº¹o {modifier} vÃ o {way_name}",
                    "destination": "Quáº¹o {modifier} vá» {destination}"
                },
                "left": {
                    "default": "Quáº¹o trÃ¡i",
                    "name": "Quáº¹o trÃ¡i vÃ o {way_name}",
                    "destination": "Quáº¹o trÃ¡i vá» {destination}"
                },
                "right": {
                    "default": "Quáº¹o pháº£i",
                    "name": "Quáº¹o pháº£i vÃ o {way_name}",
                    "destination": "Quáº¹o pháº£i vá» {destination}"
                },
                "straight": {
                    "default": "Cháº¡y tháº³ng",
                    "name": "Cháº¡y tiáº¿p trÃªn {way_name}",
                    "destination": "Cháº¡y tiáº¿p vá» {destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "Ra bÃ¹ng binh",
                    "name": "Ra bÃ¹ng binh vÃ o {way_name}",
                    "destination": "Ra bÃ¹ng binh vá» {destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "Ra bÃ¹ng binh",
                    "name": "Ra bÃ¹ng binh vÃ o {way_name}",
                    "destination": "Ra bÃ¹ng binh vá» {destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "Quáº¹o {modifier}",
                    "name": "Quáº¹o {modifier} vÃ o {way_name}",
                    "destination": "Quáº¹o {modifier} vá» {destination}"
                },
                "left": {
                    "default": "Quáº¹o trÃ¡i",
                    "name": "Quáº¹o trÃ¡i vÃ o {way_name}",
                    "destination": "Quáº¹o trÃ¡i vá» {destination}"
                },
                "right": {
                    "default": "Quáº¹o pháº£i",
                    "name": "Quáº¹o pháº£i vÃ o {way_name}",
                    "destination": "Quáº¹o pháº£i vá» {destination}"
                },
                "straight": {
                    "default": "Cháº¡y tháº³ng",
                    "name": "Cháº¡y tháº³ng vÃ o {way_name}",
                    "destination": "Cháº¡y tháº³ng vá» {destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "Cháº¡y tháº³ng"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],47:[function(_dereq_,module,exports){
    module.exports={
        "meta": {
            "capitalizeFirstLetter": false
        },
        "v5": {
            "constants": {
                "ordinalize": {
                    "1": "ç¬¬ä¸€",
                    "2": "ç¬¬äºŒ",
                    "3": "ç¬¬ä¸‰",
                    "4": "ç¬¬å››",
                    "5": "ç¬¬äº”",
                    "6": "ç¬¬å…­",
                    "7": "ç¬¬ä¸ƒ",
                    "8": "ç¬¬å…«",
                    "9": "ç¬¬ä¹",
                    "10": "ç¬¬å"
                },
                "direction": {
                    "north": "åŒ—",
                    "northeast": "ä¸œåŒ—",
                    "east": "ä¸œ",
                    "southeast": "ä¸œå—",
                    "south": "å—",
                    "southwest": "è¥¿å—",
                    "west": "è¥¿",
                    "northwest": "è¥¿åŒ—"
                },
                "modifier": {
                    "left": "å‘å·¦",
                    "right": "å‘å³",
                    "sharp left": "æ€¥å‘å·¦",
                    "sharp right": "æ€¥å‘å³",
                    "slight left": "ç¨å‘å·¦",
                    "slight right": "ç¨å‘å³",
                    "straight": "ç›´è¡Œ",
                    "uturn": "è°ƒå¤´"
                },
                "lanes": {
                    "xo": "é å³è¡Œé©¶",
                    "ox": "é å·¦è¡Œé©¶",
                    "xox": "ä¿æŒåœ¨é“è·¯ä¸­é—´è¡Œé©¶",
                    "oxo": "ä¿æŒåœ¨é“è·¯å·¦ä¾§æˆ–å³ä¾§è¡Œé©¶"
                }
            },
            "modes": {
                "ferry": {
                    "default": "ä¹˜åè½®æ¸¡",
                    "name": "ä¹˜å{way_name}è½®æ¸¡",
                    "destination": "ä¹˜åå¼€å¾€{destination}çš„è½®æ¸¡"
                }
            },
            "phrase": {
                "two linked by distance": "{instruction_one}ï¼Œ{distance}åŽ{instruction_two}",
                "two linked": "{instruction_one}ï¼ŒéšåŽ{instruction_two}",
                "one in distance": "{distance}åŽ{instruction_one}",
                "name and ref": "{name}ï¼ˆ{ref}ï¼‰",
                "exit with number": "å‡ºå£{exit}"
            },
            "arrive": {
                "default": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}"
                },
                "left": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å·¦è¾¹ã€‚"
                },
                "right": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å³è¾¹ã€‚"
                },
                "sharp left": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å·¦è¾¹ã€‚"
                },
                "sharp right": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å³è¾¹ã€‚"
                },
                "slight right": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å·¦ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å³è¾¹ã€‚"
                },
                "slight left": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨é“è·¯å³ä¾§",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å·¦è¾¹ã€‚"
                },
                "straight": {
                    "default": "æ‚¨å·²ç»åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨æ‚¨æ­£å‰æ–¹",
                    "upcoming": "æ‚¨å³å°†åˆ°è¾¾æ‚¨çš„{nth}ä¸ªç›®çš„åœ°ï¼Œç›®çš„åœ°åœ¨æ‚¨æ­£å‰æ–¹",
                    "short": "å·²åˆ°è¾¾ç›®çš„åœ°",
                    "short-upcoming": "å³å°†åˆ°è¾¾ç›®çš„åœ°",
                    "named": "æ‚¨å·²åˆ°è¾¾{waypoint_name}ï¼Œç›®çš„åœ°åœ¨æ‚¨å‰æ–¹ã€‚"
                }
            },
            "continue": {
                "default": {
                    "default": "{modifier}è¡Œé©¶",
                    "name": "åœ¨{way_name}ä¸Šç»§ç»­{modifier}è¡Œé©¶",
                    "destination": "{modifier}è¡Œé©¶ï¼Œ{destination}æ–¹å‘",
                    "exit": "{modifier}è¡Œé©¶ï¼Œé©¶å…¥{way_name}"
                },
                "straight": {
                    "default": "ç»§ç»­ç›´è¡Œ",
                    "name": "åœ¨{way_name}ä¸Šç»§ç»­ç›´è¡Œ",
                    "destination": "ç»§ç»­ç›´è¡Œï¼Œå‰å¾€{destination}",
                    "distance": "ç»§ç»­ç›´è¡Œ{distance}",
                    "namedistance": "ç»§ç»­åœ¨{way_name}ä¸Šç›´è¡Œ{distance}"
                },
                "sharp left": {
                    "default": "å‰æ–¹å·¦æ€¥è½¬å¼¯",
                    "name": "å‰æ–¹å·¦æ€¥è½¬å¼¯ï¼Œç»§ç»­åœ¨{way_name}ä¸Šè¡Œé©¶",
                    "destination": "å·¦æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "å‰æ–¹å³æ€¥è½¬å¼¯",
                    "name": "å‰æ–¹å³æ€¥è½¬å¼¯ï¼Œç»§ç»­åœ¨{way_name}ä¸Šè¡Œé©¶",
                    "destination": "å³æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "å‰æ–¹ç¨å‘å·¦è½¬",
                    "name": "å‰æ–¹ç¨å‘å·¦è½¬ï¼Œç»§ç»­åœ¨{way_name}ä¸Šè¡Œé©¶",
                    "destination": "ç¨å‘å·¦è½¬ï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "å‰æ–¹ç¨å‘å³è½¬",
                    "name": "å‰æ–¹ç¨å‘å³è½¬ï¼Œç»§ç»­åœ¨{way_name}ä¸Šè¡Œé©¶",
                    "destination": "å‰æ–¹ç¨å‘å³è½¬ï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "å‰æ–¹è°ƒå¤´",
                    "name": "å‰æ–¹è°ƒå¤´ï¼Œç»§ç»­åœ¨{way_name}ä¸Šè¡Œé©¶",
                    "destination": "å‰æ–¹è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "depart": {
                "default": {
                    "default": "å‡ºå‘å‘{direction}",
                    "name": "å‡ºå‘å‘{direction}ï¼Œé©¶å…¥{way_name}",
                    "namedistance": "å‡ºå‘å‘{direction}ï¼Œåœ¨{way_name}ä¸Šç»§ç»­è¡Œé©¶{distance}"
                }
            },
            "end of road": {
                "default": {
                    "default": "{modifier}è¡Œé©¶",
                    "name": "{modifier}è¡Œé©¶ï¼Œé©¶å…¥{way_name}",
                    "destination": "{modifier}è¡Œé©¶ï¼Œå‰å¾€{destination}"
                },
                "straight": {
                    "default": "ç»§ç»­ç›´è¡Œ",
                    "name": "ç»§ç»­ç›´è¡Œï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­ç›´è¡Œï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "åœ¨é“è·¯å°½å¤´è°ƒå¤´",
                    "name": "åœ¨é“è·¯å°½å¤´è°ƒå¤´é©¶å…¥{way_name}",
                    "destination": "åœ¨é“è·¯å°½å¤´è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "fork": {
                "default": {
                    "default": "åœ¨å²”é“ä¿æŒ{modifier}",
                    "name": "åœ¨å²”é“å£ä¿æŒ{modifier}ï¼Œé©¶å…¥{way_name}",
                    "destination": "åœ¨å²”é“å£ä¿æŒ{modifier}ï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "åœ¨å²”é“å£ä¿æŒå·¦ä¾§è¡Œé©¶",
                    "name": "åœ¨å²”é“å£ä¿æŒå·¦ä¾§è¡Œé©¶ï¼Œé©¶å…¥{way_name}",
                    "destination": "åœ¨å²”é“å£ä¿æŒå·¦ä¾§è¡Œé©¶ï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "åœ¨å²”é“å£ä¿æŒå³ä¾§è¡Œé©¶",
                    "name": "åœ¨å²”é“å£ä¿æŒå³ä¾§è¡Œé©¶ï¼Œé©¶å…¥{way_name}",
                    "destination": "åœ¨å²”é“å£ä¿æŒå³ä¾§è¡Œé©¶ï¼Œå‰å¾€{destination}"
                },
                "sharp left": {
                    "default": "åœ¨å²”é“å£å·¦æ€¥è½¬å¼¯",
                    "name": "åœ¨å²”é“å£å·¦æ€¥è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "åœ¨å²”é“å£å·¦æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "åœ¨å²”é“å£å³æ€¥è½¬å¼¯",
                    "name": "åœ¨å²”é“å£å³æ€¥è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "åœ¨å²”é“å£å³æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "å‰æ–¹è°ƒå¤´",
                    "name": "å‰æ–¹è°ƒå¤´ï¼Œé©¶å…¥{way_name}",
                    "destination": "å‰æ–¹è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "merge": {
                "default": {
                    "default": "{modifier}å¹¶é“",
                    "name": "{modifier}å¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "{modifier}å¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "straight": {
                    "default": "ç›´è¡Œå¹¶é“",
                    "name": "ç›´è¡Œå¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç›´è¡Œå¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "ç¨å‘å·¦å¹¶é“",
                    "name": "ç¨å‘å·¦å¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å·¦å¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "ç¨å‘å³å¹¶é“",
                    "name": "ç¨å‘å³å¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å³å¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "sharp left": {
                    "default": "æ€¥å‘å·¦å¹¶é“",
                    "name": "æ€¥å‘å·¦å¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å·¦å¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "æ€¥å‘å³å¹¶é“",
                    "name": "æ€¥å‘å³å¹¶é“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å³å¹¶é“ï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "å‰æ–¹è°ƒå¤´",
                    "name": "å‰æ–¹è°ƒå¤´ï¼Œé©¶å…¥{way_name}",
                    "destination": "å‰æ–¹è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "new name": {
                "default": {
                    "default": "ç»§ç»­{modifier}",
                    "name": "ç»§ç»­{modifier}ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­{modifier}ï¼Œå‰å¾€{destination}"
                },
                "straight": {
                    "default": "ç»§ç»­ç›´è¡Œ",
                    "name": "ç»§ç»­åœ¨{way_name}ä¸Šç›´è¡Œ",
                    "destination": "ç»§ç»­ç›´è¡Œï¼Œå‰å¾€{destination}"
                },
                "sharp left": {
                    "default": "å‰æ–¹å·¦æ€¥è½¬å¼¯",
                    "name": "å‰æ–¹å·¦æ€¥è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "å·¦æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "å‰æ–¹å³æ€¥è½¬å¼¯",
                    "name": "å‰æ–¹å³æ€¥è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "å³æ€¥è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "ç»§ç»­ç¨å‘å·¦",
                    "name": "ç»§ç»­ç¨å‘å·¦ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­ç¨å‘å·¦ï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "ç»§ç»­ç¨å‘å³",
                    "name": "ç»§ç»­ç¨å‘å³ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­ç¨å‘å³ï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "å‰æ–¹è°ƒå¤´",
                    "name": "å‰æ–¹è°ƒå¤´ï¼Œä¸Š{way_name}",
                    "destination": "å‰æ–¹è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "notification": {
                "default": {
                    "default": "ç»§ç»­{modifier}",
                    "name": "ç»§ç»­{modifier}ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­{modifier}ï¼Œå‰å¾€{destination}"
                },
                "uturn": {
                    "default": "å‰æ–¹è°ƒå¤´",
                    "name": "å‰æ–¹è°ƒå¤´ï¼Œé©¶å…¥{way_name}",
                    "destination": "å‰æ–¹è°ƒå¤´ï¼Œå‰å¾€{destination}"
                }
            },
            "off ramp": {
                "default": {
                    "default": "ä¸‹åŒé“",
                    "name": "ä¸‹åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ä¸‹åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Ž{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Ž{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "left": {
                    "default": "ä¸‹å·¦ä¾§åŒé“",
                    "name": "ä¸‹å·¦ä¾§åŒé“ï¼Œä¸Š{way_name}",
                    "destination": "ä¸‹å·¦ä¾§åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "right": {
                    "default": "ä¸‹å³ä¾§åŒé“",
                    "name": "ä¸‹å³ä¾§åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ä¸‹å³ä¾§åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "sharp left": {
                    "default": "æ€¥å‘å·¦ä¸‹åŒé“",
                    "name": "æ€¥å‘å·¦ä¸‹åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å·¦ä¸‹åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "æ€¥å‘å³ä¸‹åŒé“",
                    "name": "æ€¥å‘å³ä¸‹åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å³ä¸‹åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "ç¨å‘å·¦ä¸‹åŒé“",
                    "name": "ç¨å‘å·¦ä¸‹åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å·¦ä¸‹åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå·¦ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "ç¨å‘å³ä¸‹åŒé“",
                    "name": "ç¨å‘å³ä¸‹åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å³ä¸‹åŒé“ï¼Œå‰å¾€{destination}",
                    "exit": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡º",
                    "exit_destination": "ä»Žå³ä¾§{exit}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                }
            },
            "on ramp": {
                "default": {
                    "default": "ä¸ŠåŒé“",
                    "name": "ä¸ŠåŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ä¸ŠåŒé“ï¼Œå‰å¾€{destination}"
                },
                "left": {
                    "default": "ä¸Šå·¦ä¾§åŒé“",
                    "name": "ä¸Šå·¦ä¾§åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ä¸Šå·¦ä¾§åŒé“ï¼Œå‰å¾€{destination}"
                },
                "right": {
                    "default": "ä¸Šå³ä¾§åŒé“",
                    "name": "ä¸Šå³ä¾§åŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ä¸Šå³ä¾§åŒé“ï¼Œå‰å¾€{destination}"
                },
                "sharp left": {
                    "default": "æ€¥å‘å·¦ä¸ŠåŒé“",
                    "name": "æ€¥å‘å·¦ä¸ŠåŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å·¦ä¸ŠåŒé“ï¼Œå‰å¾€{destination}"
                },
                "sharp right": {
                    "default": "æ€¥å‘å³ä¸ŠåŒé“",
                    "name": "æ€¥å‘å³ä¸ŠåŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "æ€¥å‘å³ä¸ŠåŒé“ï¼Œå‰å¾€{destination}"
                },
                "slight left": {
                    "default": "ç¨å‘å·¦ä¸ŠåŒé“",
                    "name": "ç¨å‘å·¦ä¸ŠåŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å·¦ä¸ŠåŒé“ï¼Œå‰å¾€{destination}"
                },
                "slight right": {
                    "default": "ç¨å‘å³ä¸ŠåŒé“",
                    "name": "ç¨å‘å³ä¸ŠåŒé“ï¼Œé©¶å…¥{way_name}",
                    "destination": "ç¨å‘å³ä¸ŠåŒé“ï¼Œå‰å¾€{destination}"
                }
            },
            "rotary": {
                "default": {
                    "default": {
                        "default": "è¿›å…¥çŽ¯å²›",
                        "name": "é€šè¿‡çŽ¯å²›åŽé©¶å…¥{way_name}",
                        "destination": "é€šè¿‡çŽ¯å²›åŽå‰å¾€{destination}"
                    },
                    "name": {
                        "default": "è¿›å…¥{rotary_name}çŽ¯å²›",
                        "name": "é€šè¿‡{rotary_name}çŽ¯å²›åŽé©¶å…¥{way_name}",
                        "destination": "é€šè¿‡{rotary_name}çŽ¯å²›åŽå‰å¾€{destination}"
                    },
                    "exit": {
                        "default": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡º",
                        "name": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œä¸Š{way_name}",
                        "destination": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                    },
                    "name_exit": {
                        "default": "è¿›å…¥{rotary_name}çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡º",
                        "name": "è¿›å…¥{rotary_name}çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œä¸Š{way_name}",
                        "destination": "è¿›å…¥{rotary_name}çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                    }
                }
            },
            "roundabout": {
                "default": {
                    "exit": {
                        "default": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡º",
                        "name": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œä¸Š{way_name}",
                        "destination": "è¿›å…¥çŽ¯å²›åŽä»Ž{exit_number}å‡ºå£é©¶å‡ºï¼Œå‰å¾€{destination}"
                    },
                    "default": {
                        "default": "è¿›å…¥çŽ¯å²›",
                        "name": "é€šè¿‡çŽ¯å²›åŽé©¶å…¥{way_name}",
                        "destination": "é€šè¿‡çŽ¯å²›åŽå‰å¾€{destination}"
                    }
                }
            },
            "roundabout turn": {
                "default": {
                    "default": "{modifier}è½¬å¼¯",
                    "name": "{modifier}è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "{modifier}è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "left": {
                    "default": "å·¦è½¬",
                    "name": "å·¦è½¬ï¼Œé©¶å…¥{way_name}",
                    "destination": "å·¦è½¬ï¼Œå‰å¾€{destination}"
                },
                "right": {
                    "default": "å³è½¬",
                    "name": "å³è½¬ï¼Œé©¶å…¥{way_name}",
                    "destination": "å³è½¬ï¼Œå‰å¾€{destination}"
                },
                "straight": {
                    "default": "ç»§ç»­ç›´è¡Œ",
                    "name": "ç»§ç»­ç›´è¡Œï¼Œé©¶å…¥{way_name}",
                    "destination": "ç»§ç»­ç›´è¡Œï¼Œå‰å¾€{destination}"
                }
            },
            "exit roundabout": {
                "default": {
                    "default": "é©¶ç¦»çŽ¯å²›",
                    "name": "é©¶ç¦»çŽ¯å²›ï¼Œé©¶å…¥{way_name}",
                    "destination": "é©¶ç¦»çŽ¯å²›ï¼Œå‰å¾€{destination}"
                }
            },
            "exit rotary": {
                "default": {
                    "default": "é©¶ç¦»çŽ¯å²›",
                    "name": "é©¶ç¦»çŽ¯å²›ï¼Œé©¶å…¥{way_name}",
                    "destination": "é©¶ç¦»çŽ¯å²›ï¼Œå‰å¾€{destination}"
                }
            },
            "turn": {
                "default": {
                    "default": "{modifier}è½¬å¼¯",
                    "name": "{modifier}è½¬å¼¯ï¼Œé©¶å…¥{way_name}",
                    "destination": "{modifier}è½¬å¼¯ï¼Œå‰å¾€{destination}"
                },
                "left": {
                    "default": "å·¦è½¬",
                    "name": "å·¦è½¬ï¼Œé©¶å…¥{way_name}",
                    "destination": "å·¦è½¬ï¼Œå‰å¾€{destination}"
                },
                "right": {
                    "default": "å³è½¬",
                    "name": "å³è½¬ï¼Œé©¶å…¥{way_name}",
                    "destination": "å³è½¬ï¼Œå‰å¾€{destination}"
                },
                "straight": {
                    "default": "ç›´è¡Œ",
                    "name": "ç›´è¡Œï¼Œé©¶å…¥{way_name}",
                    "destination": "ç›´è¡Œï¼Œå‰å¾€{destination}"
                }
            },
            "use lane": {
                "no_lanes": {
                    "default": "ç»§ç»­ç›´è¡Œ"
                },
                "default": {
                    "default": "{lane_instruction}"
                }
            }
        }
    }
    
    },{}],48:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        module.exports = L.Class.extend({
            options: {
                timeout: 500,
                blurTimeout: 100,
                noResultsMessage: 'No results found.'
            },
    
            initialize: function(elem, callback, context, options) {
                L.setOptions(this, options);
    
                this._elem = elem;
                this._resultFn = options.resultFn ? L.Util.bind(options.resultFn, options.resultContext) : null;
                this._autocomplete = options.autocompleteFn ? L.Util.bind(options.autocompleteFn, options.autocompleteContext) : null;
                this._selectFn = L.Util.bind(callback, context);
                this._container = L.DomUtil.create('div', 'leaflet-routing-geocoder-result');
                this._resultTable = L.DomUtil.create('table', '', this._container);
    
                // TODO: looks a bit like a kludge to register same for input and keypress -
                // browsers supporting both will get duplicate events; just registering
                // input will not catch enter, though.
                L.DomEvent.addListener(this._elem, 'input', this._keyPressed, this);
                L.DomEvent.addListener(this._elem, 'keypress', this._keyPressed, this);
                L.DomEvent.addListener(this._elem, 'keydown', this._keyDown, this);
                L.DomEvent.addListener(this._elem, 'blur', function() {
                    if (this._isOpen) {
                        this.close();
                    }
                }, this);
            },
    
            close: function() {
                L.DomUtil.removeClass(this._container, 'leaflet-routing-geocoder-result-open');
                this._isOpen = false;
            },
    
            _open: function() {
                var rect = this._elem.getBoundingClientRect();
                if (!this._container.parentElement) {
                    // See notes section under https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollX
                    // This abomination is required to support all flavors of IE
                    var scrollX = (window.pageXOffset !== undefined) ? window.pageXOffset
                        : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
                    var scrollY = (window.pageYOffset !== undefined) ? window.pageYOffset
                        : (document.documentElement || document.body.parentNode || document.body).scrollTop;
                    this._container.style.left = (rect.left + scrollX) + 'px';
                    this._container.style.top = (rect.bottom + scrollY) + 'px';
                    this._container.style.width = (rect.right - rect.left) + 'px';
                    document.body.appendChild(this._container);
                }
    
                L.DomUtil.addClass(this._container, 'leaflet-routing-geocoder-result-open');
                this._isOpen = true;
            },
    
            _setResults: function(results) {
                var i,
                    tr,
                    td,
                    text;
    
                delete this._selection;
                this._results = results;
    
                while (this._resultTable.firstChild) {
                    this._resultTable.removeChild(this._resultTable.firstChild);
                }
    
                for (i = 0; i < results.length; i++) {
                    tr = L.DomUtil.create('tr', '', this._resultTable);
                    tr.setAttribute('data-result-index', i);
                    td = L.DomUtil.create('td', '', tr);
                    text = document.createTextNode(results[i].name);
                    td.appendChild(text);
                    // mousedown + click because:
                    // http://stackoverflow.com/questions/10652852/jquery-fire-click-before-blur-event
                    L.DomEvent.addListener(td, 'mousedown', L.DomEvent.preventDefault);
                    L.DomEvent.addListener(td, 'click', this._createClickListener(results[i]));
                }
    
                if (!i) {
                    tr = L.DomUtil.create('tr', '', this._resultTable);
                    td = L.DomUtil.create('td', 'leaflet-routing-geocoder-no-results', tr);
                    td.innerHTML = this.options.noResultsMessage;
                }
    
                this._open();
    
                if (results.length > 0) {
                    // Select the first entry
                    this._select(1);
                }
            },
    
            _createClickListener: function(r) {
                var resultSelected = this._resultSelected(r);
                return L.bind(function() {
                    this._elem.blur();
                    resultSelected();
                }, this);
            },
    
            _resultSelected: function(r) {
                return L.bind(function() {
                    this.close();
                    this._elem.value = r.name;
                    this._lastCompletedText = r.name;
                    this._selectFn(r);
                }, this);
            },
    
            _keyPressed: function(e) {
                var index;
    
                if (this._isOpen && e.keyCode === 13 && this._selection) {
                    index = parseInt(this._selection.getAttribute('data-result-index'), 10);
                    this._resultSelected(this._results[index])();
                    L.DomEvent.preventDefault(e);
                    return;
                }
    
                if (e.keyCode === 13) {
                    L.DomEvent.preventDefault(e);
                    this._complete(this._resultFn, true);
                    return;
                }
    
                if (this._autocomplete && document.activeElement === this._elem) {
                    if (this._timer) {
                        clearTimeout(this._timer);
                    }
                    this._timer = setTimeout(L.Util.bind(function() { this._complete(this._autocomplete); }, this),
                        this.options.timeout);
                    return;
                }
    
                this._unselect();
            },
    
            _select: function(dir) {
                var sel = this._selection;
                if (sel) {
                    L.DomUtil.removeClass(sel.firstChild, 'leaflet-routing-geocoder-selected');
                    sel = sel[dir > 0 ? 'nextSibling' : 'previousSibling'];
                }
                if (!sel) {
                    sel = this._resultTable[dir > 0 ? 'firstChild' : 'lastChild'];
                }
    
                if (sel) {
                    L.DomUtil.addClass(sel.firstChild, 'leaflet-routing-geocoder-selected');
                    this._selection = sel;
                }
            },
    
            _unselect: function() {
                if (this._selection) {
                    L.DomUtil.removeClass(this._selection.firstChild, 'leaflet-routing-geocoder-selected');
                }
                delete this._selection;
            },
    
            _keyDown: function(e) {
                if (this._isOpen) {
                    switch (e.keyCode) {
                    // Escape
                    case 27:
                        this.close();
                        L.DomEvent.preventDefault(e);
                        return;
                    // Up
                    case 38:
                        this._select(-1);
                        L.DomEvent.preventDefault(e);
                        return;
                    // Down
                    case 40:
                        this._select(1);
                        L.DomEvent.preventDefault(e);
                        return;
                    }
                }
            },
    
            _complete: function(completeFn, trySelect) {
                var v = this._elem.value;
                function completeResults(results) {
                    this._lastCompletedText = v;
                    if (trySelect && results.length === 1) {
                        this._resultSelected(results[0])();
                    } else {
                        this._setResults(results);
                    }
                }
    
                if (!v) {
                    return;
                }
    
                if (v !== this._lastCompletedText) {
                    completeFn(v, completeResults, this);
                } else if (trySelect) {
                    completeResults.call(this, this._results);
                }
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}],49:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        var Itinerary = _dereq_('./itinerary');
        var Line = _dereq_('./line');
        var Plan = _dereq_('./plan');
        var OSRMv1 = _dereq_('./osrm-v1');
    
        module.exports = Itinerary.extend({
            options: {
                fitSelectedRoutes: 'smart',
                routeLine: function(route, options) { return new Line(route, options); },
                autoRoute: true,
                routeWhileDragging: false,
                routeDragInterval: 500,
                waypointMode: 'connect',
                showAlternatives: false,
                defaultErrorHandler: function(e) {
                    console.error('Routing error:', e.error);
                }
            },
    
            initialize: function(options) {
                L.Util.setOptions(this, options);
    
                this._router = this.options.router || new OSRMv1(options);
                this._plan = this.options.plan || new Plan(this.options.waypoints, options);
                this._requestCount = 0;
    
                Itinerary.prototype.initialize.call(this, options);
    
                this.on('routeselected', this._routeSelected, this);
                if (this.options.defaultErrorHandler) {
                    this.on('routingerror', this.options.defaultErrorHandler);
                }
                this._plan.on('waypointschanged', this._onWaypointsChanged, this);
                if (options.routeWhileDragging) {
                    this._setupRouteDragging();
                }
            },
    
            _onZoomEnd: function() {
                if (!this._selectedRoute ||
                    !this._router.requiresMoreDetail) {
                    return;
                }
    
                var map = this._map;
                if (this._router.requiresMoreDetail(this._selectedRoute,
                        map.getZoom(), map.getBounds())) {
                    this.route({
                        callback: L.bind(function(err, routes) {
                            var i;
                            if (!err) {
                                for (i = 0; i < routes.length; i++) {
                                    this._routes[i].properties = routes[i].properties;
                                }
                                this._updateLineCallback(err, routes);
                            }
    
                        }, this),
                        simplifyGeometry: false,
                        geometryOnly: true
                    });
                }
            },
    
            onAdd: function(map) {
                if (this.options.autoRoute) {
                    this.route();
                }
    
                var container = Itinerary.prototype.onAdd.call(this, map);
    
                this._map = map;
                this._map.addLayer(this._plan);
    
                this._map.on('zoomend', this._onZoomEnd, this);
    
                if (this._plan.options.geocoder) {
                    container.insertBefore(this._plan.createGeocoders(), container.firstChild);
                }
    
                return container;
            },
    
            onRemove: function(map) {
                map.off('zoomend', this._onZoomEnd, this);
                if (this._line) {
                    map.removeLayer(this._line);
                }
                map.removeLayer(this._plan);
                if (this._alternatives && this._alternatives.length > 0) {
                    for (var i = 0, len = this._alternatives.length; i < len; i++) {
                        map.removeLayer(this._alternatives[i]);
                    }
                }
                return Itinerary.prototype.onRemove.call(this, map);
            },
    
            getWaypoints: function() {
                return this._plan.getWaypoints();
            },
    
            setWaypoints: function(waypoints) {
                this._plan.setWaypoints(waypoints);
                return this;
            },
    
            spliceWaypoints: function() {
                var removed = this._plan.spliceWaypoints.apply(this._plan, arguments);
                return removed;
            },
    
            getPlan: function() {
                return this._plan;
            },
    
            getRouter: function() {
                return this._router;
            },
    
            _routeSelected: function(e) {
                var route = this._selectedRoute = e.route,
                    alternatives = this.options.showAlternatives && e.alternatives,
                    fitMode = this.options.fitSelectedRoutes,
                    fitBounds =
                        (fitMode === 'smart' && !this._waypointsVisible()) ||
                        (fitMode !== 'smart' && fitMode);
    
                this._updateLines({route: route, alternatives: alternatives});
    
                if (fitBounds) {
                    this._map.fitBounds(this._line.getBounds());
                }
    
                if (this.options.waypointMode === 'snap') {
                    this._plan.off('waypointschanged', this._onWaypointsChanged, this);
                    this.setWaypoints(route.waypoints);
                    this._plan.on('waypointschanged', this._onWaypointsChanged, this);
                }
            },
    
            _waypointsVisible: function() {
                var wps = this.getWaypoints(),
                    mapSize,
                    bounds,
                    boundsSize,
                    i,
                    p;
    
                try {
                    mapSize = this._map.getSize();
    
                    for (i = 0; i < wps.length; i++) {
                        p = this._map.latLngToLayerPoint(wps[i].latLng);
    
                        if (bounds) {
                            bounds.extend(p);
                        } else {
                            bounds = L.bounds([p]);
                        }
                    }
    
                    boundsSize = bounds.getSize();
                    return (boundsSize.x > mapSize.x / 5 ||
                        boundsSize.y > mapSize.y / 5) && this._waypointsInViewport();
    
                } catch (e) {
                    return false;
                }
            },
    
            _waypointsInViewport: function() {
                var wps = this.getWaypoints(),
                    mapBounds,
                    i;
    
                try {
                    mapBounds = this._map.getBounds();
                } catch (e) {
                    return false;
                }
    
                for (i = 0; i < wps.length; i++) {
                    if (mapBounds.contains(wps[i].latLng)) {
                        return true;
                    }
                }
    
                return false;
            },
    
            _updateLines: function(routes) {
                var addWaypoints = this.options.addWaypoints !== undefined ?
                    this.options.addWaypoints : true;
                this._clearLines();
    
                // add alternatives first so they lie below the main route
                this._alternatives = [];
                if (routes.alternatives) routes.alternatives.forEach(function(alt, i) {
                    this._alternatives[i] = this.options.routeLine(alt,
                        L.extend({
                            isAlternative: true
                        }, this.options.altLineOptions || this.options.lineOptions));
                    this._alternatives[i].addTo(this._map);
                    this._hookAltEvents(this._alternatives[i]);
                }, this);
    
                this._line = this.options.routeLine(routes.route,
                    L.extend({
                        addWaypoints: addWaypoints,
                        extendToWaypoints: this.options.waypointMode === 'connect'
                    }, this.options.lineOptions));
                this._line.addTo(this._map);
                this._hookEvents(this._line);
            },
    
            _hookEvents: function(l) {
                l.on('linetouched', function(e) {
                    this._plan.dragNewWaypoint(e);
                }, this);
            },
    
            _hookAltEvents: function(l) {
                l.on('linetouched', function(e) {
                    var alts = this._routes.slice();
                    var selected = alts.splice(e.target._route.routesIndex, 1)[0];
                    this.fire('routeselected', {route: selected, alternatives: alts});
                }, this);
            },
    
            _onWaypointsChanged: function(e) {
                if (this.options.autoRoute) {
                    this.route({});
                }
                if (!this._plan.isReady()) {
                    this._clearLines();
                    this._clearAlts();
                }
                this.fire('waypointschanged', {waypoints: e.waypoints});
            },
    
            _setupRouteDragging: function() {
                var timer = 0,
                    waypoints;
    
                this._plan.on('waypointdrag', L.bind(function(e) {
                    waypoints = e.waypoints;
    
                    if (!timer) {
                        timer = setTimeout(L.bind(function() {
                            this.route({
                                waypoints: waypoints,
                                geometryOnly: true,
                                callback: L.bind(this._updateLineCallback, this)
                            });
                            timer = undefined;
                        }, this), this.options.routeDragInterval);
                    }
                }, this));
                this._plan.on('waypointdragend', function() {
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    this.route();
                }, this);
            },
    
            _updateLineCallback: function(err, routes) {
                if (!err) {
                    routes = routes.slice();
                    var selected = routes.splice(this._selectedRoute.routesIndex, 1)[0];
                    this._updateLines({
                        route: selected,
                        alternatives: this.options.showAlternatives ? routes : []
                    });
                } else if (err.type !== 'abort') {
                    this._clearLines();
                }
            },
    
            route: function(options) {
                var ts = ++this._requestCount,
                    wps;
    
                if (this._pendingRequest && this._pendingRequest.abort) {
                    this._pendingRequest.abort();
                    this._pendingRequest = null;
                }
    
                options = options || {};
    
                if (this._plan.isReady()) {
                    if (this.options.useZoomParameter) {
                        options.z = this._map && this._map.getZoom();
                    }
    
                    wps = options && options.waypoints || this._plan.getWaypoints();
                    this.fire('routingstart', {waypoints: wps});
                    this._pendingRequest = this._router.route(wps, function(err, routes) {
                        this._pendingRequest = null;
    
                        if (options.callback) {
                            return options.callback.call(this, err, routes);
                        }
    
                        // Prevent race among multiple requests,
                        // by checking the current request's count
                        // against the last request's; ignore result if
                        // this isn't the last request.
                        if (ts === this._requestCount) {
                            this._clearLines();
                            this._clearAlts();
                            if (err && err.type !== 'abort') {
                                this.fire('routingerror', {error: err});
                                return;
                            }
    
                            routes.forEach(function(route, i) { route.routesIndex = i; });
    
                            if (!options.geometryOnly) {
                                this.fire('routesfound', {waypoints: wps, routes: routes});
                                this.setAlternatives(routes);
                            } else {
                                var selectedRoute = routes.splice(0,1)[0];
                                this._routeSelected({route: selectedRoute, alternatives: routes});
                            }
                        }
                    }, this, options);
                }
            },
    
            _clearLines: function() {
                if (this._line) {
                    this._map.removeLayer(this._line);
                    delete this._line;
                }
                if (this._alternatives && this._alternatives.length) {
                    for (var i in this._alternatives) {
                        this._map.removeLayer(this._alternatives[i]);
                    }
                    this._alternatives = [];
                }
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./itinerary":55,"./line":56,"./osrm-v1":59,"./plan":60}],50:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        module.exports = L.Control.extend({
            options: {
                header: 'Routing error',
                formatMessage: function(error) {
                    if (error.status < 0) {
                        return 'Calculating the route caused an error. Technical description follows: <code><pre>' +
                            error.message + '</pre></code';
                    } else {
                        return 'The route could not be calculated. ' +
                            error.message;
                    }
                }
            },
    
            initialize: function(routingControl, options) {
                L.Control.prototype.initialize.call(this, options);
                routingControl
                    .on('routingerror', L.bind(function(e) {
                        if (this._element) {
                            this._element.children[1].innerHTML = this.options.formatMessage(e.error);
                            this._element.style.visibility = 'visible';
                        }
                    }, this))
                    .on('routingstart', L.bind(function() {
                        if (this._element) {
                            this._element.style.visibility = 'hidden';
                        }
                    }, this));
            },
    
            onAdd: function() {
                var header,
                    message;
    
                this._element = L.DomUtil.create('div', 'leaflet-bar leaflet-routing-error');
                this._element.style.visibility = 'hidden';
    
                header = L.DomUtil.create('h3', null, this._element);
                message = L.DomUtil.create('span', null, this._element);
    
                header.innerHTML = this.options.header;
    
                return this._element;
            },
    
            onRemove: function() {
                delete this._element;
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}],51:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        var Localization = _dereq_('./localization');
    
        module.exports = L.Class.extend({
            options: {
                units: 'metric',
                unitNames: null,
                language: 'en',
                roundingSensitivity: 1,
                distanceTemplate: '{value} {unit}'
            },
    
            initialize: function(options) {
                L.setOptions(this, options);
    
                var langs = L.Util.isArray(this.options.language) ?
                    this.options.language :
                    [this.options.language, 'en'];
                this._localization = new Localization(langs);
            },
    
            formatDistance: function(d /* Number (meters) */, sensitivity) {
                var un = this.options.unitNames || this._localization.localize('units'),
                    simpleRounding = sensitivity <= 0,
                    round = simpleRounding ? function(v) { return v; } : L.bind(this._round, this),
                    v,
                    yards,
                    data,
                    pow10;
    
                if (this.options.units === 'imperial') {
                    yards = d / 0.9144;
                    if (yards >= 1000) {
                        data = {
                            value: round(d / 1609.344, sensitivity),
                            unit: un.miles
                        };
                    } else {
                        data = {
                            value: round(yards, sensitivity),
                            unit: un.yards
                        };
                    }
                } else {
                    v = round(d, sensitivity);
                    data = {
                        value: v >= 1000 ? (v / 1000) : v,
                        unit: v >= 1000 ? un.kilometers : un.meters
                    };
                }
    
                if (simpleRounding) {
                    data.value = data.value.toFixed(-sensitivity);
                }
    
                return L.Util.template(this.options.distanceTemplate, data);
            },
    
            _round: function(d, sensitivity) {
                var s = sensitivity || this.options.roundingSensitivity,
                    pow10 = Math.pow(10, (Math.floor(d / s) + '').length - 1),
                    r = Math.floor(d / pow10),
                    p = (r > 5) ? pow10 : pow10 / 2;
    
                return Math.round(d / p) * p;
            },
    
            formatTime: function(t /* Number (seconds) */) {
                var un = this.options.unitNames || this._localization.localize('units');
                // More than 30 seconds precision looks ridiculous
                t = Math.round(t / 30) * 30;
    
                if (t > 86400) {
                    return Math.round(t / 3600) + ' ' + un.hours;
                } else if (t > 3600) {
                    return Math.floor(t / 3600) + ' ' + un.hours + ' ' +
                        Math.round((t % 3600) / 60) + ' ' + un.minutes;
                } else if (t > 300) {
                    return Math.round(t / 60) + ' ' + un.minutes;
                } else if (t > 60) {
                    return Math.floor(t / 60) + ' ' + un.minutes +
                        (t % 60 !== 0 ? ' ' + (t % 60) + ' ' + un.seconds : '');
                } else {
                    return t + ' ' + un.seconds;
                }
            },
    
            formatInstruction: function(instr, i) {
                if (instr.text === undefined) {
                    return this.capitalize(L.Util.template(this._getInstructionTemplate(instr, i),
                        L.extend({}, instr, {
                            exitStr: instr.exit ? this._localization.localize('formatOrder')(instr.exit) : '',
                            dir: this._localization.localize(['directions', instr.direction]),
                            modifier: this._localization.localize(['directions', instr.modifier])
                        })));
                } else {
                    return instr.text;
                }
            },
    
            getIconName: function(instr, i) {
                switch (instr.type) {
                case 'Head':
                    if (i === 0) {
                        return 'depart';
                    }
                    break;
                case 'WaypointReached':
                    return 'via';
                case 'Roundabout':
                    return 'enter-roundabout';
                case 'DestinationReached':
                    return 'arrive';
                }
    
                switch (instr.modifier) {
                case 'Straight':
                    return 'continue';
                case 'SlightRight':
                    return 'bear-right';
                case 'Right':
                    return 'turn-right';
                case 'SharpRight':
                    return 'sharp-right';
                case 'TurnAround':
                case 'Uturn':
                    return 'u-turn';
                case 'SharpLeft':
                    return 'sharp-left';
                case 'Left':
                    return 'turn-left';
                case 'SlightLeft':
                    return 'bear-left';
                }
            },
    
            capitalize: function(s) {
                return s.charAt(0).toUpperCase() + s.substring(1);
            },
    
            _getInstructionTemplate: function(instr, i) {
                var type = instr.type === 'Straight' ? (i === 0 ? 'Head' : 'Continue') : instr.type,
                    strings = this._localization.localize(['instructions', type]);
    
                if (!strings) {
                    strings = [
                        this._localization.localize(['directions', type]),
                        ' ' + this._localization.localize(['instructions', 'Onto'])
                    ];
                }
    
                return strings[0] + (strings.length > 1 && instr.road ? strings[1] : '');
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./localization":57}],52:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
        var Autocomplete = _dereq_('./autocomplete');
        var Localization = _dereq_('./localization');
    
        function selectInputText(input) {
            if (input.setSelectionRange) {
                // On iOS, select() doesn't work
                input.setSelectionRange(0, 9999);
            } else {
                // On at least IE8, setSeleectionRange doesn't exist
                input.select();
            }
        }
    
        module.exports = L.Class.extend({
            includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),
    
            options: {
                createGeocoder: function(i, nWps, options) {
                    var container = L.DomUtil.create('div', 'leaflet-routing-geocoder'),
                        input = L.DomUtil.create('input', '', container),
                        remove = options.addWaypoints ? L.DomUtil.create('span', 'leaflet-routing-remove-waypoint', container) : undefined;
    
                    input.disabled = !options.addWaypoints;
    
                    return {
                        container: container,
                        input: input,
                        closeButton: remove
                    };
                },
                geocoderPlaceholder: function(i, numberWaypoints, geocoderElement) {
                    var l = new Localization(geocoderElement.options.language).localize('ui');
                    return i === 0 ?
                        l.startPlaceholder :
                        (i < numberWaypoints - 1 ?
                            L.Util.template(l.viaPlaceholder, {viaNumber: i}) :
                            l.endPlaceholder);
                },
    
                geocoderClass: function() {
                    return '';
                },
    
                waypointNameFallback: function(latLng) {
                    var ns = latLng.lat < 0 ? 'S' : 'N',
                        ew = latLng.lng < 0 ? 'W' : 'E',
                        lat = (Math.round(Math.abs(latLng.lat) * 10000) / 10000).toString(),
                        lng = (Math.round(Math.abs(latLng.lng) * 10000) / 10000).toString();
                    return ns + lat + ', ' + ew + lng;
                },
                maxGeocoderTolerance: 200,
                autocompleteOptions: {},
                language: 'en',
            },
    
            initialize: function(wp, i, nWps, options) {
                L.setOptions(this, options);
    
                var g = this.options.createGeocoder(i, nWps, this.options),
                    closeButton = g.closeButton,
                    geocoderInput = g.input;
                geocoderInput.setAttribute('placeholder', this.options.geocoderPlaceholder(i, nWps, this));
                geocoderInput.className = this.options.geocoderClass(i, nWps);
    
                this._element = g;
                this._waypoint = wp;
    
                this.update();
                // This has to be here, or geocoder's value will not be properly
                // initialized.
                // TODO: look into why and make _updateWaypointName fix this.
                geocoderInput.value = wp.name;
    
                L.DomEvent.addListener(geocoderInput, 'click', function() {
                    selectInputText(this);
                }, geocoderInput);
    
                if (closeButton) {
                    L.DomEvent.addListener(closeButton, 'click', function() {
                        this.fire('delete', { waypoint: this._waypoint });
                    }, this);
                }
    
                new Autocomplete(geocoderInput, function(r) {
                        geocoderInput.value = r.name;
                        wp.name = r.name;
                        wp.latLng = r.center;
                        this.fire('geocoded', { waypoint: wp, value: r });
                    }, this, L.extend({
                        resultFn: this.options.geocoder.geocode,
                        resultContext: this.options.geocoder,
                        autocompleteFn: this.options.geocoder.suggest,
                        autocompleteContext: this.options.geocoder
                    }, this.options.autocompleteOptions));
            },
    
            getContainer: function() {
                return this._element.container;
            },
    
            setValue: function(v) {
                this._element.input.value = v;
            },
    
            update: function(force) {
                var wp = this._waypoint,
                    wpCoords;
    
                wp.name = wp.name || '';
    
                if (wp.latLng && (force || !wp.name)) {
                    wpCoords = this.options.waypointNameFallback(wp.latLng);
                    if (this.options.geocoder && this.options.geocoder.reverse) {
                        this.options.geocoder.reverse(wp.latLng, 67108864 /* zoom 18 */, function(rs) {
                            if (rs.length > 0 && rs[0].center.distanceTo(wp.latLng) < this.options.maxGeocoderTolerance) {
                                wp.name = rs[0].name;
                            } else {
                                wp.name = wpCoords;
                            }
                            this._update();
                        }, this);
                    } else {
                        wp.name = wpCoords;
                        this._update();
                    }
                }
            },
    
            focus: function() {
                var input = this._element.input;
                input.focus();
                selectInputText(input);
            },
    
            _update: function() {
                var wp = this._waypoint,
                    value = wp && wp.name ? wp.name : '';
                this.setValue(value);
                this.fire('reversegeocoded', {waypoint: wp, value: value});
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./autocomplete":48,"./localization":57}],53:[function(_dereq_,module,exports){
    (function (global){
    var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null),
        Control = _dereq_('./control'),
        Itinerary = _dereq_('./itinerary'),
        Line = _dereq_('./line'),
        OSRMv1 = _dereq_('./osrm-v1'),
        Plan = _dereq_('./plan'),
        Waypoint = _dereq_('./waypoint'),
        Autocomplete = _dereq_('./autocomplete'),
        Formatter = _dereq_('./formatter'),
        GeocoderElement = _dereq_('./geocoder-element'),
        Localization = _dereq_('./localization'),
        ItineraryBuilder = _dereq_('./itinerary-builder'),
        Mapbox = _dereq_('./mapbox'),
        ErrorControl = _dereq_('./error-control');
    
    L.routing = {
        control: function(options) { return new Control(options); },
        itinerary: function(options) {
            return Itinerary(options);
        },
        line: function(route, options) {
            return new Line(route, options);
        },
        plan: function(waypoints, options) {
            return new Plan(waypoints, options);
        },
        waypoint: function(latLng, name, options) {
            return new Waypoint(latLng, name, options);
        },
        osrmv1: function(options) {
            return new OSRMv1(options);
        },
        localization: function(options) {
            return new Localization(options);
        },
        formatter: function(options) {
            return new Formatter(options);
        },
        geocoderElement: function(wp, i, nWps, plan) {
            return new L.Routing.GeocoderElement(wp, i, nWps, plan);
        },
        itineraryBuilder: function(options) {
            return new ItineraryBuilder(options);
        },
        mapbox: function(accessToken, options) {
            return new Mapbox(accessToken, options);
        },
        errorControl: function(routingControl, options) {
            return new ErrorControl(routingControl, options);
        },
        autocomplete: function(elem, callback, context, options) {
            return new Autocomplete(elem, callback, context, options);
        }
    };
    
    module.exports = L.Routing = {
        Control: Control,
        Itinerary: Itinerary,
        Line: Line,
        OSRMv1: OSRMv1,
        Plan: Plan,
        Waypoint: Waypoint,
        Autocomplete: Autocomplete,
        Formatter: Formatter,
        GeocoderElement: GeocoderElement,
        Localization: Localization,
        Formatter: Formatter,
        ItineraryBuilder: ItineraryBuilder,
    
        // Legacy; remove these in next major release
        control: L.routing.control,
        itinerary: L.routing.itinerary,
        line: L.routing.line,
        plan: L.routing.plan,
        waypoint: L.routing.waypoint,
        osrmv1: L.routing.osrmv1,
        geocoderElement: L.routing.geocoderElement,
        mapbox: L.routing.mapbox,
        errorControl: L.routing.errorControl,
    };
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./autocomplete":48,"./control":49,"./error-control":50,"./formatter":51,"./geocoder-element":52,"./itinerary":55,"./itinerary-builder":54,"./line":56,"./localization":57,"./mapbox":58,"./osrm-v1":59,"./plan":60,"./waypoint":61}],54:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        module.exports = L.Class.extend({
            options: {
                containerClassName: ''
            },
    
            initialize: function(options) {
                L.setOptions(this, options);
            },
    
            createContainer: function(className) {
                var table = L.DomUtil.create('table', (className || '') + ' ' + this.options.containerClassName),
                    colgroup = L.DomUtil.create('colgroup', '', table);
    
                L.DomUtil.create('col', 'leaflet-routing-instruction-icon', colgroup);
                L.DomUtil.create('col', 'leaflet-routing-instruction-text', colgroup);
                L.DomUtil.create('col', 'leaflet-routing-instruction-distance', colgroup);
    
                return table;
            },
    
            createStepsContainer: function() {
                return L.DomUtil.create('tbody', '');
            },
    
            createStep: function(text, distance, icon, steps) {
                var row = L.DomUtil.create('tr', '', steps),
                    span,
                    td;
                td = L.DomUtil.create('td', '', row);
                span = L.DomUtil.create('span', 'leaflet-routing-icon leaflet-routing-icon-'+icon, td);
                td.appendChild(span);
                td = L.DomUtil.create('td', '', row);
                td.appendChild(document.createTextNode(text));
                td = L.DomUtil.create('td', '', row);
                td.appendChild(document.createTextNode(distance));
                return row;
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}],55:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
        var Formatter = _dereq_('./formatter');
        var ItineraryBuilder = _dereq_('./itinerary-builder');
    
        module.exports = L.Control.extend({
            includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),
    
            options: {
                pointMarkerStyle: {
                    radius: 5,
                    color: '#03f',
                    fillColor: 'white',
                    opacity: 1,
                    fillOpacity: 0.7
                },
                summaryTemplate: '<h2>{name}</h2><h3>{distance}, {time}</h3>',
                timeTemplate: '{time}',
                containerClassName: '',
                alternativeClassName: '',
                minimizedClassName: '',
                itineraryClassName: '',
                totalDistanceRoundingSensitivity: -1,
                show: true,
                collapsible: undefined,
                collapseBtn: function(itinerary) {
                    var collapseBtn = L.DomUtil.create('span', itinerary.options.collapseBtnClass);
                    L.DomEvent.on(collapseBtn, 'click', itinerary._toggle, itinerary);
                    itinerary._container.insertBefore(collapseBtn, itinerary._container.firstChild);
                },
                collapseBtnClass: 'leaflet-routing-collapse-btn'
            },
    
            initialize: function(options) {
                L.setOptions(this, options);
                this._formatter = this.options.formatter || new Formatter(this.options);
                this._itineraryBuilder = this.options.itineraryBuilder || new ItineraryBuilder({
                    containerClassName: this.options.itineraryClassName
                });
            },
    
            onAdd: function(map) {
                var collapsible = this.options.collapsible;
    
                collapsible = collapsible || (collapsible === undefined && map.getSize().x <= 640);
    
                this._container = L.DomUtil.create('div', 'leaflet-routing-container leaflet-bar ' +
                    (!this.options.show ? 'leaflet-routing-container-hide ' : '') +
                    (collapsible ? 'leaflet-routing-collapsible ' : '') +
                    this.options.containerClassName);
                this._altContainer = this.createAlternativesContainer();
                this._container.appendChild(this._altContainer);
                L.DomEvent.disableClickPropagation(this._container);
                L.DomEvent.addListener(this._container, 'mousewheel', function(e) {
                    L.DomEvent.stopPropagation(e);
                });
    
                if (collapsible) {
                    this.options.collapseBtn(this);
                }
    
                return this._container;
            },
    
            onRemove: function() {
            },
    
            createAlternativesContainer: function() {
                return L.DomUtil.create('div', 'leaflet-routing-alternatives-container');
            },
    
            setAlternatives: function(routes) {
                var i,
                    alt,
                    altDiv;
    
                this._clearAlts();
    
                this._routes = routes;
    
                for (i = 0; i < this._routes.length; i++) {
                    alt = this._routes[i];
                    altDiv = this._createAlternative(alt, i);
                    this._altContainer.appendChild(altDiv);
                    this._altElements.push(altDiv);
                }
    
                this._selectRoute({route: this._routes[0], alternatives: this._routes.slice(1)});
    
                return this;
            },
    
            show: function() {
                L.DomUtil.removeClass(this._container, 'leaflet-routing-container-hide');
            },
    
            hide: function() {
                L.DomUtil.addClass(this._container, 'leaflet-routing-container-hide');
            },
    
            _toggle: function() {
                var collapsed = L.DomUtil.hasClass(this._container, 'leaflet-routing-container-hide');
                this[collapsed ? 'show' : 'hide']();
            },
    
            _createAlternative: function(alt, i) {
                var altDiv = L.DomUtil.create('div', 'leaflet-routing-alt ' +
                    this.options.alternativeClassName +
                    (i > 0 ? ' leaflet-routing-alt-minimized ' + this.options.minimizedClassName : '')),
                    template = this.options.summaryTemplate,
                    data = L.extend({
                        name: alt.name,
                        distance: this._formatter.formatDistance(alt.summary.totalDistance, this.options.totalDistanceRoundingSensitivity),
                        time: this._formatter.formatTime(alt.summary.totalTime)
                    }, alt);
                altDiv.innerHTML = typeof(template) === 'function' ? template(data) : L.Util.template(template, data);
                L.DomEvent.addListener(altDiv, 'click', this._onAltClicked, this);
                this.on('routeselected', this._selectAlt, this);
    
                altDiv.appendChild(this._createItineraryContainer(alt));
                return altDiv;
            },
    
            _clearAlts: function() {
                var el = this._altContainer;
                while (el && el.firstChild) {
                    el.removeChild(el.firstChild);
                }
    
                this._altElements = [];
            },
    
            _createItineraryContainer: function(r) {
                var container = this._itineraryBuilder.createContainer(),
                    steps = this._itineraryBuilder.createStepsContainer(),
                    i,
                    instr,
                    step,
                    distance,
                    text,
                    icon;
    
                container.appendChild(steps);
    
                for (i = 0; i < r.instructions.length; i++) {
                    instr = r.instructions[i];
                    text = this._formatter.formatInstruction(instr, i);
                    distance = this._formatter.formatDistance(instr.distance);
                    icon = this._formatter.getIconName(instr, i);
                    step = this._itineraryBuilder.createStep(text, distance, icon, steps);
    
                    if(instr.index) {
                        this._addRowListeners(step, r.coordinates[instr.index]);
                    }
                }
    
                return container;
            },
    
            _addRowListeners: function(row, coordinate) {
                L.DomEvent.addListener(row, 'mouseover', function() {
                    this._marker = L.circleMarker(coordinate,
                        this.options.pointMarkerStyle).addTo(this._map);
                }, this);
                L.DomEvent.addListener(row, 'mouseout', function() {
                    if (this._marker) {
                        this._map.removeLayer(this._marker);
                        delete this._marker;
                    }
                }, this);
                L.DomEvent.addListener(row, 'click', function(e) {
                    this._map.panTo(coordinate);
                    L.DomEvent.stopPropagation(e);
                }, this);
            },
    
            _onAltClicked: function(e) {
                var altElem = e.target || window.event.srcElement;
                while (!L.DomUtil.hasClass(altElem, 'leaflet-routing-alt')) {
                    altElem = altElem.parentElement;
                }
    
                var j = this._altElements.indexOf(altElem);
                var alts = this._routes.slice();
                var route = alts.splice(j, 1)[0];
    
                this.fire('routeselected', {
                    route: route,
                    alternatives: alts
                });
            },
    
            _selectAlt: function(e) {
                var altElem,
                    j,
                    n,
                    classFn;
    
                altElem = this._altElements[e.route.routesIndex];
    
                if (L.DomUtil.hasClass(altElem, 'leaflet-routing-alt-minimized')) {
                    for (j = 0; j < this._altElements.length; j++) {
                        n = this._altElements[j];
                        classFn = j === e.route.routesIndex ? 'removeClass' : 'addClass';
                        L.DomUtil[classFn](n, 'leaflet-routing-alt-minimized');
                        if (this.options.minimizedClassName) {
                            L.DomUtil[classFn](n, this.options.minimizedClassName);
                        }
    
                        if (j !== e.route.routesIndex) n.scrollTop = 0;
                    }
                }
    
                L.DomEvent.stop(e);
            },
    
            _selectRoute: function(routes) {
                if (this._marker) {
                    this._map.removeLayer(this._marker);
                    delete this._marker;
                }
                this.fire('routeselected', routes);
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./formatter":51,"./itinerary-builder":54}],56:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        module.exports = L.LayerGroup.extend({
            includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),
    
            options: {
                styles: [
                    {color: 'black', opacity: 0.15, weight: 9},
                    {color: 'white', opacity: 0.8, weight: 6},
                    {color: 'red', opacity: 1, weight: 2}
                ],
                missingRouteStyles: [
                    {color: 'black', opacity: 0.15, weight: 7},
                    {color: 'white', opacity: 0.6, weight: 4},
                    {color: 'gray', opacity: 0.8, weight: 2, dashArray: '7,12'}
                ],
                addWaypoints: true,
                extendToWaypoints: true,
                missingRouteTolerance: 10
            },
    
            initialize: function(route, options) {
                L.setOptions(this, options);
                L.LayerGroup.prototype.initialize.call(this, options);
                this._route = route;
    
                if (this.options.extendToWaypoints) {
                    this._extendToWaypoints();
                }
    
                this._addSegment(
                    route.coordinates,
                    this.options.styles,
                    this.options.addWaypoints);
            },
    
            getBounds: function() {
                return L.latLngBounds(this._route.coordinates);
            },
    
            _findWaypointIndices: function() {
                var wps = this._route.inputWaypoints,
                    indices = [],
                    i;
                for (i = 0; i < wps.length; i++) {
                    indices.push(this._findClosestRoutePoint(wps[i].latLng));
                }
    
                return indices;
            },
    
            _findClosestRoutePoint: function(latlng) {
                var minDist = Number.MAX_VALUE,
                    minIndex,
                    i,
                    d;
    
                for (i = this._route.coordinates.length - 1; i >= 0 ; i--) {
                    // TODO: maybe do this in pixel space instead?
                    d = latlng.distanceTo(this._route.coordinates[i]);
                    if (d < minDist) {
                        minIndex = i;
                        minDist = d;
                    }
                }
    
                return minIndex;
            },
    
            _extendToWaypoints: function() {
                var wps = this._route.inputWaypoints,
                    wpIndices = this._getWaypointIndices(),
                    i,
                    wpLatLng,
                    routeCoord;
    
                for (i = 0; i < wps.length; i++) {
                    wpLatLng = wps[i].latLng;
                    routeCoord = L.latLng(this._route.coordinates[wpIndices[i]]);
                    if (wpLatLng.distanceTo(routeCoord) >
                        this.options.missingRouteTolerance) {
                        this._addSegment([wpLatLng, routeCoord],
                            this.options.missingRouteStyles);
                    }
                }
            },
    
            _addSegment: function(coords, styles, mouselistener) {
                var i,
                    pl;
    
                for (i = 0; i < styles.length; i++) {
                    pl = L.polyline(coords, styles[i]);
                    this.addLayer(pl);
                    if (mouselistener) {
                        pl.on('mousedown', this._onLineTouched, this);
                    }
                }
            },
    
            _findNearestWpBefore: function(i) {
                var wpIndices = this._getWaypointIndices(),
                    j = wpIndices.length - 1;
                while (j >= 0 && wpIndices[j] > i) {
                    j--;
                }
    
                return j;
            },
    
            _onLineTouched: function(e) {
                var afterIndex = this._findNearestWpBefore(this._findClosestRoutePoint(e.latlng));
                this.fire('linetouched', {
                    afterIndex: afterIndex,
                    latlng: e.latlng
                });
                L.DomEvent.stop(e);
            },
    
            _getWaypointIndices: function() {
                if (!this._wpIndices) {
                    this._wpIndices = this._route.waypointIndices || this._findWaypointIndices();
                }
    
                return this._wpIndices;
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}],57:[function(_dereq_,module,exports){
    /* 
       NOTICE
       Since version 3.2.5, the functionality in this file is by
       default NOT used for localizing OSRM instructions.
       Instead, we rely on the module osrm-text-instructions (https://github.com/Project-OSRM/osrm-text-instructions/).
       
       This file can still be used for other routing backends, or if you specify the
       stepToText option in the OSRMv1 class.
    */
    
    (function() {
        'use strict';
    
        var spanish = {
            directions: {
                N: 'norte',
                NE: 'noreste',
                E: 'este',
                SE: 'sureste',
                S: 'sur',
                SW: 'suroeste',
                W: 'oeste',
                NW: 'noroeste',
                SlightRight: 'leve giro a la derecha',
                Right: 'derecha',
                SharpRight: 'giro pronunciado a la derecha',
                SlightLeft: 'leve giro a la izquierda',
                Left: 'izquierda',
                SharpLeft: 'giro pronunciado a la izquierda',
                Uturn: 'media vuelta'
            },
            instructions: {
                // instruction, postfix if the road is named
                'Head':
                    ['Derecho {dir}', ' sobre {road}'],
                'Continue':
                    ['Continuar {dir}', ' en {road}'],
                'TurnAround':
                    ['Dar vuelta'],
                'WaypointReached':
                    ['LlegÃ³ a un punto del camino'],
                'Roundabout':
                    ['Tomar {exitStr} salida en la rotonda', ' en {road}'],
                'DestinationReached':
                    ['Llegada a destino'],
                'Fork': ['En el cruce gira a {modifier}', ' hacia {road}'],
                'Merge': ['IncorpÃ³rate {modifier}', ' hacia {road}'],
                'OnRamp': ['Gira {modifier} en la salida', ' hacia {road}'],
                'OffRamp': ['Toma la salida {modifier}', ' hacia {road}'],
                'EndOfRoad': ['Gira {modifier} al final de la carretera', ' hacia {road}'],
                'Onto': 'hacia {road}'
            },
            formatOrder: function(n) {
                return n + 'Âº';
            },
            ui: {
                startPlaceholder: 'Inicio',
                viaPlaceholder: 'Via {viaNumber}',
                endPlaceholder: 'Destino'
            },
            units: {
                meters: 'm',
                kilometers: 'km',
                yards: 'yd',
                miles: 'mi',
                hours: 'h',
                minutes: 'min',
                seconds: 's'
            }
        };
    
        L.Routing = L.Routing || {};
    
        var Localization = L.Class.extend({
            initialize: function(langs) {
                this._langs = L.Util.isArray(langs) ? langs.slice() : [langs, 'en'];
    
                for (var i = 0, l = this._langs.length; i < l; i++) {
                    var generalizedCode = /([A-Za-z]+)/.exec(this._langs[i])[1]
                    if (!Localization[this._langs[i]]) {
                        if (Localization[generalizedCode]) {
                            this._langs[i] = generalizedCode;
                        } else {
                            throw new Error('No localization for language "' + this._langs[i] + '".');
                        }
                    }
                }
            },
    
            localize: function(keys) {
                var dict,
                    key,
                    value;
    
                keys = L.Util.isArray(keys) ? keys : [keys];
    
                for (var i = 0, l = this._langs.length; i < l; i++) {
                    dict = Localization[this._langs[i]];
                    for (var j = 0, nKeys = keys.length; dict && j < nKeys; j++) {
                        key = keys[j];
                        value = dict[key];
                        dict = value;
                    }
    
                    if (value) {
                        return value;
                    }
                }
            }
        });
    
        module.exports = L.extend(Localization, {
            'en': {
                directions: {
                    N: 'north',
                    NE: 'northeast',
                    E: 'east',
                    SE: 'southeast',
                    S: 'south',
                    SW: 'southwest',
                    W: 'west',
                    NW: 'northwest',
                    SlightRight: 'slight right',
                    Right: 'right',
                    SharpRight: 'sharp right',
                    SlightLeft: 'slight left',
                    Left: 'left',
                    SharpLeft: 'sharp left',
                    Uturn: 'Turn around'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Head {dir}', ' on {road}'],
                    'Continue':
                        ['Continue {dir}'],
                    'TurnAround':
                        ['Turn around'],
                    'WaypointReached':
                        ['Waypoint reached'],
                    'Roundabout':
                        ['Take the {exitStr} exit in the roundabout', ' onto {road}'],
                    'DestinationReached':
                        ['Destination reached'],
                    'Fork': ['At the fork, turn {modifier}', ' onto {road}'],
                    'Merge': ['Merge {modifier}', ' onto {road}'],
                    'OnRamp': ['Turn {modifier} on the ramp', ' onto {road}'],
                    'OffRamp': ['Take the ramp on the {modifier}', ' onto {road}'],
                    'EndOfRoad': ['Turn {modifier} at the end of the road', ' onto {road}'],
                    'Onto': 'onto {road}'
                },
                formatOrder: function(n) {
                    var i = n % 10 - 1,
                    suffix = ['st', 'nd', 'rd'];
    
                    return suffix[i] ? n + suffix[i] : n + 'th';
                },
                ui: {
                    startPlaceholder: 'Start',
                    viaPlaceholder: 'Via {viaNumber}',
                    endPlaceholder: 'End'
                },
                units: {
                    meters: 'm',
                    kilometers: 'km',
                    yards: 'yd',
                    miles: 'mi',
                    hours: 'h',
                    minutes: 'min',
                    seconds: 's'
                }
            },
    
            'de': {
                directions: {
                    N: 'Norden',
                    NE: 'Nordosten',
                    E: 'Osten',
                    SE: 'SÃ¼dosten',
                    S: 'SÃ¼den',
                    SW: 'SÃ¼dwesten',
                    W: 'Westen',
                    NW: 'Nordwesten',
                    SlightRight: 'leicht rechts',
                    Right: 'rechts',
                    SharpRight: 'scharf rechts',
                    SlightLeft: 'leicht links',
                    Left: 'links',
                    SharpLeft: 'scharf links',
                    Uturn: 'Wenden'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Richtung {dir}', ' auf {road}'],
                    'Continue':
                        ['Geradeaus Richtung {dir}', ' auf {road}'],
                    'SlightRight':
                        ['Leicht rechts abbiegen', ' auf {road}'],
                    'Right':
                        ['Rechts abbiegen', ' auf {road}'],
                    'SharpRight':
                        ['Scharf rechts abbiegen', ' auf {road}'],
                    'TurnAround':
                        ['Wenden'],
                    'SharpLeft':
                        ['Scharf links abbiegen', ' auf {road}'],
                    'Left':
                        ['Links abbiegen', ' auf {road}'],
                    'SlightLeft':
                        ['Leicht links abbiegen', ' auf {road}'],
                    'WaypointReached':
                        ['Zwischenhalt erreicht'],
                    'Roundabout':
                        ['Nehmen Sie die {exitStr} Ausfahrt im Kreisverkehr', ' auf {road}'],
                    'DestinationReached':
                        ['Sie haben ihr Ziel erreicht'],
                    'Fork': ['An der Kreuzung {modifier}', ' auf {road}'],
                    'Merge': ['Fahren Sie {modifier} weiter', ' auf {road}'],
                    'OnRamp': ['Fahren Sie {modifier} auf die Auffahrt', ' auf {road}'],
                    'OffRamp': ['Nehmen Sie die Ausfahrt {modifier}', ' auf {road}'],
                    'EndOfRoad': ['Fahren Sie {modifier} am Ende der StraÃŸe', ' auf {road}'],
                    'Onto': 'auf {road}'
                },
                formatOrder: function(n) {
                    return n + '.';
                },
                ui: {
                    startPlaceholder: 'Start',
                    viaPlaceholder: 'Via {viaNumber}',
                    endPlaceholder: 'Ziel'
                }
            },
    
            'sv': {
                directions: {
                    N: 'norr',
                    NE: 'nordost',
                    E: 'Ã¶st',
                    SE: 'sydost',
                    S: 'syd',
                    SW: 'sydvÃ¤st',
                    W: 'vÃ¤st',
                    NW: 'nordvÃ¤st',
                    SlightRight: 'svagt hÃ¶ger',
                    Right: 'hÃ¶ger',
                    SharpRight: 'skarpt hÃ¶ger',
                    SlightLeft: 'svagt vÃ¤nster',
                    Left: 'vÃ¤nster',
                    SharpLeft: 'skarpt vÃ¤nster',
                    Uturn: 'VÃ¤nd'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Ã…k Ã¥t {dir}', ' till {road}'],
                    'Continue':
                        ['FortsÃ¤tt {dir}'],
                    'SlightRight':
                        ['Svagt hÃ¶ger', ' till {road}'],
                    'Right':
                        ['SvÃ¤ng hÃ¶ger', ' till {road}'],
                    'SharpRight':
                        ['Skarpt hÃ¶ger', ' till {road}'],
                    'TurnAround':
                        ['VÃ¤nd'],
                    'SharpLeft':
                        ['Skarpt vÃ¤nster', ' till {road}'],
                    'Left':
                        ['SvÃ¤ng vÃ¤nster', ' till {road}'],
                    'SlightLeft':
                        ['Svagt vÃ¤nster', ' till {road}'],
                    'WaypointReached':
                        ['Viapunkt nÃ¥dd'],
                    'Roundabout':
                        ['Tag {exitStr} avfarten i rondellen', ' till {road}'],
                    'DestinationReached':
                        ['Framme vid resans mÃ¥l'],
                    'Fork': ['Tag av {modifier}', ' till {road}'],
                    'Merge': ['Anslut {modifier} ', ' till {road}'],
                    'OnRamp': ['Tag pÃ¥farten {modifier}', ' till {road}'],
                    'OffRamp': ['Tag avfarten {modifier}', ' till {road}'],
                    'EndOfRoad': ['SvÃ¤ng {modifier} vid vÃ¤gens slut', ' till {road}'],
                    'Onto': 'till {road}'
                },
                formatOrder: function(n) {
                    return ['fÃ¶rsta', 'andra', 'tredje', 'fjÃ¤rde', 'femte',
                        'sjÃ¤tte', 'sjunde', 'Ã¥ttonde', 'nionde', 'tionde'
                        /* Can't possibly be more than ten exits, can there? */][n - 1];
                },
                ui: {
                    startPlaceholder: 'FrÃ¥n',
                    viaPlaceholder: 'Via {viaNumber}',
                    endPlaceholder: 'Till'
                }
            },
    
            'es': spanish,
            'sp': spanish,
            
            'nl': {
                directions: {
                    N: 'noordelijke',
                    NE: 'noordoostelijke',
                    E: 'oostelijke',
                    SE: 'zuidoostelijke',
                    S: 'zuidelijke',
                    SW: 'zuidewestelijke',
                    W: 'westelijke',
                    NW: 'noordwestelijke'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Vertrek in {dir} richting', ' de {road} op'],
                    'Continue':
                        ['Ga in {dir} richting', ' de {road} op'],
                    'SlightRight':
                        ['Volg de weg naar rechts', ' de {road} op'],
                    'Right':
                        ['Ga rechtsaf', ' de {road} op'],
                    'SharpRight':
                        ['Ga scherpe bocht naar rechts', ' de {road} op'],
                    'TurnAround':
                        ['Keer om'],
                    'SharpLeft':
                        ['Ga scherpe bocht naar links', ' de {road} op'],
                    'Left':
                        ['Ga linksaf', ' de {road} op'],
                    'SlightLeft':
                        ['Volg de weg naar links', ' de {road} op'],
                    'WaypointReached':
                        ['Aangekomen bij tussenpunt'],
                    'Roundabout':
                        ['Neem de {exitStr} afslag op de rotonde', ' de {road} op'],
                    'DestinationReached':
                        ['Aangekomen op eindpunt'],
                },
                formatOrder: function(n) {
                    if (n === 1 || n >= 20) {
                        return n + 'ste';
                    } else {
                        return n + 'de';
                    }
                },
                ui: {
                    startPlaceholder: 'Vertrekpunt',
                    viaPlaceholder: 'Via {viaNumber}',
                    endPlaceholder: 'Bestemming'
                }
            },
            'fr': {
                directions: {
                    N: 'nord',
                    NE: 'nord-est',
                    E: 'est',
                    SE: 'sud-est',
                    S: 'sud',
                    SW: 'sud-ouest',
                    W: 'ouest',
                    NW: 'nord-ouest'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Tout droit au {dir}', ' sur {road}'],
                    'Continue':
                        ['Continuer au {dir}', ' sur {road}'],
                    'SlightRight':
                        ['LÃ©gÃ¨rement Ã  droite', ' sur {road}'],
                    'Right':
                        ['A droite', ' sur {road}'],
                    'SharpRight':
                        ['ComplÃ¨tement Ã  droite', ' sur {road}'],
                    'TurnAround':
                        ['Faire demi-tour'],
                    'SharpLeft':
                        ['ComplÃ¨tement Ã  gauche', ' sur {road}'],
                    'Left':
                        ['A gauche', ' sur {road}'],
                    'SlightLeft':
                        ['LÃ©gÃ¨rement Ã  gauche', ' sur {road}'],
                    'WaypointReached':
                        ['Point d\'Ã©tape atteint'],
                    'Roundabout':
                        ['Au rond-point, prenez la {exitStr} sortie', ' sur {road}'],
                    'DestinationReached':
                        ['Destination atteinte'],
                },
                formatOrder: function(n) {
                    return n + 'Âº';
                },
                ui: {
                    startPlaceholder: 'DÃ©part',
                    viaPlaceholder: 'IntermÃ©diaire {viaNumber}',
                    endPlaceholder: 'ArrivÃ©e'
                }
            },
            'it': {
                directions: {
                    N: 'nord',
                    NE: 'nord-est',
                    E: 'est',
                    SE: 'sud-est',
                    S: 'sud',
                    SW: 'sud-ovest',
                    W: 'ovest',
                    NW: 'nord-ovest'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Dritto verso {dir}', ' su {road}'],
                    'Continue':
                        ['Continuare verso {dir}', ' su {road}'],
                    'SlightRight':
                        ['Mantenere la destra', ' su {road}'],
                    'Right':
                        ['A destra', ' su {road}'],
                    'SharpRight':
                        ['Strettamente a destra', ' su {road}'],
                    'TurnAround':
                        ['Fare inversione di marcia'],
                    'SharpLeft':
                        ['Strettamente a sinistra', ' su {road}'],
                    'Left':
                        ['A sinistra', ' sur {road}'],
                    'SlightLeft':
                        ['Mantenere la sinistra', ' su {road}'],
                    'WaypointReached':
                        ['Punto di passaggio raggiunto'],
                    'Roundabout':
                        ['Alla rotonda, prendere la {exitStr} uscita'],
                    'DestinationReached':
                        ['Destinazione raggiunta'],
                },
                formatOrder: function(n) {
                    return n + 'Âº';
                },
                ui: {
                    startPlaceholder: 'Partenza',
                    viaPlaceholder: 'Intermedia {viaNumber}',
                    endPlaceholder: 'Destinazione'
                }
            },
            'pt': {
                directions: {
                    N: 'norte',
                    NE: 'nordeste',
                    E: 'leste',
                    SE: 'sudeste',
                    S: 'sul',
                    SW: 'sudoeste',
                    W: 'oeste',
                    NW: 'noroeste',
                    SlightRight: 'curva ligeira a direita',
                    Right: 'direita',
                    SharpRight: 'curva fechada a direita',
                    SlightLeft: 'ligeira a esquerda',
                    Left: 'esquerda',
                    SharpLeft: 'curva fechada a esquerda',
                    Uturn: 'Meia volta'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Siga {dir}', ' na {road}'],
                    'Continue':
                        ['Continue {dir}', ' na {road}'],
                    'SlightRight':
                        ['Curva ligeira a direita', ' na {road}'],
                    'Right':
                        ['Curva a direita', ' na {road}'],
                    'SharpRight':
                        ['Curva fechada a direita', ' na {road}'],
                    'TurnAround':
                        ['Retorne'],
                    'SharpLeft':
                        ['Curva fechada a esquerda', ' na {road}'],
                    'Left':
                        ['Curva a esquerda', ' na {road}'],
                    'SlightLeft':
                        ['Curva ligueira a esquerda', ' na {road}'],
                    'WaypointReached':
                        ['Ponto de interesse atingido'],
                    'Roundabout':
                        ['Pegue a {exitStr} saÃ­da na rotatÃ³ria', ' na {road}'],
                    'DestinationReached':
                        ['Destino atingido'],
                    'Fork': ['Na encruzilhada, vire a {modifier}', ' na {road}'],
                    'Merge': ['Entre Ã  {modifier}', ' na {road}'],
                    'OnRamp': ['Vire {modifier} na rampa', ' na {road}'],
                    'OffRamp': ['Entre na rampa na {modifier}', ' na {road}'],
                    'EndOfRoad': ['Vire {modifier} no fim da rua', ' na {road}'],
                    'Onto': 'na {road}'
                },
                formatOrder: function(n) {
                    return n + 'Âº';
                },
                ui: {
                    startPlaceholder: 'Origem',
                    viaPlaceholder: 'IntermÃ©dio {viaNumber}',
                    endPlaceholder: 'Destino'
                }
            },
            'sk': {
                directions: {
                    N: 'sever',
                    NE: 'serverovÃ½chod',
                    E: 'vÃ½chod',
                    SE: 'juhovÃ½chod',
                    S: 'juh',
                    SW: 'juhozÃ¡pad',
                    W: 'zÃ¡pad',
                    NW: 'serverozÃ¡pad'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Mierte na {dir}', ' na {road}'],
                    'Continue':
                        ['PokraÄujte na {dir}', ' na {road}'],
                    'SlightRight':
                        ['Mierne doprava', ' na {road}'],
                    'Right':
                        ['Doprava', ' na {road}'],
                    'SharpRight':
                        ['Prudko doprava', ' na {road}'],
                    'TurnAround':
                        ['OtoÄte sa'],
                    'SharpLeft':
                        ['Prudko doÄ¾ava', ' na {road}'],
                    'Left':
                        ['DoÄ¾ava', ' na {road}'],
                    'SlightLeft':
                        ['Mierne doÄ¾ava', ' na {road}'],
                    'WaypointReached':
                        ['Ste v prejazdovom bode.'],
                    'Roundabout':
                        ['OdboÄte na {exitStr} vÃ½jazde', ' na {road}'],
                    'DestinationReached':
                        ['PriÅ¡li ste do cieÄ¾a.'],
                },
                formatOrder: function(n) {
                    var i = n % 10 - 1,
                    suffix = ['.', '.', '.'];
    
                    return suffix[i] ? n + suffix[i] : n + '.';
                },
                ui: {
                    startPlaceholder: 'ZaÄiatok',
                    viaPlaceholder: 'Cez {viaNumber}',
                    endPlaceholder: 'Koniec'
                }
            },
            'el': {
                directions: {
                    N: 'Î²ÏŒÏÎµÎ¹Î±',
                    NE: 'Î²Î¿ÏÎµÎ¹Î¿Î±Î½Î±Ï„Î¿Î»Î¹ÎºÎ¬',
                    E: 'Î±Î½Î±Ï„Î¿Î»Î¹ÎºÎ¬',
                    SE: 'Î½Î¿Ï„Î¹Î¿Î±Î½Î±Ï„Î¿Î»Î¹ÎºÎ¬',
                    S: 'Î½ÏŒÏ„Î¹Î±',
                    SW: 'Î½Î¿Ï„Î¹Î¿Î´Ï…Ï„Î¹ÎºÎ¬',
                    W: 'Î´Ï…Ï„Î¹ÎºÎ¬',
                    NW: 'Î²Î¿ÏÎµÎ¹Î¿Î´Ï…Ï„Î¹ÎºÎ¬'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['ÎšÎ±Ï„ÎµÏ…Î¸Ï…Î½Î¸ÎµÎ¯Ï„Îµ {dir}', ' ÏƒÏ„Î·Î½ {road}'],
                    'Continue':
                        ['Î£Ï…Î½ÎµÏ‡Î¯ÏƒÏ„Îµ {dir}', ' ÏƒÏ„Î·Î½ {road}'],
                    'SlightRight':
                        ['Î•Î»Î±Ï†ÏÏŽÏ‚ Î´ÎµÎ¾Î¹Î¬', ' ÏƒÏ„Î·Î½ {road}'],
                    'Right':
                        ['Î”ÎµÎ¾Î¹Î¬', ' ÏƒÏ„Î·Î½ {road}'],
                    'SharpRight':
                        ['Î‘Ï€ÏŒÏ„Î¿Î¼Î· Î´ÎµÎ¾Î¹Î¬ ÏƒÏ„ÏÎ¿Ï†Î®', ' ÏƒÏ„Î·Î½ {road}'],
                    'TurnAround':
                        ['ÎšÎ¬Î½Ï„Îµ Î±Î½Î±ÏƒÏ„ÏÎ¿Ï†Î®'],
                    'SharpLeft':
                        ['Î‘Ï€ÏŒÏ„Î¿Î¼Î· Î±ÏÎ¹ÏƒÏ„ÎµÏÎ® ÏƒÏ„ÏÎ¿Ï†Î®', ' ÏƒÏ„Î·Î½ {road}'],
                    'Left':
                        ['Î‘ÏÎ¹ÏƒÏ„ÎµÏÎ¬', ' ÏƒÏ„Î·Î½ {road}'],
                    'SlightLeft':
                        ['Î•Î»Î±Ï†ÏÏŽÏ‚ Î±ÏÎ¹ÏƒÏ„ÎµÏÎ¬', ' ÏƒÏ„Î·Î½ {road}'],
                    'WaypointReached':
                        ['Î¦Ï„Î¬ÏƒÎ±Ï„Îµ ÏƒÏ„Î¿ ÏƒÎ·Î¼ÎµÎ¯Î¿ Î±Î½Î±Ï†Î¿ÏÎ¬Ï‚'],
                    'Roundabout':
                        ['Î‘ÎºÎ¿Î»Î¿Ï…Î¸Î®ÏƒÏ„Îµ Ï„Î·Î½ {exitStr} Î­Î¾Î¿Î´Î¿ ÏƒÏ„Î¿ ÎºÏ…ÎºÎ»Î¹ÎºÏŒ ÎºÏŒÎ¼Î²Î¿', ' ÏƒÏ„Î·Î½ {road}'],
                    'DestinationReached':
                        ['Î¦Ï„Î¬ÏƒÎ±Ï„Îµ ÏƒÏ„Î¿Î½ Ï€ÏÎ¿Î¿ÏÎ¹ÏƒÎ¼ÏŒ ÏƒÎ±Ï‚'],
                },
                formatOrder: function(n) {
                    return n + 'Âº';
                },
                ui: {
                    startPlaceholder: 'Î‘Ï†ÎµÏ„Î·ÏÎ¯Î±',
                    viaPlaceholder: 'Î¼Î­ÏƒÏ‰ {viaNumber}',
                    endPlaceholder: 'Î ÏÎ¿Î¿ÏÎ¹ÏƒÎ¼ÏŒÏ‚'
                }
            },
            'ca': {
                directions: {
                    N: 'nord',
                    NE: 'nord-est',
                    E: 'est',
                    SE: 'sud-est',
                    S: 'sud',
                    SW: 'sud-oest',
                    W: 'oest',
                    NW: 'nord-oest',
                    SlightRight: 'lleu gir a la dreta',
                    Right: 'dreta',
                    SharpRight: 'gir pronunciat a la dreta',
                    SlightLeft: 'gir pronunciat a l\'esquerra',
                    Left: 'esquerra',
                    SharpLeft: 'lleu gir a l\'esquerra',
                    Uturn: 'mitja volta'
                },
                instructions: {
                    'Head':
                        ['Recte {dir}', ' sobre {road}'],
                    'Continue':
                        ['Continuar {dir}'],
                    'TurnAround':
                        ['Donar la volta'],
                    'WaypointReached':
                        ['Ha arribat a un punt del camÃ­'],
                    'Roundabout':
                        ['Agafar {exitStr} sortida a la rotonda', ' a {road}'],
                    'DestinationReached':
                        ['Arribada al destÃ­'],
                    'Fork': ['A la cruÃ¯lla gira a la {modifier}', ' cap a {road}'],
                    'Merge': ['Incorpora\'t {modifier}', ' a {road}'],
                    'OnRamp': ['Gira {modifier} a la sortida', ' cap a {road}'],
                    'OffRamp': ['Pren la sortida {modifier}', ' cap a {road}'],
                    'EndOfRoad': ['Gira {modifier} al final de la carretera', ' cap a {road}'],
                    'Onto': 'cap a {road}'
                },
                formatOrder: function(n) {
                    return n + 'Âº';
                },
                ui: {
                    startPlaceholder: 'Origen',
                    viaPlaceholder: 'Via {viaNumber}',
                    endPlaceholder: 'DestÃ­'
                },
                units: {
                    meters: 'm',
                    kilometers: 'km',
                    yards: 'yd',
                    miles: 'mi',
                    hours: 'h',
                    minutes: 'min',
                    seconds: 's'
                }
            },
            'ru': {
                directions: {
                    N: 'ÑÐµÐ²ÐµÑ€',
                    NE: 'ÑÐµÐ²ÐµÑ€Ð¾Ð²Ð¾ÑÑ‚Ð¾Ðº',
                    E: 'Ð²Ð¾ÑÑ‚Ð¾Ðº',
                    SE: 'ÑŽÐ³Ð¾Ð²Ð¾ÑÑ‚Ð¾Ðº',
                    S: 'ÑŽÐ³',
                    SW: 'ÑŽÐ³Ð¾Ð·Ð°Ð¿Ð°Ð´',
                    W: 'Ð·Ð°Ð¿Ð°Ð´',
                    NW: 'ÑÐµÐ²ÐµÑ€Ð¾Ð·Ð°Ð¿Ð°Ð´',
                    SlightRight: 'Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾',
                    Right: 'Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾',
                    SharpRight: 'Ñ€ÐµÐ·ÐºÐ¾ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾',
                    SlightLeft: 'Ð¿Ð»Ð°Ð²Ð½Ð¾ Ð½Ð°Ð»ÐµÐ²Ð¾',
                    Left: 'Ð½Ð°Ð»ÐµÐ²Ð¾',
                    SharpLeft: 'Ñ€ÐµÐ·ÐºÐ¾ Ð½Ð°Ð»ÐµÐ²Ð¾',
                    Uturn: 'Ñ€Ð°Ð·Ð²ÐµÑ€Ð½ÑƒÑ‚ÑŒÑÑ'
                },
                instructions: {
                    'Head':
                        ['ÐÐ°Ñ‡Ð°Ñ‚ÑŒ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð½Ð° {dir}', ' Ð¿Ð¾ {road}'],
                    'Continue':
                        ['ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð°Ñ‚ÑŒ Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ Ð½Ð° {dir}', ' Ð¿Ð¾ {road}'],
                    'SlightRight':
                        ['ÐŸÐ»Ð°Ð²Ð½Ñ‹Ð¹ Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾', ' Ð½Ð° {road}'],
                    'Right':
                        ['ÐÐ°Ð¿Ñ€Ð°Ð²Ð¾', ' Ð½Ð° {road}'],
                    'SharpRight':
                        ['Ð ÐµÐ·ÐºÐ¸Ð¹ Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð°Ð¿Ñ€Ð°Ð²Ð¾', ' Ð½Ð° {road}'],
                    'TurnAround':
                        ['Ð Ð°Ð·Ð²ÐµÑ€Ð½ÑƒÑ‚ÑŒÑÑ'],
                    'SharpLeft':
                        ['Ð ÐµÐ·ÐºÐ¸Ð¹ Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð°Ð»ÐµÐ²Ð¾', ' Ð½Ð° {road}'],
                    'Left':
                        ['ÐŸÐ¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð°Ð»ÐµÐ²Ð¾', ' Ð½Ð° {road}'],
                    'SlightLeft':
                        ['ÐŸÐ»Ð°Ð²Ð½Ñ‹Ð¹ Ð¿Ð¾Ð²Ð¾Ñ€Ð¾Ñ‚ Ð½Ð°Ð»ÐµÐ²Ð¾', ' Ð½Ð° {road}'],
                    'WaypointReached':
                        ['Ð¢Ð¾Ñ‡ÐºÐ° Ð´Ð¾ÑÑ‚Ð¸Ð³Ð½ÑƒÑ‚Ð°'],
                    'Roundabout':
                        ['{exitStr} ÑÑŠÐµÐ·Ð´ Ñ ÐºÐ¾Ð»ÑŒÑ†Ð°', ' Ð½Ð° {road}'],
                    'DestinationReached':
                        ['ÐžÐºÐ¾Ð½Ñ‡Ð°Ð½Ð¸Ðµ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚Ð°'],
                    'Fork': ['ÐÐ° Ñ€Ð°Ð·Ð²Ð¸Ð»ÐºÐµ Ð¿Ð¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier}', ' Ð½Ð° {road}'],
                    'Merge': ['ÐŸÐµÑ€ÐµÑÑ‚Ñ€Ð¾Ð¹Ñ‚ÐµÑÑŒ {modifier}', ' Ð½Ð° {road}'],
                    'OnRamp': ['ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier} Ð½Ð° ÑÑŠÐµÐ·Ð´', ' Ð½Ð° {road}'],
                    'OffRamp': ['Ð¡ÑŠÐµÐ·Ð¶Ð°Ð¹Ñ‚Ðµ Ð½Ð° {modifier}', ' Ð½Ð° {road}'],
                    'EndOfRoad': ['ÐŸÐ¾Ð²ÐµÑ€Ð½Ð¸Ñ‚Ðµ {modifier} Ð² ÐºÐ¾Ð½Ñ†Ðµ Ð´Ð¾Ñ€Ð¾Ð³Ð¸', ' Ð½Ð° {road}'],
                    'Onto': 'Ð½Ð° {road}'
                },
                formatOrder: function(n) {
                    return n + '-Ð¹';
                },
                ui: {
                    startPlaceholder: 'ÐÐ°Ñ‡Ð°Ð»Ð¾',
                    viaPlaceholder: 'Ð§ÐµÑ€ÐµÐ· {viaNumber}',
                    endPlaceholder: 'ÐšÐ¾Ð½ÐµÑ†'
                },
                units: {
                    meters: 'Ð¼',
                    kilometers: 'ÐºÐ¼',
                    yards: 'ÑÑ€Ð´',
                    miles: 'Ð¼Ð¸',
                    hours: 'Ñ‡',
                    minutes: 'Ð¼',
                    seconds: 'Ñ'
                }
            },
                    
                    'pl': {
                directions: {
                    N: 'pÃ³Å‚noc',
                    NE: 'pÃ³Å‚nocny wschÃ³d',
                    E: 'wschÃ³d',
                    SE: 'poÅ‚udniowy wschÃ³d',
                    S: 'poÅ‚udnie',
                    SW: 'poÅ‚udniowy zachÃ³d',
                    W: 'zachÃ³d',
                    NW: 'pÃ³Å‚nocny zachÃ³d',
                    SlightRight: 'lekko w prawo',
                    Right: 'w prawo',
                    SharpRight: 'ostro w prawo',
                    SlightLeft: 'lekko w lewo',
                    Left: 'w lewo',
                    SharpLeft: 'ostro w lewo',
                    Uturn: 'zawrÃ³Ä‡'
                },
                instructions: {
                    // instruction, postfix if the road is named
                    'Head':
                        ['Kieruj siÄ™ na {dir}', ' na {road}'],
                    'Continue':
                        ['JedÅº dalej przez {dir}'],
                    'TurnAround':
                        ['ZawrÃ³Ä‡'],
                    'WaypointReached':
                        ['Punkt poÅ›redni'],
                    'Roundabout':
                        ['WyjedÅº {exitStr} zjazdem na rondzie', ' na {road}'],
                    'DestinationReached':
                        ['Dojechano do miejsca docelowego'],
                    'Fork': ['Na rozwidleniu {modifier}', ' na {road}'],
                    'Merge': ['ZjedÅº {modifier}', ' na {road}'],
                    'OnRamp': ['Wjazd {modifier}', ' na {road}'],
                    'OffRamp': ['Zjazd {modifier}', ' na {road}'],
                    'EndOfRoad': ['SkrÄ™Ä‡ {modifier} na koÅ„cu drogi', ' na {road}'],
                    'Onto': 'na {road}'
                },
                formatOrder: function(n) {
                    return n + '.';
                },
                ui: {
                    startPlaceholder: 'PoczÄ…tek',
                    viaPlaceholder: 'Przez {viaNumber}',
                    endPlaceholder: 'Koniec'
                },
                units: {
                    meters: 'm',
                    kilometers: 'km',
                    yards: 'yd',
                    miles: 'mi',
                    hours: 'godz',
                    minutes: 'min',
                    seconds: 's'
                }
            }
        });
    })();
    
    },{}],58:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        var OSRMv1 = _dereq_('./osrm-v1');
    
        /**
         * Works against OSRM's new API in version 5.0; this has
         * the API version v1.
         */
        module.exports = OSRMv1.extend({
            options: {
                serviceUrl: 'https://api.mapbox.com/directions/v5',
                profile: 'mapbox/driving',
                useHints: false
            },
    
            initialize: function(accessToken, options) {
                L.Routing.OSRMv1.prototype.initialize.call(this, options);
                this.options.requestParameters = this.options.requestParameters || {};
                /* jshint camelcase: false */
                this.options.requestParameters.access_token = accessToken;
                /* jshint camelcase: true */
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./osrm-v1":59}],59:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null),
            corslite = _dereq_('@mapbox/corslite'),
            polyline = _dereq_('@mapbox/polyline'),
            osrmTextInstructions = _dereq_('osrm-text-instructions')('v5');
    
        // Ignore camelcase naming for this file, since OSRM's API uses
        // underscores.
        /* jshint camelcase: false */
    
        var Waypoint = _dereq_('./waypoint');
    
        /**
         * Works against OSRM's new API in version 5.0; this has
         * the API version v1.
         */
        module.exports = L.Class.extend({
            options: {
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'driving',
                timeout: 30 * 1000,
                routingOptions: {
                    alternatives: true,
                    steps: true
                },
                polylinePrecision: 5,
                useHints: true,
                suppressDemoServerWarning: false,
                language: 'en'
            },
    
            initialize: function(options) {
                L.Util.setOptions(this, options);
                this._hints = {
                    locations: {}
                };
    
                if (!this.options.suppressDemoServerWarning &&
                    this.options.serviceUrl.indexOf('//router.project-osrm.org') >= 0) {
                    console.warn('You are using OSRM\'s demo server. ' +
                        'Please note that it is **NOT SUITABLE FOR PRODUCTION USE**.\n' +
                        'Refer to the demo server\'s usage policy: ' +
                        'https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy\n\n' +
                        'To change, set the serviceUrl option.\n\n' +
                        'Please do not report issues with this server to neither ' +
                        'Leaflet Routing Machine or OSRM - it\'s for\n' +
                        'demo only, and will sometimes not be available, or work in ' +
                        'unexpected ways.\n\n' +
                        'Please set up your own OSRM server, or use a paid service ' +
                        'provider for production.');
                }
            },
    
            route: function(waypoints, callback, context, options) {
                var timedOut = false,
                    wps = [],
                    url,
                    timer,
                    wp,
                    i,
                    xhr;
    
                options = L.extend({}, this.options.routingOptions, options);
                url = this.buildRouteUrl(waypoints, options);
                if (this.options.requestParameters) {
                    url += L.Util.getParamString(this.options.requestParameters, url);
                }
    
                timer = setTimeout(function() {
                    timedOut = true;
                    callback.call(context || callback, {
                        status: -1,
                        message: 'OSRM request timed out.'
                    });
                }, this.options.timeout);
    
                // Create a copy of the waypoints, since they
                // might otherwise be asynchronously modified while
                // the request is being processed.
                for (i = 0; i < waypoints.length; i++) {
                    wp = waypoints[i];
                    wps.push(new Waypoint(wp.latLng, wp.name, wp.options));
                }
    
                return xhr = corslite(url, L.bind(function(err, resp) {
                    var data,
                        error =  {};
    
                    clearTimeout(timer);
                    if (!timedOut) {
                        if (!err) {
                            try {
                                data = JSON.parse(resp.responseText);
                                try {
                                    return this._routeDone(data, wps, options, callback, context);
                                } catch (ex) {
                                    error.status = -3;
                                    error.message = ex.toString();
                                }
                            } catch (ex) {
                                error.status = -2;
                                error.message = 'Error parsing OSRM response: ' + ex.toString();
                            }
                        } else {
                            error.message = 'HTTP request failed: ' + err.type +
                                (err.target && err.target.status ? ' HTTP ' + err.target.status + ': ' + err.target.statusText : '');
                            error.url = url;
                            error.status = -1;
                            error.target = err;
                        }
    
                        callback.call(context || callback, error);
                    } else {
                        xhr.abort();
                    }
                }, this));
            },
    
            requiresMoreDetail: function(route, zoom, bounds) {
                if (!route.properties.isSimplified) {
                    return false;
                }
    
                var waypoints = route.inputWaypoints,
                    i;
                for (i = 0; i < waypoints.length; ++i) {
                    if (!bounds.contains(waypoints[i].latLng)) {
                        return true;
                    }
                }
    
                return false;
            },
    
            _routeDone: function(response, inputWaypoints, options, callback, context) {
                var alts = [],
                    actualWaypoints,
                    i,
                    route;
    
                context = context || callback;
                if (response.code !== 'Ok') {
                    callback.call(context, {
                        status: response.code
                    });
                    return;
                }
    
                actualWaypoints = this._toWaypoints(inputWaypoints, response.waypoints);
    
                for (i = 0; i < response.routes.length; i++) {
                    route = this._convertRoute(response.routes[i]);
                    route.inputWaypoints = inputWaypoints;
                    route.waypoints = actualWaypoints;
                    route.properties = {isSimplified: !options || !options.geometryOnly || options.simplifyGeometry};
                    alts.push(route);
                }
    
                this._saveHintData(response.waypoints, inputWaypoints);
    
                callback.call(context, null, alts);
            },
    
            _convertRoute: function(responseRoute) {
                var result = {
                        name: '',
                        coordinates: [],
                        instructions: [],
                        summary: {
                            totalDistance: responseRoute.distance,
                            totalTime: responseRoute.duration
                        }
                    },
                    legNames = [],
                    waypointIndices = [],
                    index = 0,
                    legCount = responseRoute.legs.length,
                    hasSteps = responseRoute.legs[0].steps.length > 0,
                    i,
                    j,
                    leg,
                    step,
                    geometry,
                    type,
                    modifier,
                    text,
                    stepToText;
    
                if (this.options.stepToText) {
                    stepToText = this.options.stepToText;
                } else {
                    stepToText = L.bind(osrmTextInstructions.compile, osrmTextInstructions, this.options.language);
                }
    
                for (i = 0; i < legCount; i++) {
                    leg = responseRoute.legs[i];
                    legNames.push(leg.summary && leg.summary.charAt(0).toUpperCase() + leg.summary.substring(1));
                    for (j = 0; j < leg.steps.length; j++) {
                        step = leg.steps[j];
                        geometry = this._decodePolyline(step.geometry);
                        result.coordinates.push.apply(result.coordinates, geometry);
                        type = this._maneuverToInstructionType(step.maneuver, i === legCount - 1);
                        modifier = this._maneuverToModifier(step.maneuver);
                        text = stepToText(step, {legCount: legCount, legIndex: i});
    
                        if (type) {
                            if ((i == 0 && step.maneuver.type == 'depart') || step.maneuver.type == 'arrive') {
                                waypointIndices.push(index);
                            }
    
                            result.instructions.push({
                                type: type,
                                distance: step.distance,
                                time: step.duration,
                                road: step.name,
                                direction: this._bearingToDirection(step.maneuver.bearing_after),
                                exit: step.maneuver.exit,
                                index: index,
                                mode: step.mode,
                                modifier: modifier,
                                text: text
                            });
                        }
    
                        index += geometry.length;
                    }
                }
    
                result.name = legNames.join(', ');
                if (!hasSteps) {
                    result.coordinates = this._decodePolyline(responseRoute.geometry);
                } else {
                    result.waypointIndices = waypointIndices;
                }
    
                return result;
            },
    
            _bearingToDirection: function(bearing) {
                var oct = Math.round(bearing / 45) % 8;
                return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][oct];
            },
    
            _maneuverToInstructionType: function(maneuver, lastLeg) {
                switch (maneuver.type) {
                case 'new name':
                    return 'Continue';
                case 'depart':
                    return 'Head';
                case 'arrive':
                    return lastLeg ? 'DestinationReached' : 'WaypointReached';
                case 'roundabout':
                case 'rotary':
                    return 'Roundabout';
                case 'merge':
                case 'fork':
                case 'on ramp':
                case 'off ramp':
                case 'end of road':
                    return this._camelCase(maneuver.type);
                // These are all reduced to the same instruction in the current model
                //case 'turn':
                //case 'ramp': // deprecated in v5.1
                default:
                    return this._camelCase(maneuver.modifier);
                }
            },
    
            _maneuverToModifier: function(maneuver) {
                var modifier = maneuver.modifier;
    
                switch (maneuver.type) {
                case 'merge':
                case 'fork':
                case 'on ramp':
                case 'off ramp':
                case 'end of road':
                    modifier = this._leftOrRight(modifier);
                }
    
                return modifier && this._camelCase(modifier);
            },
    
            _camelCase: function(s) {
                var words = s.split(' '),
                    result = '';
                for (var i = 0, l = words.length; i < l; i++) {
                    result += words[i].charAt(0).toUpperCase() + words[i].substring(1);
                }
    
                return result;
            },
    
            _leftOrRight: function(d) {
                return d.indexOf('left') >= 0 ? 'Left' : 'Right';
            },
    
            _decodePolyline: function(routeGeometry) {
                var cs = polyline.decode(routeGeometry, this.options.polylinePrecision),
                    result = new Array(cs.length),
                    i;
                for (i = cs.length - 1; i >= 0; i--) {
                    result[i] = L.latLng(cs[i]);
                }
    
                return result;
            },
    
            _toWaypoints: function(inputWaypoints, vias) {
                var wps = [],
                    i,
                    viaLoc;
                for (i = 0; i < vias.length; i++) {
                    viaLoc = vias[i].location;
                    wps.push(new Waypoint(L.latLng(viaLoc[1], viaLoc[0]),
                                                inputWaypoints[i].name,
                                                inputWaypoints[i].options));
                }
    
                return wps;
            },
    
            buildRouteUrl: function(waypoints, options) {
                var locs = [],
                    hints = [],
                    wp,
                    latLng,
                    computeInstructions,
                    computeAlternative = true;
    
                for (var i = 0; i < waypoints.length; i++) {
                    wp = waypoints[i];
                    latLng = wp.latLng;
                    locs.push(latLng.lng + ',' + latLng.lat);
                    hints.push(this._hints.locations[this._locationKey(latLng)] || '');
                }
    
                computeInstructions =
                    true;
    
                return this.options.serviceUrl + '/' + this.options.profile + '/' +
                    locs.join(';') + '?' +
                    (options.geometryOnly ? (options.simplifyGeometry ? '' : 'overview=full') : 'overview=false') +
                    '&alternatives=' + computeAlternative.toString() +
                    '&steps=' + computeInstructions.toString() +
                    (this.options.useHints ? '&hints=' + hints.join(';') : '') +
                    (options.allowUTurns ? '&continue_straight=' + !options.allowUTurns : '');
            },
    
            _locationKey: function(location) {
                return location.lat + ',' + location.lng;
            },
    
            _saveHintData: function(actualWaypoints, waypoints) {
                var loc;
                this._hints = {
                    locations: {}
                };
                for (var i = actualWaypoints.length - 1; i >= 0; i--) {
                    loc = waypoints[i].latLng;
                    this._hints.locations[this._locationKey(loc)] = actualWaypoints[i].hint;
                }
            },
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./waypoint":61,"@mapbox/corslite":1,"@mapbox/polyline":2,"osrm-text-instructions":3}],60:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
        var GeocoderElement = _dereq_('./geocoder-element');
        var Waypoint = _dereq_('./waypoint');
    
        module.exports = (L.Layer || L.Class).extend({
            includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),
    
            options: {
                dragStyles: [
                    {color: 'black', opacity: 0.15, weight: 9},
                    {color: 'white', opacity: 0.8, weight: 6},
                    {color: 'red', opacity: 1, weight: 2, dashArray: '7,12'}
                ],
                draggableWaypoints: true,
                routeWhileDragging: false,
                addWaypoints: true,
                reverseWaypoints: false,
                addButtonClassName: '',
                language: 'en',
                createGeocoderElement: function(wp, i, nWps, plan) {
                    return new GeocoderElement(wp, i, nWps, plan);
                },
                createMarker: function(i, wp) {
                    var options = {
                            draggable: this.draggableWaypoints
                        },
                        marker = L.marker(wp.latLng, options);
    
                    return marker;
                },
                geocodersClassName: ''
            },
    
            initialize: function(waypoints, options) {
                L.Util.setOptions(this, options);
                this._waypoints = [];
                this.setWaypoints(waypoints);
            },
    
            isReady: function() {
                var i;
                for (i = 0; i < this._waypoints.length; i++) {
                    if (!this._waypoints[i].latLng) {
                        return false;
                    }
                }
    
                return true;
            },
    
            getWaypoints: function() {
                var i,
                    wps = [];
    
                for (i = 0; i < this._waypoints.length; i++) {
                    wps.push(this._waypoints[i]);
                }
    
                return wps;
            },
    
            setWaypoints: function(waypoints) {
                var args = [0, this._waypoints.length].concat(waypoints);
                this.spliceWaypoints.apply(this, args);
                return this;
            },
    
            spliceWaypoints: function() {
                var args = [arguments[0], arguments[1]],
                    i;
    
                for (i = 2; i < arguments.length; i++) {
                    args.push(arguments[i] && arguments[i].hasOwnProperty('latLng') ? arguments[i] : new Waypoint(arguments[i]));
                }
    
                [].splice.apply(this._waypoints, args);
    
                // Make sure there's always at least two waypoints
                while (this._waypoints.length < 2) {
                    this.spliceWaypoints(this._waypoints.length, 0, null);
                }
    
                this._updateMarkers();
                this._fireChanged.apply(this, args);
            },
    
            onAdd: function(map) {
                this._map = map;
                this._updateMarkers();
            },
    
            onRemove: function() {
                var i;
                this._removeMarkers();
    
                if (this._newWp) {
                    for (i = 0; i < this._newWp.lines.length; i++) {
                        this._map.removeLayer(this._newWp.lines[i]);
                    }
                }
    
                delete this._map;
            },
    
            createGeocoders: function() {
                var container = L.DomUtil.create('div', 'leaflet-routing-geocoders ' + this.options.geocodersClassName),
                    waypoints = this._waypoints,
                    addWpBtn,
                    reverseBtn;
    
                this._geocoderContainer = container;
                this._geocoderElems = [];
    
    
                if (this.options.addWaypoints) {
                    addWpBtn = L.DomUtil.create('button', 'leaflet-routing-add-waypoint ' + this.options.addButtonClassName, container);
                    addWpBtn.setAttribute('type', 'button');
                    L.DomEvent.addListener(addWpBtn, 'click', function() {
                        this.spliceWaypoints(waypoints.length, 0, null);
                    }, this);
                }
    
                if (this.options.reverseWaypoints) {
                    reverseBtn = L.DomUtil.create('button', 'leaflet-routing-reverse-waypoints', container);
                    reverseBtn.setAttribute('type', 'button');
                    L.DomEvent.addListener(reverseBtn, 'click', function() {
                        this._waypoints.reverse();
                        this.setWaypoints(this._waypoints);
                    }, this);
                }
    
                this._updateGeocoders();
                this.on('waypointsspliced', this._updateGeocoders);
    
                return container;
            },
    
            _createGeocoder: function(i) {
                var geocoder = this.options.createGeocoderElement(this._waypoints[i], i, this._waypoints.length, this.options);
                geocoder
                .on('delete', function() {
                    if (i > 0 || this._waypoints.length > 2) {
                        this.spliceWaypoints(i, 1);
                    } else {
                        this.spliceWaypoints(i, 1, new Waypoint());
                    }
                }, this)
                .on('geocoded', function(e) {
                    this._updateMarkers();
                    this._fireChanged();
                    this._focusGeocoder(i + 1);
                    this.fire('waypointgeocoded', {
                        waypointIndex: i,
                        waypoint: e.waypoint
                    });
                }, this)
                .on('reversegeocoded', function(e) {
                    this.fire('waypointgeocoded', {
                        waypointIndex: i,
                        waypoint: e.waypoint
                    });
                }, this);
    
                return geocoder;
            },
    
            _updateGeocoders: function() {
                var elems = [],
                    i,
                    geocoderElem;
    
                for (i = 0; i < this._geocoderElems.length; i++) {
                    this._geocoderContainer.removeChild(this._geocoderElems[i].getContainer());
                }
    
                for (i = this._waypoints.length - 1; i >= 0; i--) {
                    geocoderElem = this._createGeocoder(i);
                    this._geocoderContainer.insertBefore(geocoderElem.getContainer(), this._geocoderContainer.firstChild);
                    elems.push(geocoderElem);
                }
    
                this._geocoderElems = elems.reverse();
            },
    
            _removeMarkers: function() {
                var i;
                if (this._markers) {
                    for (i = 0; i < this._markers.length; i++) {
                        if (this._markers[i]) {
                            this._map.removeLayer(this._markers[i]);
                        }
                    }
                }
                this._markers = [];
            },
    
            _updateMarkers: function() {
                var i,
                    m;
    
                if (!this._map) {
                    return;
                }
    
                this._removeMarkers();
    
                for (i = 0; i < this._waypoints.length; i++) {
                    if (this._waypoints[i].latLng) {
                        m = this.options.createMarker(i, this._waypoints[i], this._waypoints.length);
                        if (m) {
                            m.addTo(this._map);
                            if (this.options.draggableWaypoints) {
                                this._hookWaypointEvents(m, i);
                            }
                        }
                    } else {
                        m = null;
                    }
                    this._markers.push(m);
                }
            },
    
            _fireChanged: function() {
                this.fire('waypointschanged', {waypoints: this.getWaypoints()});
    
                if (arguments.length >= 2) {
                    this.fire('waypointsspliced', {
                        index: Array.prototype.shift.call(arguments),
                        nRemoved: Array.prototype.shift.call(arguments),
                        added: arguments
                    });
                }
            },
    
            _hookWaypointEvents: function(m, i, trackMouseMove) {
                var eventLatLng = function(e) {
                        return trackMouseMove ? e.latlng : e.target.getLatLng();
                    },
                    dragStart = L.bind(function(e) {
                        this.fire('waypointdragstart', {index: i, latlng: eventLatLng(e)});
                    }, this),
                    drag = L.bind(function(e) {
                        this._waypoints[i].latLng = eventLatLng(e);
                        this.fire('waypointdrag', {index: i, latlng: eventLatLng(e)});
                    }, this),
                    dragEnd = L.bind(function(e) {
                        this._waypoints[i].latLng = eventLatLng(e);
                        this._waypoints[i].name = '';
                        if (this._geocoderElems) {
                            this._geocoderElems[i].update(true);
                        }
                        this.fire('waypointdragend', {index: i, latlng: eventLatLng(e)});
                        this._fireChanged();
                    }, this),
                    mouseMove,
                    mouseUp;
    
                if (trackMouseMove) {
                    mouseMove = L.bind(function(e) {
                        this._markers[i].setLatLng(e.latlng);
                        drag(e);
                    }, this);
                    mouseUp = L.bind(function(e) {
                        this._map.dragging.enable();
                        this._map.off('mouseup', mouseUp);
                        this._map.off('mousemove', mouseMove);
                        dragEnd(e);
                    }, this);
                    this._map.dragging.disable();
                    this._map.on('mousemove', mouseMove);
                    this._map.on('mouseup', mouseUp);
                    dragStart({latlng: this._waypoints[i].latLng});
                } else {
                    m.on('dragstart', dragStart);
                    m.on('drag', drag);
                    m.on('dragend', dragEnd);
                }
            },
    
            dragNewWaypoint: function(e) {
                var newWpIndex = e.afterIndex + 1;
                if (this.options.routeWhileDragging) {
                    this.spliceWaypoints(newWpIndex, 0, e.latlng);
                    this._hookWaypointEvents(this._markers[newWpIndex], newWpIndex, true);
                } else {
                    this._dragNewWaypoint(newWpIndex, e.latlng);
                }
            },
    
            _dragNewWaypoint: function(newWpIndex, initialLatLng) {
                var wp = new Waypoint(initialLatLng),
                    prevWp = this._waypoints[newWpIndex - 1],
                    nextWp = this._waypoints[newWpIndex],
                    marker = this.options.createMarker(newWpIndex, wp, this._waypoints.length + 1),
                    lines = [],
                    draggingEnabled = this._map.dragging.enabled(),
                    mouseMove = L.bind(function(e) {
                        var i,
                            latLngs;
                        if (marker) {
                            marker.setLatLng(e.latlng);
                        }
                        for (i = 0; i < lines.length; i++) {
                            latLngs = lines[i].getLatLngs();
                            latLngs.splice(1, 1, e.latlng);
                            lines[i].setLatLngs(latLngs);
                        }
    
                        L.DomEvent.stop(e);
                    }, this),
                    mouseUp = L.bind(function(e) {
                        var i;
                        if (marker) {
                            this._map.removeLayer(marker);
                        }
                        for (i = 0; i < lines.length; i++) {
                            this._map.removeLayer(lines[i]);
                        }
                        this._map.off('mousemove', mouseMove);
                        this._map.off('mouseup', mouseUp);
                        this.spliceWaypoints(newWpIndex, 0, e.latlng);
                        if (draggingEnabled) {
                            this._map.dragging.enable();
                        }
    
                        L.DomEvent.stop(e);
                    }, this),
                    i;
    
                if (marker) {
                    marker.addTo(this._map);
                }
    
                for (i = 0; i < this.options.dragStyles.length; i++) {
                    lines.push(L.polyline([prevWp.latLng, initialLatLng, nextWp.latLng],
                        this.options.dragStyles[i]).addTo(this._map));
                }
    
                if (draggingEnabled) {
                    this._map.dragging.disable();
                }
    
                this._map.on('mousemove', mouseMove);
                this._map.on('mouseup', mouseUp);
            },
    
            _focusGeocoder: function(i) {
                if (this._geocoderElems[i]) {
                    this._geocoderElems[i].focus();
                } else {
                    document.activeElement.blur();
                }
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{"./geocoder-element":52,"./waypoint":61}],61:[function(_dereq_,module,exports){
    (function (global){
    (function() {
        'use strict';
    
        var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null);
    
        module.exports = L.Class.extend({
            options: {
                allowUTurn: false,
            },
            initialize: function(latLng, name, options) {
                L.Util.setOptions(this, options);
                this.latLng = L.latLng(latLng);
                this.name = name;
            }
        });
    })();
    
    }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    },{}]},{},[53]);
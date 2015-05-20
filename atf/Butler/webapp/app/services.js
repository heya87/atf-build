angular.module('rv.servicesModule', [])
/**
 * A simple service that calls the provided callback whenever configured IOs change. 
 */
.factory('ravennaMediasService', function(ravennaCometdService) {
    var notConnected = 'n.c.';
    var c = {
        parseRoutingEntry: function(entry) {
            var j = entry.indexOf('/');
            return {media: entry.substr(0, j), index: entry.substr(j + 1)}; // note: index is a string, also
        },
         
        getInputMedias: function(configuredOnly) {
            var medias = [];
            angular.forEach(ravennaCometdService.data.medias, function(value, key) { 
                if ((!configuredOnly  ||  value.configured)   &&  value.inputs  &&  value.inputs[0])
                    medias.push(key); 
            });
            return medias;
        },
        
        getOutputMedias: function(configuredOnly) {
            var medias = [];
            angular.forEach(ravennaCometdService.data.medias, function(value, key) { 
                if ((!configuredOnly  ||  value.configured)  &&  value.outputs  &&  value.outputs[0])
                    medias.push(key); 
            });
            return medias;
        },
        
        getDefaultInputMedia: function() {
            return c.getInputMedias()[0];
        },
        
        getDefaultOutputMedia: function() {
            return c.getOutputMedias()[0];
        },

        getInputLabel: function(trackName) {
            var routingEntry = c.parseRoutingEntry(trackName);
            try {
                var track;
                if (ravennaCometdService.data.routing)
                    track = ravennaCometdService.data.routing.inputs[routingEntry.media][routingEntry.index];
                else
                    track = ravennaCometdService.data.medias[routingEntry.media].inputs[routingEntry.index];
                return track.labels['user'];
            }
            catch (e) {}
            return notConnected;
        },
         
        // @param track a track name, i.e. 'RAVENNA Audio-ra0/1'
        // @return a label for the given input track
        getInputSourceLabel: function(trackName) {
            if (ravennaCometdService.data.routing) {
                try {
                    var routingEntry = c.parseRoutingEntry(trackName);
                    trackName = ravennaCometdService.data.routing.outputs[routingEntry.media][routingEntry.index].in;
                }
                catch (e) {
                    trackName = undefined;
                }
            }
            if (trackName)
                return c.getInputLabel(trackName);
            return notConnected;
        },
        
        // looks up the router matrix output(s) that are using this track as input
        revRoutingMap: {},
        createReverseRoutingMap: function() {
            c.revRouting = {};
            angular.forEach(ravennaCometdService.data.routing.outputs, function(media, mediaKey) {
                angular.forEach(media, function(output, outputKey) {
                    if (!c.revRouting[output.in])
                        c.revRoutingMap[output.in] = mediaKey + '/' + outputKey;
                    else
                        c.revRoutingMap[output.in] += '...'; // add '...' as indicator that multiple outputs make use of that input
                });
            });
        },
        
        // the returns the label of the given track name
        getOutputLabel: function(trackName) {
            var routingEntry = c.parseRoutingEntry(trackName);
            try {
                var track;
                if (ravennaCometdService.data.routing)
                    track = ravennaCometdService.data.routing.outputs[routingEntry.media][routingEntry.index];
                else
                    track = ravennaCometdService.data.medias[routingEntry.media].outputs[routingEntry.index];
                return track.labels['user'];
            }
            catch (e) {}
            return notConnected;
        },
         
        getOutputDestinationLabel: function(trackName) {
            if (ravennaCometdService.data.routing)
                trackName = c.revRoutingMap[trackName];
            if (trackName)
                return c.getOutputLabel(trackName);
            return notConnected;
        }        
    };
    
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.routing;
        },
        function(data, changes) { // apply function
            c.createReverseRoutingMap();
    });    
    if (ravennaCometdService.data.routing)
        c.createReverseRoutingMap();
    
    return c;
})
/**
 * A simple service that provides an easy interface to the ravenna cometd commands
 */
.factory('ravennaSessionsService', function(ravennaCometdService) {
    var listSessionsCallbacks_ = [];
    var resolveSessionCallbacks_ = [];
    
    ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        // list all sessions
        if (message.data.command == 'listSessions') {
            if (listSessionsCallbacks_.length > 0) {
                var cb = listSessionsCallbacks_[0];
                listSessionsCallbacks_.splice(0, 1);
                cb(message.data.result);
            }
        }
        // update any resolved sessions in our map
        else if (message.data.command == 'resolveSession') {
            if (resolveSessionCallbacks_.length > 0) {
                var cb = resolveSessionCallbacks_[0];
                resolveSessionCallbacks_.splice(0, 1);
                cb(message.data.result.sdp);
            }
        }
    });    
    
    var c = {
        // updates $scope.discoveredSessions when called
        listSessions: function(cb) {
            listSessionsCallbacks_.push(cb); // mind callback
            ravennaCometdService.command({command: 'listSessions'});
        },
        
        resolveSession: function(uri, cb) {
            resolveSessionCallbacks_.push(cb); // mind callback
            ravennaCometdService.command({command: 'resolveSession', params: {uri: uri}});
        },
        
        // changes: {destination: {...}, receiver: {...}, media: '...', map: [...]}
        saveDestination: function(destinationId, changes, onComplete, onError) {
            // update track routing
            // collect all routing changes in 'updates' which is a map containg media(s) and the changes for that media
            var updates = {};
            angular.forEach(ravennaCometdService.data.medias, function(media, mediaKey) {
                if (!media.configured)
                    return;
                
                updates[mediaKey] = {};
                angular.forEach(media.outputs, function(track, trackKey) {
                    var inRouting = track.in;
                    if (changes.media != media) {
                        // reset track routing for all tracks of this media
                        if (inRouting  &&  inRouting.indexOf(destinationId) == 0  &&  inRouting[destinationId.length] == '/') {
                            updates[mediaKey][trackKey] = "";
                    }
                    else {
                        if (inRouting  &&  inRouting.indexOf(destinationId) == 0  &&  inRouting[destinationId.length] == '/') {
                            var channel = parseInt(inRouting.substr(destinationId.length + 1));
                            if (channel >= changes.map  ||  changes.map[channel] != parseInt(trackKey))
                                // not in our map -> clear routing
                                updates[mediaKey][trackKey] = "";
                            }
                        }
                    }
                });
            });
            for (var channel = 0; channel < changes.map.length; ++ channel) {
                var track = changes.map[channel];
                if (track !== undefined  &&  track >= 0  &&  track != null)
                    updates[changes.media][track.toString()] = destinationId + "/" + channel;
            }
            // apply all changes
            angular.forEach(updates, function(media, mediaKey) {
                var ins = updates[mediaKey]; // array with all changes for this media
                angular.forEach(ins, function(inValue, trackKey) {
                    ravennaCometdService.publish({path: '$.medias.' + changes.media + '.outputs.' + trackKey + '.in',  value: inValue});
                });
            });
            
            // fix some things to make sure we do not overwrite things we don't want to
            delete changes.destination.SCHEMA
            delete changes.destination.id;
            delete changes.receiver.SCHEMA;
            delete changes.receiver.delay_OPTIONS;
            delete changes.receiver.localAddress;
            delete changes.receiver.state;
            delete changes.receiver.stats;
            
            // add CR to SDP if needed (some browsers remove CR/LF from the SDP if it was edited)
            if (changes.destination.sdp  &&  changes.destination.sdp.indexOf('\r\n') < 0) {
                changes.destination.sdp = changes.destination.sdp.replace(/\n/g, '\r\n');
            }
            
            var settings = {sessions:{ destinations: {}}, streams: {receivers: {}}};
            settings.sessions.destinations[destinationId] = changes.destination;
            settings.streams.receivers[destinationId] = changes.receiver;
            
            ravennaCometdService.publish({path: '$.streaming', value: settings}, {onComplete: onComplete, onError: onError });
        },
        
        saveSource: function(sourceId, changes, onComplete, onError) {
            var ipAddressPortTTLPattern = /^((\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)(?:\.(\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)){3})(\:(6553[0-5]|655[0-2]\d|65[0-4]\d\d|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}|0))?(\/(2[0-4]\d|25[0-5]|1\d\d|[1-9]\d|\d))?$/;

            // multicast address parsing - we expect: <multicast-address>[:<port>][/<ttl>]
            if (changes.sender.address !== undefined  &&  changes.sender.address != "auto") {
                var strs = changes.sender.address.split(ipAddressPortTTLPattern);
                var streams = angular.copy(changes.streams);
                changes.sender.address = strs[1];
                if (strs[5])
                    changes.sender.port = parseInt(strs[5]);
                else
                    delete changes.sender.port;
                if (strs[7])
                    changes.sender.ttl = parseInt(strs[7]);
                else
                    delete changes.sender.ttl;
            }
            else
                changes.sender.address = "auto";
            
            // fix some things to make sure we do not overwrite things we don't want to
            delete changes.source.SCHEMA;
            delete changes.source.id;
            changes.source.senders = sourceId;
            delete changes.sender.SCHEMA;
            delete changes.sender.localAddress;
            delete changes.sender.state;
            delete changes.sender.stats;
            
            var settings = {sessions:{ sources: {}}, streams: {senders: {}}};
            settings.sessions.sources[sourceId] = changes.source;
            settings.streams.senders[sourceId] = changes.sender;
            
            ravennaCometdService.publish({path: '$.streaming', value: settings}, {onComplete: onComplete, onError: onError });
        },
        
        getEmptyDestination: function() {
            return angular.copy({
                destination: {
                    name: '',
                    uri: '',
                    sdp: ''
                },
                receiver: {
                    label: '',
                    delay: 512,
                    delay_OPTIONS: [64,128,256,512,1024],
                    syntonized: false,
                    state: 0,
                    stats: {
                        ssrc: '',
                        rtcpReceiverReport: {
                            '0': {
                                ssrc: '',
                                cummulativeLost: 0,
                                fractionalLost: 0,
                                interarrivalJitter: 0,
                            }
                        }
                    }
                }
            })
        },
    
        getEmptySource: function() {
            return angular.copy({
                source: {
                    id: '',
                    name: '',
                    senders: ''
                },
                sender: {
                    address: 'auto',
                    port: 5004,
                    ttl: 1,
                    localAddress: '',
                    map: [],
                    dscp: 0x2e,
                    payload: 98,
                    state: 0,
                    codec: 'L24',
                    codecParameters: {
                        frameSize: 64,
                        frameSize_OPTIONS: [64, 128, 256]
                    },
                    stats: {
                        rtcpSenderReport: {
                            '0': {
                            }
                        }
                    }
                }
            })
        }
    };
    return c;
})
/**
 * Parses an SDP into a JSON structure.
 * The resulting structure is:
 * {
 *      name: ...,
 *      streams: [
 *          {
 *              codec: ...,
 *              sampleRate: ...,
 *              channelCount: ...,
 *              frameCount: ...,
 *              channels: []
 *          }, ...
 *      ]
 * }
 * @todo this is currently very crude and only really parses a very simplistic RAVENNA sdp with a single stream
 * @param sdp the sdp string
 */
.factory('sdpParser', function() {
    return {
        parse: function(sdpString) {
            if (sdpString === undefined  ||  sdpString.length == 0)
                return undefined;
            
            var sdp = {};
            
            var name = sdpString.match(/(s=(.*))(\r)?\n/);
            if (name  &&  name.length >= 3)
                sdp.name = name[2];
            else
                sdp.name = "";
            
            sdp.streams = [];
            sdp.streams[0] = {};
            
            var codecs = sdpString.match(/(a=rtpmap:[0-9]+ (.*)\/(.*)\/(.*))/);
            if (codecs  &&  codecs.length == 5) {
                sdp.streams[0].codec = codecs[2];
                sdp.streams[0].sampleRate = parseInt(codecs[3]);
                sdp.streams[0].channelCount = parseInt(codecs[4]);
            }
            
            var frameCount = sdpString.match(/(a=framecount:([0-9]+))/);
            if (frameCount  &&  frameCount.length == 3)
                sdp.streams[0].frameCount = parseInt(frameCount[2]);
            
            var channels = sdpString.match(/(i=(.*))(\r)?\n/);
            if (channels  &&  channels.length >= 3)
                sdp.streams[0].channels = channels[2].split(',');
            if (!sdp.streams[0].channels  ||  sdp.streams[0].channels.length != sdp.streams[0].channelCount)
                sdp.streams[0].channels = new Array(sdp.streams[0].channelCount);

            return sdp;
        }
    };
})
/**
 * Detect handler: detects what stream type is represented in an SDP.
 */
.factory('streamClassify', function() {
    var aes67 = {type: 'aes67', text: 'This is an AES67 compliant stream.', color: '#49afcd'};
    var rav = {type: 'rav', text: 'This is a RAVENNA compliant stream.', icon: 'img/ravenna_logo.png', color: '#bfc81f'};
    var unknown = {type: 'non', text: 'This is an unknown stream type.'};
    return {
        /**
         * @param sdp the parsed SDP (see sdpParser)
         */
        detect: function(sdp) {
            if (sdp  &&  sdp.streams  &&  sdp.streams[0]) {
                if (((sdp.streams[0].frameCount == 48  &&  sdp.streams[0].sampleRate == 48000)
                            || (sdp.streams[0].frameCount == 44  &&  sdp.streams[0].sampleRate == 44100)
                            || (sdp.streams[0].frameCount == 96  &&  sdp.streams[0].sampleRate == 96000)
                            || (sdp.streams[0].frameCount == 88  &&  sdp.streams[0].sampleRate == 88200))
                        &&  (sdp.streams[0].codec == 'L24'  ||  sdp.streams[0].codec == 'L16')
                        &&  sdp.streams[0].channelCount <= 8) {
                    return aes67;
                }
                else if ((sdp.streams[0].codec == 'L24'  ||  sdp.streams[0].codec == 'L16'  ||  sdp.streams[0].codec == 'AM824'  ||  sdp.streams[0].codec == 'L32'))
                    return rav;
                else 
                    return unknown;
            }
            return undefined;
        }        
    };
})
/**
 * Preset handler.
 * Sets presets and detects a preset based on what is configured in a stream sender.
 */
.factory('streamPresets', function() {
    return {
        names: {
            aes67: 'AES67 Standard Stereo Stream',
            ravStereo: 'RAVENNA Stereo Stream',
            rav8: 'RAVENNA 8-Channel Stream',
            rav64: 'RAVENNA 64-Channel Stream',
            ravAESEBUStereo: 'RAVENNA AES/EBU Stereo Stream'
        },
        icons: {
            ravStereo: 'img/ravenna_logo.png',
            rav8: 'img/ravenna_logo.png',
            rav64: 'img/ravenna_logo.png',
            ravAESEBUStereo: 'img/ravenna_logo.png'
        },
        colors: {
            aes67: '#49afcd',
            ravStereo: '#bfc81f',
            rav8: '#bfc81f',
            rav64: '#bfc81f',
            ravAESEBUStereo: '#bfc81f'
        },

        /**
         * @param stream a source stream
         * @param preset 'aes67', 'ravStereo', 'rav8', 'rav64', 'ravAESEBUStereo' or undefined
         */
        set: function(preset, scope, stream) {
            if (preset == 'aes67') {
                scope.channelCount = 2;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 48;
            }
            else if (preset == 'ravStereo') {
                scope.channelCount = 2;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 64;
            }
            else if (preset == 'rav8') {
                scope.channelCount = 8;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 58;
            }
            else if (preset == 'rav64') {
                scope.channelCount = 64;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 4;
            }
            else if (preset == 'ravAESEBUStereo') {
                scope.channelCount = 2;
                stream.codec = 'AM824';
                stream.codecParameters.frameSize = 64;
            }
        },
        
        /**
         * @param stream a sender stream
         */
        detect: function(stream) {
            if (stream.map.length == 2  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 48)
                return 'aes67';
            if (stream.map.length == 2  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 64)
                return 'ravStereo';
            if (stream.map.length == 8  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 32)
                return 'rav8';
            if (stream.map.length == 64  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 4)
                return 'rav64';
            if (stream.map.length == 2  &&  stream.codec == 'AM824'  &&  stream.codecParameters.frameSize == 64)
                return 'ravAESEBUStereo';
            return '';
        }
    };
})
// http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
// adapted from angular's $timeout code
.factory('$debounce', ['$rootScope', '$browser', '$q', '$exceptionHandler',
    function($rootScope,   $browser,   $q,   $exceptionHandler) {
        var deferreds = {},
            methods = {},
            uuid = 0;

        function debounce(fn, delay, invokeApply) {
            var deferred = $q.defer(),
                promise = deferred.promise,
                skipApply = (angular.isDefined(invokeApply) && !invokeApply),
                timeoutId, cleanup,
                methodId, bouncing = false;

            // check we dont have this method already registered
            angular.forEach(methods, function(value, key) {
                if(angular.equals(methods[key].fn, fn)) {
                    bouncing = true;
                    methodId = key;
                }
            });

            // not bouncing, then register new instance
            if(!bouncing) {
                methodId = uuid++;
                methods[methodId] = {fn: fn};
            } else {
                // clear the old timeout
                deferreds[methods[methodId].timeoutId].reject('bounced');
                $browser.defer.cancel(methods[methodId].timeoutId);
            }

            var debounced = function() {
                // actually executing? clean method bank
                delete methods[methodId];

                try {
                    deferred.resolve(fn());
                } catch(e) {
                    deferred.reject(e);
                    $exceptionHandler(e);
                }

                if (!skipApply) $rootScope.$apply();
            };

            timeoutId = $browser.defer(debounced, delay);

            // track id with method
            methods[methodId].timeoutId = timeoutId;

            cleanup = function(reason) {
                delete deferreds[promise.$$timeoutId];
            };

            promise.$$timeoutId = timeoutId;
            deferreds[timeoutId] = deferred;
            promise.then(cleanup, cleanup);

            return promise;
        }


        // similar to angular's $timeout cancel
        debounce.cancel = function(promise) {
            if (promise && promise.$$timeoutId in deferreds) {
                deferreds[promise.$$timeoutId].reject('canceled');
                return $browser.defer.cancel(promise.$$timeoutId);
            }
            return false;
        };

        return debounce;
}]);

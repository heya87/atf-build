   
// a single destination
// @requires 'id' must be set in the scope
rv.controllers.destination = function($scope, ravennaCometdService, ravennaIONamesService, sdpParser, presetHandler, $routeParams) {
    if ($routeParams  &&  $routeParams.id)
        $scope.id = $routeParams.id;

    $scope.presetHandler = presetHandler;
    
    var empty = {
        destination: {
            name: '',
            uri: '',
            sdp: ''
        },
        receiver: {
            label: '',
            delay: 128,
            delay_OPTIONS: [],
            syntonized: false,
            state: 0,
            codec: "",
            codecParameters: {}
        }
    };
    
    // the unchanged server session data
    $scope.server = angular.copy(empty);
    
    // the local (possibly changed) session data
    $scope.local = angular.copy(empty);
    
    // if true all controls are disabled
    $scope.disabled = true;
    
    // local media and map
    $scope.media = "";
    $scope.map = [];
    
    // the current channel count
    $scope.channelCount = 0;

    // if true, then the channel map is handled as a single block
    $scope.isMapLinked = false;
    
    // the outputs of the currently selected IO - updated every time the IO changes
    $scope.outputs = [];
    
    // array linked outputs
    $scope.linkedOuts = [];
    
    // map with warnings that should be reflected in the UI
    $scope.warnings = {lost: 0}; // 0: all OK, 1: warning, 2: error
    
    // updates $scope.discoveredSessions when called
    $scope.updateDiscoveredSessions = function() {
        ravennaCometdService.command({command: 'listSessions'});
    };   
    
    // returns the detected preset of the current local(!) stream, i.e. 'aes67'
    $scope.detectPreset = function() {
        return presetHandler.detect($scope.local.parsedSdp);
    };
    
    // updates $scope.ioNames whenever the configured IOs change
    ravennaIONamesService.addOutsListener($scope, function(ios) { $scope.$apply( function() { $scope.ioNames = ios; }); });
    
    // update linkedOuts
    var updateLinkedOuts = function() {
        if (!$scope.channelCount  ||  !$scope.media)
            return;
        
        $scope.linkedOuts = [];
        if (ravennaCometdService.data.medias[$scope.media]) { 
            for (var i = 0; i < $scope.outputs.length - $scope.channelCount + 1; ++ i) {
                var arr = [];
                for (var j = 0; j < $scope.channelCount; ++ j)
                    arr.push(i + j);
                $scope.linkedOuts[i] = arr;
            }
        }
    };
    
    // updates the 'outputs' map with usage info (which channel is used by which session sink)
    var updateOuts = function() { 
        $scope.outputs = [];
        if (ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media])
                $scope.outputs = rv.helpers.formatInsOuts(ravennaCometdService.data.medias[$scope.media].outputs, $scope.id, " *");
        }
        updateLinkedOuts();
    };
    
    // updates the local channel count and map from a known SDP for the current local source
    var updateChannelMapFromSDP = function() {
        var sdp = $scope.local.destination.sdp;
        if (sdp) {
            var channelCount = $scope.local.parsedSdp.streams[0].channelCount;
            $scope.channelCount = channelCount;
            
            // check if a channel auto selection is needed at all
            if ($scope.map  &&  $scope.map.length == channelCount)
                return;
            if ($scope.map.length < channelCount) {
                while ($scope.map.length < channelCount)
                    $scope.map.push(undefined);
                $scope.isMapLinked = false;
                return;
            }
            
            // try to auto select the channels
            var outputs = ravennaCometdService.data.medias[$scope.media].outputs;
            var start = undefined;
            var id = $scope.id;
            for (var i = 0; outputs[i.toString()]  &&  start === undefined; ++ i) {
                for (var j = i; outputs[j.toString()]  &&  j < i + channelCount; ++ j) {
                    var track = outputs[j.toString()];
                    if (track.in  &&  track.in.length > 0  &&  track.in.indexOf(id + '/') < 0)
                        break;
                }
                if (j == i + channelCount)
                    start = i;
            }
            start = start || 0;
            
            // set map
            $scope.map = [];
            for (var i = 0; i < channelCount; ++ i)
                $scope.map[i] = start + i;
        }
    };
    
    $scope.$watch('channelCount', function() { rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateLinkedOuts(); });
    $scope.$watch('isMapLinked', function() { updateLinkedOuts(); rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });
    $scope.$watch('media', updateOuts);
    $scope.$watch('map', function() { if ($scope.local.receiver  &&  $scope.map) $scope.channelCount = $scope.map.length; });
    $scope.$watch('map[0]', function() { if ($scope.local.receiver)  rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });
    
    // @return true if the local copy is not changed
    $scope.isClean = function() {
        var parsed = $scope.parseTrackRouting(ravennaCometdService.data.medias);
        return angular.equals($scope.local, $scope.server)  &&  angular.equals($scope.map, parsed.map)  && $scope.media == parsed.media;
    };

    // saves the local data to the server
    $scope.save = function() {
        $scope.disabled = true;
        
        // update track routing
        // collect all routing changes in 'updates' which is a map containg media(s) and the changes for that media
        var updates = {};
        angular.forEach(ravennaCometdService.data.medias, function(media, mediaKey) {
            if (!media.configured)
                return;
            
            updates[mediaKey] = {};
            angular.forEach(media.outputs, function(track, trackKey) {
                var inRouting = track.in;
                if ($scope.media != media) {
                    // reset track routing for all tracks of this media
                    if (inRouting  &&  inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                        updates[mediaKey][trackKey] = "";
                }
                else {
                    if (inRouting  &&  inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                        var channel = parseInt(inRouting.substr($scope.id.length + 1));
                        if (channel >= $scope.map  ||  $scope.map[channel] != parseInt(trackKey))
                            // not in our map -> clear routing
                            updates[mediaKey][trackKey] = "";
                        }
                    }
                }
            });
        });
        for (var channel = 0; channel < $scope.map.length; ++ channel) {
            var track = $scope.map[channel];
            if (track !== undefined  &&  track >= 0  &&  track != null)
                updates[$scope.media][track.toString()] = $scope.id + "/" + channel;
        }
        // apply all changes
        angular.forEach(updates, function(media, mediaKey) {
            var ins = updates[mediaKey]; // array with all changes for this media
            angular.forEach(ins, function(inValue, trackKey) {
                ravennaCometdService.publish({path: '$.medias.' + $scope.media + '.outputs.' + trackKey + '.in',  value: inValue});
            });
        });
        
        ravennaCometdService.publish({path: '$.streaming.sessions.destinations.' + $scope.id,  value: $scope.local.destination}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();})}});
        ravennaCometdService.publish({path: '$.streaming.streams.receivers.' + $scope.id, value: $scope.local.receiver}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();})}});
    };
    
    // saves the local source to the server
    $scope.saveSource = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.streaming.sessions.destinations.' + $scope.id + ".uri", value: $scope.local.destination.uri}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();})}});
    };

    // if the local source has changed we try to resolve the SDP for that 
    $scope.$watch('local.destination.uri', function() {
        if ($scope.local.destination.uri  &&  $scope.local.destination.uri.length > 0  &&  $scope.local.destination.uri != $scope.server.destination.uri) {
            $scope.local.destination.sdp = '';
            ravennaCometdService.command({command: 'resolveSession', params: {uri: $scope.local.destination.uri}});
        }
        else {
            if ($scope.local.destination.uri == $scope.server.destination.uri) {
                $scope.local.destination.sdp = $scope.server.destination.sdp
                $scope.local.parsedSdp = $scope.server.parsedSdp;
            }
        
            updateChannelMapFromSDP();
        }
    });
    
    // removes this sink
    // note: the sink is not actually removed here - just a request to the server is sent
    $scope.remove = function() {
        ravennaCometdService.command({path: '$.streaming.sessions.destinations.' + $scope.id, command: 'remove'});
    };
    
    $scope.parseTrackRouting = function(medias) {
    var res = {media: "", map: []};
        angular.forEach(medias, function(media, mediaKey) {
            angular.forEach(media.outputs, function(track, trackKey) {
                var inRouting = track.in;
                if (inRouting  &&  inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                    var channel = parseInt(inRouting.substr($scope.id.length + 1));
                    res.media = mediaKey;
                    res.map[channel] = parseInt(trackKey);
                }
            });
        });
        return res;
    };
    
    // resets the local copy of the server data
    $scope.reset = function() {
        $scope.server.parsedSdp = sdpParser.parse($scope.server.destination.sdp);
        $scope.local = angular.copy($scope.server);
        
        var res = $scope.parseTrackRouting(ravennaCometdService.data.medias);
        $scope.media = res.media;
        $scope.map = res.map;

        setDefaultIO($scope);
        $scope.channelCount = $scope.map.length;
        $scope.isMapLinked = rv.controllers.session.evalMapLinked($scope.map);
        
        $scope.disabled = false;        
    };
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.destinations  &&  !angular.equals(data.streaming.sessions.destinations[$scope.id], $scope.server.destination);
        },
        function(data, changes) { // apply function
            $scope.$evalAsync(function() { 
                $scope.server.destination = data.streaming.sessions.destinations[$scope.id];
                $scope.reset(); 
            });
        }));    
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.streams  &&  data.streaming.streams.receivers[$scope.id]  &&  !angular.equals(data.streaming.streams.receivers[$scope.id], $scope.server.receiver);
        },
        function(data, changes) { // apply function
            $scope.$evalAsync(function() { 
                $scope.server.receiver = data.streaming.streams.receivers[$scope.id];
                $scope.reset(); 
            });
        }));    
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias;
        },
        function(data, changes) { // apply function
            $scope.$evalAsync(function() { 
                $scope.reset(); 
            });
        }));    
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
    // commands listener
    var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        // list all sessions
        if (message.data.command == 'listSessions') {
            $scope.$apply(function() {
               $scope.discoveredSessions = message.data.result;
            });
        }
        // update any resolved sessions in our map
        if (message.data.command == 'resolveSession') {
            if (message.data.result.uri == $scope.local.destination.uri)
                $scope.$apply(function() { 
                    $scope.local.destination.sdp = message.data.result.sdp;
                    $scope.local.parsedSdp = sdpParser.parse($scope.local.destination.sdp);
                    updateChannelMapFromSDP();
                });
        }
    });    
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });    
};
rv.controllers.destination.$inject = ['$scope', 'ravennaCometdService', 'ravennaIONamesService', 'sdpParser', 'presetHandler', '$routeParams'];

// the sink RTCP status and graphs
rv.controllers.destination.rtcp = function($scope, ravennaCometdService) {
    // RTCP status
    $scope.status = {};
    
    // jitter graph: pairs of index/jitter
    $scope.jitter = [[]];
    
    // lost packets graph: pairs of index/jitter
    $scope.lost = [[]];
    
    // status messages listener
    var s = ravennaCometdService.subscribe('/ravenna/stream/streaming/streams/receivers/' + $scope.id, function(message) {
        var v = message.data;
        $scope.$evalAsync(function() {
            $scope.status = v;
            
            function updateGraph(arr, value) {
                while (arr.length < $scope.graphLength)
                    arr.push([]);
                
                arr.push([0, value]);
                if (arr.length > $scope.graphLength)
                    arr.splice(0, arr.length - $scope.graphLength);
                
                angular.forEach(arr, function(e, i) { e[0] = i; });
            };
            
            // update jitter data
            updateGraph($scope.jitter[0], v.jitter);
            
            // update lost packets data
            updateGraph($scope.lost[0], v.lost);
            
            // signal lost packets error
            if ($scope.warnings.lost > 0)
                $scope.warnings.lost --;
            if (v.lost > 0)
                $scope.warnings.lost = 2;            
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.destination.rtcp.$inject = ['$scope', 'ravennaCometdService'];


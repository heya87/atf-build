// a single destination
// @requires 'id' must be set in the scope
rv.controllers.destination = function($scope, $modal, $debounce, ravennaCometdService, sdpParser, ravennaSessionsService, ravennaMediasService) {
    // copy of the server data
    $scope.server = angular.copy(ravennaSessionsService.getEmptyDestination());
    
    // parsed tracks that are currenty assigned to this destination
    $scope.tracks = [];
    $scope.trackLabels = [];

    // create a list of the tracks of this stream
    var getTracks = function() {
        $scope.tracks = [];
        
        // we have to go thru all of our medias and check if any channel is used by any of it
        angular.forEach(ravennaCometdService.data.medias, function(media, mediaKey) {
            angular.forEach(media.outputs, function(track, trackKey) {
                var inRouting = track.in;
                if (inRouting  &&  inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                    var channel = parseInt(inRouting.substr($scope.id.length + 1));
                    $scope.tracks[channel] = mediaKey + "/" + trackKey;
                }
            });
        });
        if ($scope.server.parsedSdp  &&  $scope.server.parsedSdp.streams[0]  &&  $scope.server.parsedSdp.streams[0].channelCount) {
            while ($scope.tracks.length < $scope.server.parsedSdp.streams[0].channelCount)
                $scope.tracks.push(undefined);
        }
        
        $scope.trackLabels = [];
        for (var i = 0; i < $scope.tracks.length; ++ i)
            $scope.trackLabels[i] = ravennaMediasService.getOutputDestinationLabel($scope.tracks[i]);
    };
      
    var reset = function() { 
        $scope.server.destination = ravennaCometdService.data.streaming.sessions.destinations[$scope.id];
        $scope.server.receiver = ravennaCometdService.data.streaming.streams.receivers[$scope.id];
        $scope.server.parsedSdp = sdpParser.parse($scope.server.destination.sdp);
    };

    $scope.getLabel = function(track) {
        if (track)
            return ravennaMediasService.getInputLabel(track);
        return "unknown";
    };
    
    $scope.editDestination = function() {
        var modalInstance = $modal.open({
            templateUrl: 'app/destination/destinationProperties.html',
            scope: $scope,
            controller: 'rv.controllers.editDestination'
        });

        modalInstance.result.then(function(changes) {
                ravennaSessionsService.saveDestination($scope.id, changes, 
                    function() { $scope.$apply(function() {reset();}) },
                    function() { $scope.$apply(function() {reset();}) })
            }, function () {});
    };
    
    // saves the local source to the server
    $scope.saveSource = function() {
        ravennaCometdService.publish({path: '$.streaming.sessions.destinations.' + $scope.id + ".uri", value: $scope.local.destination.uri}, {
            onComplete: function(message) { $scope.$apply(function() {reset();}) },
            onError: function(message) { $scope.$apply(function() {reset();})}});
    };

    // removes this destination (note: the sink is not actually removed here - just a request to the server is sent)
    $scope.remove = function() {
        var modalInstance = $modal.open({
            templateUrl: 'app/destination/removeDestination.html',
            scope: $scope.$new()
        });

        modalInstance.result.then(function(changes) {
                ravennaCometdService.command({path: '$.streaming.sessions.destinations.' + $scope.id, command: 'remove'});
            }, function () {});
    };
    
    var init1 = function() {
        $scope.$evalAsync(function() {
            $scope.server.destination = ravennaCometdService.data.streaming.sessions.destinations[$scope.id];
            $scope.server.parsedSdp = sdpParser.parse($scope.server.destination.sdp);
        });
    };
    var init2 = function() { 
        $scope.$evalAsync(function() {
            $scope.server.receiver = ravennaCometdService.data.streaming.streams.receivers[$scope.id];
        });
    };
    var init3 = function() {
        $scope.$evalAsync(function() {
            getTracks();
        });
    };
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.destinations  &&  data.streaming.sessions.destinations[$scope.id];
        },
        function(data, changes) { // apply function
            $debounce(init1, 200);
            $debounce(init3, 500);
        }));    
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.streams  &&  data.streaming.streams.receivers  &&  data.streaming.streams.receivers[$scope.id];
        },
        function(data, changes) { // apply function
            $debounce(init2, 200);
            $debounce(init3, 500);
        }));    
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias;
        },
        function(data, changes) { // apply function
            $debounce(init3, 500);
        }));    
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
};
rv.controllers.destination.$inject = ['$scope', '$modal', '$debounce', 'ravennaCometdService', 'sdpParser', 'ravennaSessionsService', 'ravennaMediasService'];

// a single destination
// @requires 'id' must be set in the scope
rv.controllers.editDestination = function($scope, ravennaCometdService, ravennaMediasService, sdpParser, streamClassify, ravennaSessionsService) {
    // the local (possibly changed) session data
    $scope.local = angular.copy($scope.server); // copy from parent
    
    // local media and map
    $scope.media = '';
    $scope.map = [];
    
    // the current channel count
    $scope.channelCount = 0;
    
    // if true, then the channel map is handled as a single block
    $scope.isMapLinked = false;
    
    // the outputs of the currently selected IO - updated every time the IO changes
    $scope.outputs = [];
    $scope.outputIndices = [];
    
    // array linked outputs
    $scope.linkedOuts = [];
    $scope.linkedOutsLabels = [];
    
    // updates $scope.discoveredSessions when called
    $scope.listSessions = function() {
        ravennaSessionsService.listSessions(function(sessions) { $scope.$evalAsync(function() { $scope.discoveredSessions = sessions; })})
    };   
    
    // updates $scope.medias whenever the configured IOs change
    $scope.medias = ravennaMediasService.getOutputMedias(true);
    
    // update linkedOuts
    var updateLinkedOuts = function() {
        if (!$scope.channelCount  ||  !$scope.media)
            return;
        
        $scope.linkedOuts = [];
        $scope.linkedOutsLabels = [];
        if (ravennaCometdService.data.medias[$scope.media]) { 
            for (var i = 0; i < $scope.outputs.length - $scope.channelCount + 1; ++ i) {
                var arr = [];
                var larr = [];
                for (var j = 0; j < $scope.channelCount; ++ j) {
                    arr.push(i + j);
                    larr.push($scope.outputs[i + j]);
                }
                $scope.linkedOuts[i] = arr;
                $scope.linkedOutsLabels[i] = larr.join(', ');
            }
        }
    };
    
    // updates the 'outputs' map with usage info (which channel is used by which session sink)
    var updateOuts = function() { 
        $scope.outputs = [];
        $scope.outputIndices = [];
        if (ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media]) {
                for (var i = 0; ravennaCometdService.data.medias[$scope.media].outputs[i.toString()]; ++ i) {
                    var track = $scope.media + "/" + i;
                    var label = ravennaMediasService.getOutputDestinationLabel(track);
                    
                    var input = ravennaCometdService.data.medias[$scope.media].outputs[i.toString()].in;
                    if (input.length > 0  &&  input.indexOf($scope.id + "/") != 0)
                        label += "*";
                        
                    $scope.outputs.push(label);
                    $scope.outputIndices[i] = i;
                };
            }
        }
        updateLinkedOuts();
    };
    
    // updates the local channel count and map from a known SDP for the current local source
    var updateChannelMapFromSDP = function() {
        var sdp = $scope.local.destination.sdp;
        if (!sdp  ||  !$scope.media)
            return;
        
        var channelCount = $scope.local.parsedSdp.streams[0].channelCount;
        $scope.channelCount = channelCount;
        
        if ($scope.map.length > channelCount) {
            $scope.map.splice(channelCount, $scope.map.length - channelCount);
        }
        else if ($scope.map.length < channelCount) {
            while ($scope.map.length < channelCount)
                $scope.map.push(undefined);
            $scope.isMapLinked = false;
        }
    }
    
    var autoSelectTracks = function() {
        var sdp = $scope.local.destination.sdp;
        var channelCount = $scope.local.parsedSdp.streams[0].channelCount;
        var outputs = ravennaCometdService.data.medias[$scope.media].outputs;
        var start;
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
        
        // set channel count
        $scope.channelCount = channelCount;
        
        // set map
        $scope.map = [];
        for (i = 0; i < channelCount; ++ i)
            $scope.map[i] = start + i;
    };
    
    $scope.$watch('channelCount', function() { rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateLinkedOuts(); });
    $scope.$watch('isMapLinked', function() { updateLinkedOuts(); rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });
    $scope.$watch('media', function() { updateChannelMapFromSDP(); updateOuts(); });
    $scope.$watch('map[0]', function() { if ($scope.local.receiver)  rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });
    
    // @return true if the local copy is not changed
    $scope.isClean = function() {
        var parsed = $scope.parseTrackRouting(ravennaCometdService.data.medias);
        return angular.equals($scope.local, $scope.server)  &&  angular.equals($scope.map, parsed.map)  && $scope.media == parsed.media;
    };
    
    $scope.parseLocalSdp = function() {
        $scope.local.parsedSdp = {};
        try {
            $scope.local.parsedSdp = sdpParser.parse($scope.local.destination.sdp);
            $scope.streamClass = streamClassify.detect($scope.local.parsedSdp);
        }
        catch (e) {}
        
        var doAutoSelect = ($scope.map.length == 0); // mind if any channels were set already 
        updateChannelMapFromSDP(); // update everyting to match the SDP content
        if ($scope.local.parsedSdp  &&  doAutoSelect) // now auto-select channels (if needed)
            autoSelectTracks();
        
        $scope.channelCount = $scope.map.length;
        $scope.isMapLinked = rv.controllers.session.evalMapLinked($scope.map);
    };
    
    // if the local source has changed we try to resolve the SDP for that 
    $scope.$watch('local.destination.uri', function() {
        if ($scope.local.destination.uri != $scope.server.destination.uri) {
            $scope.local.destination.sdp = '';
            
            if ($scope.local.destination.uri.length > 0) {
                ravennaSessionsService.resolveSession($scope.local.destination.uri, function(sdp) { 
                    $scope.$evalAsync(function() {
                        $scope.local.destination.sdp = sdp;
                        $scope.parseLocalSdp();
                    });
                });        
            }
        }
        else //if ($scope.local.destination.uri == $scope.server.destination.uri)
            $scope.local.destination.sdp = $scope.server.destination.sdp
        
        $scope.parseLocalSdp();
    });
    
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
    var reset = function() {
        $scope.local = angular.copy($scope.server);
        
        var res = $scope.parseTrackRouting(ravennaCometdService.data.medias);
        $scope.map = res.map;
        $scope.media = res.media == '' ? $scope.media = ravennaMediasService.getDefaultOutputMedia() : res.media;
        
        $scope.parseLocalSdp();
    };
    reset();
};
rv.controllers.editDestination.$inject = ['$scope', 'ravennaCometdService', 'ravennaMediasService', 'sdpParser', 'streamClassify', 'ravennaSessionsService'];

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
        $scope.$apply($scope, function() {
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
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.destination.rtcp.$inject = ['$scope', 'ravennaCometdService'];


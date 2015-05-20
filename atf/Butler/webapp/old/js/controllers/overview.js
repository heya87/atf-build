// all destinations
rv.controllers.destinations = function($scope, ravennaCometdService) {
    // all destinations
    $scope.destinations = [];
    
    $scope.scrollLimit = 40;    
    $scope.addItems = function() {
        if ($scope.scrollLimit < $scope.destinations.length)
            $scope.scrollLimit += 20;
    };
    
    // adds a new session destination
    // temprorarily add a command listener to wait for the 'created' message from the server with the new id
    $scope.addDestination = function() {
        var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
            if (message.data.command == 'create') {
                ravennaCometdService.unsubscribe(s);
                window.location.href = '/#/destination/' + message.data.result;
            }
        });        
        $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
        ravennaCometdService.command({path: '$.streaming.sessions.destinations', command: 'create'});
    };
    
    $scope.reset = function(ddestinations) {
        var destinations = [];
        angular.forEach(ddestinations, function(s, k) { if (k != "SCHEMA") destinations.push(k); });
        
        if (!angular.equals($scope.destinations, destinations))
            $scope.$apply(function() { $scope.destinations = destinations; });
    };

    $scope.updateDestinations = function() { $scope.reset(ravennaCometdService.data.streaming.sessions.destinations); };
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  && data.streaming.sessions  &&  data.streaming.sessions.destinations;
        },
        function(data) { // apply function
            $scope.updateDestinations();
        }));
    var removeListener = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'remove') {
            $scope.updateDestinations();
        }
    });        
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); }); ravennaCometdService.unsubscribe(removeListener); });
};
rv.controllers.destinations.$inject = ['$scope', 'ravennaCometdService'];

// a single sink in the overview
// @requires 'id' must be set in the scope
rv.controllers.ovdestination = function($scope, ravennaCometdService, ravennaIONamesService, sdpParser) {
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

    // local media and map
    $scope.media = "";
    $scope.map = [];
    $scope.outputTracks = [];
    
    // pre-formatted map of outputs
    $scope.formattedMap = "";
    
    // map with warnings that should be reflected in the UI
    $scope.warnings = {lost: 0};
    
    // the unchanged server session data
    $scope.server = angular.copy(empty);
    
    // the local (possibly changed) session data
    $scope.local = angular.copy(empty);

    // updates the pre-formatted map
    $scope.updateFormattedMap = function() {
        if (!$scope.media)
            return;

        var map = []
        var count = 0;
        angular.forEach(ravennaCometdService.data.medias, function(media, media_key) {
            angular.forEach(media.outputs, function(track, track_key) {
                var inRouting = track.in;
                var j = inRouting.indexOf('/');
                if (inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                    var channel = parseInt(inRouting.substr($scope.id.length + 1));
                    map[channel] = /* media_key + "/" + */ track.labels.user;
                }
            });
        });
        var formattedMap = map.join(", ");
        
        if (count > 2)
            formattedMap += ' ...';
            
        $scope.formattedMap = formattedMap;
    };

    $scope.parseTrackRouting = function(medias) {
        var res = {media: "", map: []};
        angular.forEach(medias, function(media, media_key) {
            if (media.configured) {
                angular.forEach(media.outputs, function(track, track_key) {
                    var inRouting = track.in;
                    if (inRouting  &&  inRouting.indexOf($scope.id) == 0  &&  inRouting[$scope.id.length] == '/') {
                        var channel = parseInt(inRouting.substr($scope.id.length + 1));
                        res.media = media_key;
                        res.map[channel] = parseInt(track_key);
                    }
                });
            }
        });
        return res;
    };
    
    // removes this sink
    // note: the sink is not actually removed here - just a request to the server is sent
    $scope.remove = function() {
        ravennaCometdService.command({path: '$.streaming.sessions.destinations.' + $scope.id, command: 'remove'}, 
                                     {onComplete: function() {setTimeout($scope.updateDestinations, 100);}});
    };
    
    // resets the local copy of the server data
    $scope.reset = function() {
        $scope.server.parsedSdp = sdpParser.parse($scope.server.destination.sdp);
        $scope.local = angular.copy($scope.server);
        
        var res = $scope.parseTrackRouting(ravennaCometdService.data.medias);
        if (res.media) {
            $scope.media = res.media;   
            $scope.map = res.map;
            $scope.outputTracks = ravennaCometdService.data.medias[res.media].outputs;
        }
    };
    
    // saves the local source to the server
    $scope.saveSource = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.streaming.sessions.destinations.' + $scope.id + ".uri", value: $scope.local.uri}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();})}});
    };

    // settings listeners
    var listeners = [];
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
            return data.streaming  &&  data.streaming.streams  &&  data.streaming.streams.receivers  &&  data.streaming.streams.receivers[$scope.id]  &&  !angular.equals(data.streaming.streams.receivers[$scope.id], $scope.server.receiver);
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
}

// updates the discovered sources on a single destination
rv.controllers.ovdestinationsd = function($scope, ravennaCometdService, ravennaIONamesService, sdpParser) {
    var update = false;
    $scope.discoveredSessions = '';
    
    // updates $scope.discoveredSessions when called
    $scope.updateDiscoveredSessions = function() {
        ravennaCometdService.command({command: 'listSessions'});
        update = true;
    };   
    
    var listeners = [];
    // commands listener
    listeners.push(ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        // list all sessions
        if (message.data.command == 'listSessions') {
            $scope.$apply(function() {
                if (update)
                    $scope.discoveredSessions = message.data.result;
                update = false;
            });
        }
        // update any resolved sessions in our map
        if (message.data.command == 'resolveSession') {
            if (message.data.result.uri == $scope.local.uri)
                $scope.$apply(function() { 
                    $scope.local.sdp = message.data.result.sdp;
                    $scope.local.parsedSdp = sdpParser.parse($scope.local.sdp);
                    updateChannelMapFromSDP();
                });
        }
    }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
}

// sets the $scope.local.io variable to the first configured io
function setDefaultIO($scope) {
    if ($scope.media == ''  &&  $scope.ioNames  &&  $scope.ioNames.length > 0)
        $scope.media = $scope.ioNames[0];
}

// all sources
rv.controllers.sources = function($scope, ravennaCometdService) {
    // all sources
    $scope.sources = [];
    
    // adds a new session source
    // temprorarily add a command listener to wait for the 'created' message from the server with the new id
    $scope.addSource = function() {
        var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
            if (message.data.command == 'create') {
                ravennaCometdService.unsubscribe(s);
                window.location.href = '/#/source/' + message.data.result;
            }
        });        
        $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); })
        ravennaCometdService.command({path: '$.streaming.sessions.sources', command: 'create'});
    };

    $scope.scrollLimit = 40;    
    $scope.addItems = function() {
        if ($scope.scrollLimit < $scope.sources.length)
            $scope.scrollLimit += 20;
    };
    
    $scope.reset = function(dsources) {
        var sources = [];
        angular.forEach(dsources, function(s, k) { if (k != "SCHEMA") sources.push(k); });
        
        if (!angular.equals($scope.sources, sources))
            $scope.$apply(function() { $scope.sources = sources; });
    };

    $scope.updateSources = function() { $scope.reset(ravennaCometdService.data.streaming.sessions.sources); };
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions &&  data.streaming.sessions.sources;
        },
        function(data) { // apply function
            $scope.updateSources();
        }));
    var removeListener = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'remove') {
            $scope.updateSources();
        }
    });        
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); }); ravennaCometdService.unsubscribe(removeListener); });
};
rv.controllers.sources.$inject = ['$scope', 'ravennaCometdService'];

// a single source in the overview
// @requires the scope member 'id' must be set
rv.controllers.ovsource = function($scope, ravennaCometdService, ravennaIONamesService) {
    var empty = {
        source: {
            name: '',
        },
        sender: {
            address: 'auto',
            address_allocated: '',
            port: 5004,
            ttl: 1,
            localAddress: '',
            dscp: 0x2e,
            payload: 98,
            state: 0,
            codec: 'L24',
            codecParameters: {
                frameSize: 64,
                frameSize_OPTIONS: [64, 128, 256]
            }
        }
    };
    
    // the current server data
    $scope.server = empty;
    
    // formatted inputs
    $scope.formattedMap = "";

    // parsed media and maps
    $scope.media = "";
    $scope.map = [];
    $scope.outputTracks = [];

    // map with warnings that should be reflected in the UI
    $scope.warnings = {lost: 0};
    
    $scope.scrollLimit = 40;    
    $scope.addItems = function() {
        console.log("scrollLimit " + $scope.scrollLimit);
        if ($scope.scrollLimit < $scope.sources.length)
            $scope.scrollLimit += 10;
    };
    
    // removes this session source
    // note: the sink is not actually removed here - just a request to server is sent
    $scope.remove = function() {
        ravennaCometdService.command({path: '$.streaming.sessions.sources.' + $scope.id, command: 'remove'},
            {onComplete: function() {setTimeout($scope.updateSources, 100);}});
    };
    
    // updates the pre-formatted map
    $scope.updateFormattedMap = function() { 
        var source = ravennaCometdService.data.streaming.sessions.sources[$scope.id];
        var sender = ravennaCometdService.data.streaming.streams.senders[$scope.id];
        if (!ravennaCometdService.data.medias[$scope.media])
            return;
        var inputs = ravennaCometdService.data.medias[$scope.media].inputs;
        var formattedMap = "";
        for (var i = 0; i < $scope.map.length  &&  i < 2; ++i) {
            if (i > 0)
                formattedMap += ', ';
            var key = '' + $scope.map[i];
            var track = inputs[key];
            if (track) {
                var userLabel = track.labels  &&  track.labels.user ? track.labels.user : '(Track ' + key + ')';
                formattedMap += userLabel;
            }
            else
                formattedMap += " - ";
        }
        if ($scope.map.length > 2)
            formattedMap += ' ... (' + map.length + ')';
            
        $scope.formattedMap = formattedMap;
    };
    
    // resets all local data with the server side data
    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);

        // parse map
        $scope.map = [];
        if ($scope.server.sender  &&  $scope.server.sender.map) {
            $scope.channelCount = $scope.server.sender.map.length;
            for (var i = 0; i < $scope.server.sender.map.length; ++ i) {
                var entry = $scope.server.sender.map[i];
                var j = entry.indexOf('/');
                $scope.media = entry.substr(0, j);
                $scope.map.push(parseInt(entry.substr(j + 1)));
            }
            $scope.isMapLinked = rv.controllers.session.evalMapLinked($scope.map);
            $scope.outputTracks = ravennaCometdService.data.medias[$scope.media].outputs;
        }
    };

    // settings listener
    var delayedUpdate, delayedUpdate2;
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.sources  &&  data.streaming.sessions.sources[$scope.id]   &&  !angular.equals(data.streaming.sessions.sources[$scope.id], $scope.server.source);
        },
        function(data) { // apply function
            $scope.$evalAsync(function() {
                $scope.server.source = data.streaming.sessions.sources[$scope.id];
                $scope.reset();
            });
        }));
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.streams  &&  data.streaming.streams.senders  &&  data.streaming.streams.senders[$scope.id]   &&  !angular.equals(data.streaming.streams.senders[$scope.id], $scope.server.sender);
        },
        function(data) { // apply function
            $scope.$evalAsync(function() {
                $scope.server.sender = data.streaming.streams.senders[$scope.id];
                $scope.reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
}    


// a single source
// @requires the scope member 'id' must be set
rv.controllers.source = function($scope, ravennaCometdService, ravennaIONamesService, presetHandler, $routeParams) {
    if ($routeParams  &&  $routeParams.id)
        $scope.id = $routeParams.id;
    
    $scope.presetHandler = presetHandler;
    
    var empty = {
        source: {
            id: "",
            name: '',
            senders: ""
        },
        sender: {
            address: '0.0.0.0',
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
            }
        }
    };
    
    // DSCP values for sources
    $scope.dscps = [{value: 46, label: "46 (EF)"}, {value: 34, label: "34 (AF41)"}, {value: 26, label: "26 (AF31)"}, {value: 0, label: "0 (BE)"}];
    
    // local copy of the server data 
    $scope.server = angular.copy(empty);
    
    // local working copy of the data
    $scope.local = angular.copy(empty);
    
    // if true the form is disabled
    $scope.disabled = true;
    
    // channel count - used to updated the size of the map accordingly
    $scope.channelCount = 0;
    
    // if true, then the channel map is handled as a single block
    $scope.isMapLinked = true;
    
    // local media and map
    $scope.media = "";
    $scope.map = [];
    
    // the inputs of the currently selected IO - updated every time the IO changes
    $scope.inputs = [];
    //$scope.xxx = [{id:1, text:"a"}, {id:2, text:"b"}]
    
    // array linked inputs
    $scope.linkedIns = [];
    
    // map with warnings that should be reflected in the UI
    $scope.warnings = {lost: 0};
    
    // the current preset
    $scope.currentPreset = '-';
    
    // updates $scope.ioNames whenever configured IOs change
    ravennaIONamesService.addInsListener($scope, function(ios) { $scope.$apply(function() { $scope.ioNames = ios; }); });
    
    // update linkedIns
    var updateLinkedIns = function() {
        $scope.linkedIns = [];
        if ($scope.local  &&  $scope.local.sender  &&  ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media]  &&  $scope.channelCount > 0) { 
                for (var i = 0; i < $scope.inputs.length - $scope.channelCount + 1; ++ i) {
                    var arr = [];
                    for (var j = 0; j < $scope.channelCount; ++ j)
                        arr.push(i + j);
                    $scope.linkedIns[i] = arr;
                }
            }
        }
    };
    
    // the inputs of the currently selected source + the codec capabilities - updated every time the IO changes
    var updateIns = function() { 
        $scope.inputs = [];
        if (ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media]) {
                $scope.inputs = rv.helpers.formatInsOuts(ravennaCometdService.data.medias[$scope.media].inputs, $scope.id);
                $scope.codecs = ravennaCometdService.data.medias[$scope.media].capabilities.codec;
            }
        }
        
        updateLinkedIns();        
    };
    
    $scope.$watch('channelCount', function() { if ($scope.local.sender) rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateLinkedIns(); });
    $scope.$watch('isMapLinked', function() { updateLinkedIns(); if ($scope.local.sender) rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });
    $scope.$watch('media', updateIns);
    $scope.$watch('map', function() { $scope.channelCount = $scope.map.length; });
    $scope.$watch('map[0]', function() { if ($scope.local.sender) rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); });

    // returns the packet size in bytes 
    var codecSizes = {'L16': 2, 'L24': 3, 'L32': 4, 'AM824': 4};
    $scope.packetSize = function() {
        if ($scope.local  &&  $scope.local.sender) {
            var codec = $scope.local.sender.codec; 
            return codecSizes[codec] * $scope.local.sender.codecParameters.frameSize * $scope.channelCount;
        }
        return 0;
    };
    
     $scope.setPreset = function(preset) {
         $scope.presetHandler.set(preset, $scope, $scope.local.sender);
         $scope.currentPreset = preset;
     };
    
     $scope.detectPreset = function() {
         return $scope.presetHandler.detect2($scope, $scope.local.sender);
     };
    
    // @return true if the local copy is not changed
    $scope.isClean = function() {
        var parsed = $scope.parseMap($scope.server.sender.map);
        return angular.equals($scope.local, $scope.server)  &&  angular.equals($scope.map, parsed.map)  && $scope.media == parsed.media;
    };

    // saves the session source to the server
    $scope.save = function() {
        $scope.disabled = true;
        
        // multicast address parsing - we expect: <multicast-address>[:<port>][/<ttl>]
        if (!($scope.local.sender.address === undefined)  &&  $scope.local.sender.address != "auto") {
            var strs = $scope.local.sender.address.split($scope.ipAddressPortTTLPattern);
            var streams = angular.copy($scope.local.streams);
            $scope.local.sender.address = strs[1];
            if (strs[5])
                $scope.local.sender.port = parseInt(strs[5]);
            else
                delete $scope.local.sender.port;
            if (strs[7])
                $scope.local.sender.ttl = parseInt(strs[7]);
            else
                delete $scope.local.sender.ttl;
        }
        else
            $scope.local.sender.address = "auto";
        
        // build map
        $scope.local.sender.map = [];
        for (var i = 0; i < $scope.map.length; ++ i)
            $scope.local.sender.map.push($scope.media + "/" + $scope.map[i]);
        
        ravennaCometdService.publish({path: '$.streaming.sessions.sources.' + $scope.id, 
                value: $scope.local.source,
                onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
        ravennaCometdService.publish({path: '$.streaming.streams.senders.' + $scope.id, 
                value: $scope.local.sender,
                onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
    };

    $scope.parseMap = function(map) {
        var res = {media: "", map: []};
        for (var i = 0; i < map.length; ++ i) {
            var entry = map[i];
            var j = entry.indexOf('/');
            res.media = entry.substr(0, j);
            res.map.push(parseInt(entry.substr(j + 1)));
        }
        return res;
    };
    
    // resets all local data with the server side data
    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);

        if ($scope.server.sender  &&  $scope.server.sender.map) {
            var parsed = $scope.parseMap($scope.server.sender.map);
            $scope.media = parsed.media;
            $scope.map = parsed.map;
            $scope.channelCount = $scope.map.length;
        }

        $scope.isMapLinked = rv.controllers.session.evalMapLinked($scope.map);
        
        setDefaultIO($scope);

        // multicast address mangling: append port/ttl to address field shown in the UI (if set)
        if ($scope.local.sender) {
            if ($scope.local.sender.port  &&  $scope.local.sender.port != 5004) // default RTP port is 5004
                $scope.local.sender.address += ":" + $scope.local.sender.port;
            if ($scope.local.sender.ttl  &&  $scope.local.sender.ttl != 1)
                $scope.local.sender.address += "/" + $scope.local.sender.ttl;
        }
                
        // select default preset
        if ($scope.server.sender.map  &&  $scope.server.sender.map.length == 0) {
            $scope.setPreset('ravStereo');
        }
        else
            $scope.currentPreset = $scope.detectPreset();
                
        $scope.disabled = false;
    };
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return (data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.sources);
        },
        function(data) { // apply function
            $scope.$apply(updateIns);
        }));
    // settings listeners
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.sources[$scope.id]   &&  !angular.equals(data.streaming.sessions.sources[$scope.id], $scope.server.source);
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
};
rv.controllers.source.$inject = ['$scope', 'ravennaCometdService', 'ravennaIONamesService', 'presetHandler', '$routeParams'];

// the source RTCP status and graphs
rv.controllers.source.rtcp = function($scope, ravennaCometdService) {
    // RTCP status
    $scope.status = {};
    
    // jitter graph: pairs of index/jitter
    $scope.jitter = [];
    
    // lost graph: pairs of index/jitter
    $scope.lost = [];
    
    // status messages listener
    var s = ravennaCometdService.subscribe('/ravenna/stream/streaming/streams/senders/' + $scope.id, function(message) {
        var v = message.data;
        $scope.$apply(function() {
            $scope.status = v;
            
            function updateGraph(allArrays, cname, value) {
                // get/create the graph object with proper label
                var graph;
                angular.forEach(allArrays, function(e) { if (e.label == cname) graph = e;});
                if (!graph) {
                    graph = {label: cname, data: []};
                    allArrays.push(graph);
                }

                var arr = graph.data;
                while (arr.length < $scope.graphLength)
                    arr.push([]);
                
                arr.push([0, value]);
                if (arr.length > $scope.graphLength)
                    arr.splice(0, arr.length - $scope.graphLength);
                
                angular.forEach(arr, function(e, i) { e[0] = i; });
            }
            
            // pudate jitter and lost graph data
            $scope.warnings.lost = 0;
            angular.forEach(v, function(e, cname) {
                updateGraph($scope.jitter, cname, e.jitter)
                updateGraph($scope.lost, cname, e.lost)

                if ($scope.warnings.lost > 0)
                    $scope.warnings.lost --;
                if (e.lost > 0)
                    $scope.warnings.lost = 2;
            });
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.source.rtcp.$inject = ['$scope', 'ravennaCometdService'];


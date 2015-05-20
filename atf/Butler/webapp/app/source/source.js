// a single source
// @requires the scope member 'id' must be set
rv.controllers.source = function($scope, $modal, $debounce, ravennaCometdService, ravennaSessionsService, ravennaMediasService) {
    // DSCP values for sources
    $scope.dscps = [{value: 46, label: "46 (EF)"}, {value: 34, label: "34 (AF41)"}, {value: 26, label: "26 (AF31)"}, {value: 0, label: "0 (BE)"}];
    
    // init local copy of the server data 
    $scope.server = ravennaSessionsService.getEmptySource();

    // parsed tracks and labels that are currently assigned to this source
    $scope.tracks = [];
    $scope.trackLabels = [];

    var getTracks = function() {
        $scope.tracks = $scope.server.sender.map;
        
        $scope.trackLabels = [];
        $scope.rev_trackLabels = {};
        for (var i = 0; i < $scope.tracks.length; ++ i) {
            var label = ravennaMediasService.getInputSourceLabel($scope.tracks[i]);
            $scope.trackLabels[i] = label;
        }
    };
    
    // removes this source (note: the source is not actually removed here - just a request to the server is sent)
    $scope.remove = function() {
        var modalInstance = $modal.open({
            templateUrl: 'app/source/removeSource.html',
            scope: $scope.$new()
        });

        modalInstance.result.then(function(changes) {
                ravennaCometdService.command({path: '$.streaming.sessions.sources.' + $scope.id, command: 'remove'});
            }, function () {});
    };
    
    $scope.editSource = function() {
        var child = $scope.$new();
        var modalInstance = $modal.open({
            templateUrl: 'app/source/sourceProperties.html',
            scope: child,
            controller: rv.controllers.editSource
        });

        modalInstance.result.then(function(changes) {
                ravennaSessionsService.saveSource($scope.id, changes);
            }, function () {
        });
    };

    var init1 = function() {
        $scope.server.source = ravennaCometdService.data.streaming.sessions.sources[$scope.id];
    };
    var init2 = function() {
        $scope.server.sender = ravennaCometdService.data.streaming.streams.senders[$scope.id];
        getTracks();
    };

    var listeners = [];
    // settings listeners
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions  &&  data.streaming.sessions.sources
                &&  data.streaming.sessions.sources[$scope.id]   &&  !angular.equals(data.streaming.sessions.sources[$scope.id], $scope.server.source);
        },
        function(data) { // apply function
            $debounce(init1, 200);
        }));
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.streams  &&  data.streaming.streams.senders  
                &&  data.streaming.streams.senders[$scope.id]   &&  !angular.equals(data.streaming.streams.senders[$scope.id], $scope.server.sender);
        },
        function(data) { // apply function
            $debounce(init2, 200);
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
};
rv.controllers.source.$inject = ['$scope', '$modal', '$debounce', 'ravennaCometdService', 'ravennaSessionsService', 'ravennaMediasService'];

// an editable source - must be a child scope of a non editable source
// @requires the scope member 'id' must be set
rv.controllers.editSource = function($scope, streamPresets, ravennaCometdService, ravennaMediasService) {
    $scope.streamPresets = streamPresets;
    
    var parseMap = function(map) {
        var res = {media: "", map: []};
        for (var i = 0; i < map.length; ++ i) {
            var entry = map[i];
            var j = entry.indexOf('/');
            res.media = entry.substr(0, j);
            res.map.push(parseInt(entry.substr(j + 1)));
        }
        return res;
    };

    // build map
    var updateMap = function() {
        $scope.local.sender.map = [];
        for (var i = 0; i < $scope.map.length; ++ i)
            $scope.local.sender.map.push($scope.media + "/" + $scope.map[i]);
    };
    
    // update linkedIns
    var updateLinkedIns = function() {
        $scope.linkedIns = [];
        $scope.linkedInsLabels = [];
        if ($scope.local  &&  $scope.local.sender  &&  ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media]  &&  $scope.channelCount > 0) { 
                for (var i = 0; i < $scope.inputs.length - $scope.channelCount + 1; ++ i) {
                    var arr = [];
                    var larr = [];
                    for (var j = 0; j < $scope.channelCount; ++ j) {
                        arr.push(i + j);
                        larr.push($scope.inputs[i + j]);
                     }
                    $scope.linkedIns[i] = arr;
                    $scope.linkedInsLabels[i] = larr.join(', ');
                }
            }
        }
    };
     
     // the inputs of the currently selected source + the codec capabilities - updated every time the IO changes
    var updateIns = function() { 
        $scope.inputs = [];
        $scope.inputIndices = [];
        if (ravennaCometdService.data.medias) {
            if (ravennaCometdService.data.medias[$scope.media]) {
                $scope.inputs = []; // rv.helpers.formatInsOuts(ravennaCometdService.data.medias[$scope.media].inputs, $scope.id);
                for (var i = 0; ravennaCometdService.data.medias[$scope.media].inputs[i.toString()]; ++ i) {
                    var track = $scope.media + "/" + i;
                    $scope.inputs.push(ravennaMediasService.getInputSourceLabel(track));
                    $scope.inputIndices[i] = i;
                };
                
                $scope.codecs = ravennaCometdService.data.medias[$scope.media].capabilities.codec;
            }
        }
         
        updateLinkedIns();        
    };
     
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
        if ($scope.currentPreset != preset) {
            $scope.streamPresets.set(preset, $scope, $scope.local.sender);
            $scope.currentPreset = preset;
        }
    };
     
    // @return true if the local copy is not changed
    $scope.isClean = function() {
        var parsed = parseMap($scope.server.sender.map);
        return angular.equals($scope.local, $scope.server)  &&  angular.equals($scope.map, parsed.map)  && $scope.media == parsed.media;
    };    
    
    // local working copy of the data
    $scope.local = angular.copy($scope.server); // copy from parent

    // array linked inputs
    $scope.linkedIns = [];
    $scope.linkedInsLabels = [];
    
    // the current preset
    $scope.currentPreset = '-';

    // the inputs of the currently selected IO - updated every time the IO changes
    $scope.medias = ravennaMediasService.getInputMedias(true);
    $scope.inputs = [];
    $scope.inputIndices = [];
    
    var parsed = parseMap($scope.local.sender.map);
    $scope.media = parsed.media == '' ? ravennaMediasService.getDefaultInputMedia() : parsed.media;
    if (!angular.equals($scope.map, parsed.map))
        $scope.map = parsed.map;
    $scope.channelCount = $scope.map.length;
     
    $scope.isMapLinked = rv.controllers.session.evalMapLinked($scope.map);
     
    // multicast address mangling: append port/ttl to address field shown in the UI (if set)
    if ($scope.local.sender.port  &&  $scope.local.sender.port != 5004) // default RTP port is 5004
        $scope.local.sender.address += ":" + $scope.local.sender.port;
    if ($scope.local.sender.ttl  &&  $scope.local.sender.ttl != 1)
        $scope.local.sender.address += "/" + $scope.local.sender.ttl;
     
    // select default preset
    if ($scope.server.sender.map  &&  $scope.server.sender.map.length == 0)
        $scope.setPreset('ravStereo');
    else
        $scope.currentPreset = streamPresets.detect($scope.local.sender);

    $scope.$watch('channelCount', function() { rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateLinkedIns(); updateMap(); });
    $scope.$watch('isMapLinked', function() { updateLinkedIns(); rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateMap(); });
    $scope.$watch('media', function() { updateIns(); updateMap(); });
    $scope.$watch('map', function() { updateMap(); }, true);
    $scope.$watch('map[0]', function() { rv.controllers.session.updateMap($scope.map, $scope.channelCount, $scope.isMapLinked); updateMap(); });
};
rv.controllers.editSource.$inject = ['$scope', 'streamPresets', 'ravennaCometdService', 'ravennaMediasService'];

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
            angular.forEach(v, function(e, cname) {
                updateGraph($scope.jitter, cname, e.jitter)
                updateGraph($scope.lost, cname, e.lost)
            });
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.source.rtcp.$inject = ['$scope', 'ravennaCometdService'];


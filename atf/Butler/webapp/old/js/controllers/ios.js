rv.controllers.medias_helper = {};
rv.controllers.medias_helper.medias = function($scope, ravennaCometdService) {
    var medias = [];
    angular.forEach(ravennaCometdService.data.medias, function(k, name) { 
        if (name == 'SCHEMA')
            return;
        
        if ((name.substr(0, 9) != 'Generator'  &&  name.substr(0, 8) != 'Analyzer')  ||  $scope.expertMode[0]) 
            medias.push(name); 
    });
    return medias;
};

// all IOs
rv.controllers.medias = function($scope, ravennaCometdService) {
    // all IO names
    $scope._medias = [];
    
    // workaround for chrome bug, where the '%' in the hash part of the URI causes problems with 'go back' 
    $scope.encodeIOName = function(ioName) {
        return encodeURIComponent(ioName).replace(/%/gi, '~');
    };

    // return all IOs only if in expert mode, otherwise do not return the Generators and Analyzers
    $scope.medias = function() { return rv.controllers.medias_helper.medias($scope, ravennaCometdService); };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias;
        },
        function(data) { // apply function - collect all IO names
            $scope.$apply(function() {
                var x = [];
                angular.forEach(data.medias, function(v, k) { x.push(k); });
                $scope._medias = x;
            });
        }));

    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.medias.$inject = ['$scope', 'ravennaCometdService'];

// a single IO
// note: the scope member 'ioName' must be set to the actual IO name
rv.controllers.media = function($scope, ravennaCometdService, $routeParams) {
    $scope.decodeIOName = function(ioName) {
        return decodeURIComponent(ioName.replace(/~/gi, '%'));
    }
    
    if ($routeParams  &&  $routeParams.ioName)
        $scope.ioName = $scope.decodeIOName($routeParams.ioName);
    
    // server data
    $scope.server = {
        capabilities: {
            audioBlockSize: [32, 64, 128],
            sampleRate: [44100, 48000],
            channelCountCapture: 8,
            channelCountPlay: 8
        },
        configuration: {
            audioBlockSize: 64,
            sampleRate: 48000,
            channelCountCapture: 8,
            channelCountPlay: 8,
            vcxo: 0
        },
        inputs: {},
        outputs: {},
        configured: true
    };
    
    // local (possibly modified) data 
    $scope.local = angular.copy($scope.server);
    
    // if true, then this device is in use by some active session
    $scope.inUse = true;
    var updateInUse = function(streams) {
        $scope.inUse = false;
        if (streams &&  streams.senders)
            angular.forEach(streams.senders, function(value, key) { if (key == 'SCHEMA') return; if (value.medias == $scope.ioName) { $scope.inUse = true; }});
        if (streams &&  streams.receivers)
            angular.forEach(streams.receivers, function(value, key) { if (key == 'SCHEMA') return; if (value.medias == $scope.ioName) { $scope.inUse = true; }});
    };
    
    // all controlls are disbled if true
    $scope.disabled = true;
    
    // returns true if there are no changes to the local copy
    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.server);
    };
    
    // allocates and configures the audio device
    $scope.allocate = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.medias.' + $scope.ioName, value: {configuration: $scope.local.configuration, configured: true}}, {
            onError: function(message) { $scope.reset(); }
        });
    };
    
    // releases the audio device
    $scope.release = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.medias.' + $scope.ioName, value: {configured: false}}, {
            onError: function(message) { $scope.reset(); }
        });
    };
    
    // saves changes to the server
    $scope.save = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.medias.' + $scope.ioName + ".inputs", value: $scope.local.inputs}, {
            onError: function(message) { $scope.reset(); }
        });
        ravennaCometdService.publish({path: '$.medias.' + $scope.ioName + ".outputs", value: $scope.local.outputs}, {
            onError: function(message) { $scope.reset(); }
        });
    };
    
    // resets the local copy
    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);
        if (!$scope.server.configured  &&  !$scope.editing) { // if not configured and not editing we init the channel counts from the capabilities
            $scope.local.configuration.channelCountCapture = $scope.server.capabilities.channelCountCapture;
            $scope.local.configuration.channelCountPlay = $scope.server.capabilities.channelCountPlay;
        }
        
        if ($scope.server.configured)
            $scope.editing = false;
        
        $scope.disabled = false;
    };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias  &&  data.medias[$scope.ioName];
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server = data.medias[$scope.ioName];
                updateInUse(data.streaming.streams);
                $scope.reset();
            });
        }));
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            // TODO improve test - only return true if a channel map has changed
            return data.streaming  &&  data.streaming.streams  &&  (data.streaming.streams.senders  ||  data.streaming.sessions.receivers);
        },
        function(data) { // apply function
            $scope.$apply(function() {
                updateInUse(data.streaming.streams);
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
    
    // commands listener
    var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'remove')
            $scope.$apply(function() {
                updateInUse(ravennaCometdService.data.streaming.streams);
            });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.medias.$inject = ['$scope', 'ravennaCometdService', '$routeParams'];

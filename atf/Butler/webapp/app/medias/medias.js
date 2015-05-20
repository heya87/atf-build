// all IOs
rv.controllers.medias = function($scope, $debounce, ravennaCometdService) {
    // a function that returns all current medias
    var reset = function() {
        var mediaNames = [];
        angular.forEach(ravennaCometdService.data.medias, function(k, name) { 
            if (name == 'SCHEMA')
                return;
            if ((name.substr(0, 9) != 'Generator'  &&  name.substr(0, 8) != 'Analyzer')  ||  $scope.expertMode[0]) 
                mediaNames.push(name); 
        });
        
        $scope.mediaNames = mediaNames;
    };

    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias;
        },
        function(data) { // apply function - collect all IO names
            $debounce(reset, 200);
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.medias.$inject = ['$scope', '$debounce', 'ravennaCometdService'];

// a single IO
// note: the scope member 'mediaName' must be set to the actual IO name
rv.controllers.media = function($scope, $modal, $debounce, ravennaCometdService) {
    // server data
    $scope.server = {
        capabilities: {
            _applySettingsOnTheFly: false, // if this is true, then sync/sample rate settings can be applied at any time
            audioBlockSize: [32, 64, 128],
            sampleRate: [44100, 48000],
            channelCountCapture: 8,
            channelCountPlay: 8
        },
        configuration: {
            audioBlockSize: 64,
            sampleRate: 48000,
            channelCountCapture: 8,
            channelCountPlay: 8
        },
        sync: '', // 'internal', 'wordClock', 'PTP', 'raLink'
        inputs: {},
        outputs: {},
        configured: false
    };
    $scope.syncSources = ['internal', 'wordClock', 'PTP', 'raLink'];
    
    $scope.editProperties = function(size) {
        var child = $scope.$new();
        var modalInstance = $modal.open({
            templateUrl: 'app/medias/mediaProperties.html',
            controller: rv.controllers.editMedia,
            scope: child
        });

        modalInstance.result.then(function() {
            }, function () {
        });
    };
    
    $scope.editLabels = function(size) {
        var child = $scope.$new();
        var modalInstance = $modal.open({
            templateUrl: 'app/medias/mediaLabels.html',
            controller: rv.controllers.editMedia,
            scope: child
        });

        modalInstance.result.then(function() {
                saveLabels();
            }, function () {
                //$log.info('Modal dismissed at: ' + new Date());
        });
    };
    
    // resets the local copy
    var reset = function() {
        $scope.$evalAsync(function() {
            $scope.server = ravennaCometdService.data.medias[$scope.mediaName];
            $scope.server.capabilities._applySettingsOnTheFly = false; // TODO: hardcoded here right now

        });
    };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) {
            return data.medias  &&  data.medias[$scope.mediaName];
        },
        function(data) { // apply function
             $debounce(reset, 200);
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.media.$inject = ['$scope', '$modal', '$debounce', 'ravennaCometdService'];

// a single IO
// note: the scope member 'mediaName' must be set to the actual IO name
rv.controllers.editMedia = function($scope, ravennaCometdService) {
    // server data
    $scope.local = angular.copy($scope.server);
    if (!$scope.server.configured) { // if not configured and not editing we init the channel counts from the capabilities
        if ($scope.server.capabilities) {
            $scope.local.configuration.channelCountCapture = $scope.server.capabilities.channelCountCapture;
            $scope.local.configuration.channelCountPlay = $scope.server.capabilities.channelCountPlay;
        }
    }
    
    // returns true if there are no changes to the local copy
    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.server);
    };
    
    $scope.allowChangeSettings = function() {
        return $scope.expertMode[0]  &&  (!$scope.server.configured  ||  $scope.server.capabilities._applySettingsOnTheFly);
    };
    
    // if true, then this device is in use by some active session
    $scope.inUse = function() {
        var inUse = false;
        
        // check all senders if any is using this media
        var streams = ravennaCometdService.data.streaming.streams;
        if (streams &&  streams.senders)
            angular.forEach(streams.senders, function(sender, key) { 
                if (key == 'SCHEMA') return; 
                angular.forEach(sender.map, function(mapEntry) {
                    if (mapEntry.indexOf($scope.mediaName) == 0)
                        inUse = true;
                });
            });
        
        // check if this media is using any stream channel
        angular.forEach($scope.server.outputs, function(output, key) {
            if (key == 'SCHEMA') return; 
            if (output.in.length > 0)
                inUse = true;
        });
        
        return inUse;
    };
    
    // allocates and configures the audio device
    $scope.allocate = function() {
        var config = {
            configuration: $scope.local.configuration,
            configured: true
        };
        if ($scope.local.sync)
            config.sync = $scope.local.sync;
        
        ravennaCometdService.publish({path: '$.medias.' + $scope.mediaName, value: config}, {
            onError: function(message) { reset(); }
        });
        $scope.$dismiss();
    };
    
    $scope.release = function() {
        ravennaCometdService.publish({path: '$.medias.' + $scope.mediaName, value: {configured: false}}, {
            onError: function(message) { reset(); }
        });
    };
    
    // saves changes to the server
    $scope.save = function() {
        $scope.disabled = true;

        var config = { configuration: $scope.local.configuration };
        if ($scope.local.sync)
            config.sync = $scope.local.sync;
        
        ravennaCometdService.publish({path: '$.medias.' + $scope.mediaName, value: config}, {
            onSuccess: function() {reset();}, onError: function(message) {reset();}
        });
        $scope.$dismiss();
    };
        
    var saveLabels = function() {
        ravennaCometdService.publish({path: '$.medias.' + $scope.mediaName + ".inputs", value: $scope.local.inputs}, {
            onSuccess: function() {reset();}, onError: function(message) {reset();}
        });
        ravennaCometdService.publish({path: '$.medias.' + $scope.mediaName + ".outputs", value: $scope.local.outputs}, {
            onSuccess: function() {reset();}, onError: function(message) {reset();}
        });
        $scope.$dismiss();
    };
};
rv.controllers.editMedia.$inject = ['$scope', 'ravennaCometdService'];

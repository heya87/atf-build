//tools: processes that we support
rv.controllers.logProcesses = function($scope) {
    $scope.processes = ['butler', 'streamer'];
};
rv.controllers.logProcesses.$inject = ['$scope'];

// tools: debug levels, ...
// @requires 'process' must be set in the scope to either 'buter' or 'streamer'
rv.controllers.logging = function($scope, ravennaCometdService) {
    var empty = {
        categories: [],
    };
    $scope.server = angular.copy(empty);
    $scope.local = angular.copy(empty);
    $scope.logLevels = [{value: 600, label: 'Info'}, {value: 700, label: 'Debug'}, {value: 800, label: 'Trace'}, {value: 900, label: 'Not set'}];

    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.server);
    };

    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);
        $scope.disabled = false;
    };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data._logging  &&  data._logging[$scope.process];
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server.categories = [];
                angular.forEach(data._logging[$scope.process], function(value, key) { $scope.server.categories.push(key) });
                $scope.reset();
            });
        }));
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data._capabilities  ||  data.routing;
        },
        function(data) { // apply function
            if (data._capabilities)
                $scope._capabilities = data._capabilities;
            if (data.routing)
                $scope._capabilities.routing = true;
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.logging.$inject = ['$scope', 'ravennaCometdService'];

// a single log category/priority controller
// @requires 'process' must be set in the scope to either 'buter' or 'streamer'
// @requires 'category' must be set in the scope
rv.controllers.logCategory = function($scope, ravennaCometdService) {
    $scope.value = -1; // not set

    $scope.$watch('value', function() {
        if ($scope.value < 0)
            return;
        
        var v = {}; 
        v[$scope.category] = $scope.value;
        if ($scope.process == 'butler')
            ravennaCometdService.publish({path: '$._logging.butler', value: v});
        else if ($scope.process == 'streamer')
            ravennaCometdService.publish({path: '$._logging.streamer', value: v});
    });
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data._logging  &&  data._logging[$scope.process];
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.value = ravennaCometdService.data._logging[$scope.process][$scope.category];
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.logCategory.$inject = ['$scope', 'ravennaCometdService'];

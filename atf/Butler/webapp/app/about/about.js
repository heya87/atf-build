rv.controllers.about = function($scope, $modal, ravennaCometdService) {
    $scope.identity = {};
    
    // settings listener for buildnr and capabilities
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return (data.identity  &&  data.identity._version);
        },
        function(data) { // apply function
            if (data.identity)
                $scope._version = data.identity._version;
    }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
}
rv.controllers.about.$inject = ['$scope', '$modal', 'ravennaCometdService'];

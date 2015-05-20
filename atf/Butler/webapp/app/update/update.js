rv.controllers.update = function($scope, $location, ravennaCometdService) {
    // true while an update is active
    $scope.updateStatus = undefined;
    
    // the current update message
    $scope.updateMessage = "";
    
    // settings listener for buildnr and capabilities
    var listeners = [];
    listeners.push(ravennaCometdService.subscribe('/ravenna/stream/firmwareUpdate', function(message) {
        $scope.$apply(function() {
            $scope.updateStatus = message.data.status;
            
            switch (message.data.status) {
            case 0: // start of update
                $scope.updateMessage = message.data.message; break;
            case 1: // updating firmware
            case 3: // firmware update failed
                $scope.updateMessage += message.data.message; break;
            case 2: // firmware update successful
                window.setTimeout(function() { $scope.$apply(function() { $scope.$dismiss(); })}, 30 * 1000); break;
            }
        });
    }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.update.$inject = ['$scope', '$location', 'ravennaCometdService'];

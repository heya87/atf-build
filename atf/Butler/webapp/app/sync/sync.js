// the sync mode status
// most of the time the sync mode will be global for a complete node - this current implementation only supports that
rv.controllers.sync = function($scope, $modal, ravennaCometdService) {
    $scope.mediaName = '';
    $scope.server = {};
    $scope.server.sync = '';

    var reset = function() {
        var mediaNames = [];
        angular.forEach(ravennaCometdService.data.medias, function(k, name) { 
            if (name == 'SCHEMA')
                return;
            if ((name.substr(0, 9) != 'Generator'  &&  name.substr(0, 8) != 'Analyzer')  ||  $scope.expertMode[0]) 
                mediaNames.push(name); 
        });
        
        // use first audio interface where 'sync' is set - fall back to 'PTP' if nothing else has been configured
        $scope.mediaName = '';
        $scope.server.sync = 'PTP'; // init to PTP if not set otherwise
        for (var i = 0; i < mediaNames.length; ++ i) {
            if (ravennaCometdService.data.medias[mediaNames[i]].sync) {
                $scope.mediaName = mediaNames[i];
                $scope.server.sync = ravennaCometdService.data.medias[mediaNames[i]].sync;
                break;
            }
        }
    }
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) {
            return data.medias;
        },
        function(data) { // apply function
            $scope.$evalAsync(function() {
                reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.sync.$inject = ['$scope', '$modal', 'ravennaCometdService'];

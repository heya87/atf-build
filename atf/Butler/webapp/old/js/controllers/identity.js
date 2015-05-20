// node identity
rv.controllers.identity = function($scope, ravennaCometdService) {
    $scope.server = {
        company: '',
        product: '',
        serial: '',
        name: ''    
    };
    $scope.local = angular.copy($scope.server);
    $scope.disabled = true;

    $scope.onKeyPress = function(ev) {
        if (ev.keyCode == 13) {
            $scope.save(); 
            $scope.editing = false;
            ev.preventDefault();
        }
        else if (ev.keyCode == 27) {
            $scope.reset(); 
            $scope.editing = false;
            ev.preventDefault();
        }
    };
    
    $scope.isClean = function() {
        return angular.equals($scope.local.name, $scope.server.name);
    };
    
    $scope.save = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.identity.name', value: $scope.local.name}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
    };
    
    $scope.reset = function() {
        if (!angular.equals($scope.local, $scope.server)) {
            $scope.local = angular.copy($scope.server);
            $scope.disabled = false;
        }
    };
    
    // settings listener
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.identity;
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server = data.identity;
                $scope.reset();
            });
        });
};
rv.controllers.identity.$inject = ['$scope', 'ravennaCometdService'];

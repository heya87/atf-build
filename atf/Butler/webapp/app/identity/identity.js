// node identity
rv.controllers.identity = function($scope, $modal, ravennaCometdService) {
    $scope.server = {
        company: '',
        product: '',
        serial: '',
        name: '',
        role: ''
    };
    
    $scope.editIdentity = function() {
        var child = $scope.$new();
        child.local = angular.copy($scope.server);
        var modalInstance = $modal.open({
            templateUrl: 'app/identity/identityProperties.html',
            scope: child
        });

        modalInstance.result.then(function() {
                ravennaCometdService.publish({path: '$.identity.name', value: child.local.name}, {
                    onComplete: function(message) {},
                    onError: function(message) {}
                });
            }, function () {
        });
    };

    // settings listener
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.identity;
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server = data.identity;
            });
        });
};
rv.controllers.identity.$inject = ['$scope', '$modal', 'ravennaCometdService'];

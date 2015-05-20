rv.controllers.advanced = function($scope, $http) {
    $scope.processes = "";
    
    $scope.refresh = function() {
        $http({method: 'GET', url: '/top', params: {foobar: new Date().getTime()}}).success(function(data, status, headers, config) {
            $scope.processes = data;
        });
    }
    
    $scope.refresh();
};
rv.controllers.advanced.$inject = ['$scope', '$http'];

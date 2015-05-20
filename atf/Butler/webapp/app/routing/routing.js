// matrix routing controller
rv.controllers.routing = function($scope, ravennaCometdService) {
    // empty routing tree
    $scope.routing = {};
    
    // number of items to combine - try to load from local storage
    try {
        $scope.combine = JSON.parse(localStorage.getItem('combine'));
    } catch (e) {}
    if (!$scope.combine  ||  !angular.isObject($scope.combine))
        $scope.combine = {};

    // counts the number of ports in the given outputs block
    $scope.countOutputs = function(block) {var i = 0; for (; $scope.routing.outputs[block][i.toString()]; ++ i); return i;}
    
    // reset
    $scope.reset = function() {};
    
    // store combine grouping in local storage
    $scope.$watchCollection('combine', function() {localStorage.setItem('combine', JSON.stringify($scope.combine));});
    
    $scope.selected = function(block, port, combine) {$scope.go('/port-routing/' + block + '/' + port + '/' + combine);}
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return (data.routing);
        },
        function(data) { // apply function
            $scope.$evalAsync(function() {
                $scope.routing = data.routing;
                $scope.reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
};
rv.controllers.routing.$inject = ['$scope', 'ravennaCometdService'];

// colors: madi - RAL2003 255,99,54, ravenna - #bfc81f
rv.controllers.routing.colors = {madi: '#ff6336', ravenna: '#bfc81f', tdm: '#578CB5', mute: '#aaa', 'default': '#ccc'};

// matrix routing controller
rv.controllers.portRouting = function($scope, ravennaCometdService, $routeParams) {
    $scope.block = $routeParams.block;
    $scope.port = parseInt($routeParams.port);
    $scope.combine = parseInt($routeParams.combine);
    
    // empty routing tree
    $scope.routing = {};
    
    // counts the number of ports in the given inputs block
    $scope.countInputs = function(block) {var i = 0; for (; $scope.routing.inputs[block][i.toString()]; ++ i); return i;};
    $scope.countBlocks = function(block, combine) {
        if (block == 'mute') return 1;
        return $scope.countInputs(block) / combine;
    };
    
    // reset
    $scope.reset = function() {};
    
    $scope.selected = function(block, port, combine) {
        var update = {};
        for (var i = 0; i < combine; ++ i) {
            var in_port = (block == 'mute' ? 0 : port + i);
            update[($scope.port + i).toString()] = {in: block + '/' + in_port};
        }
        ravennaCometdService.publish({path: '$.routing.outputs.' + $scope.block, value: update});
        $scope.goBack();};
    
    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return (data.routing);
        },
        function(data) { // apply function
            $scope.$evalAsync(function() {
                $scope.routing = data.routing;
                $scope.reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});    
};
rv.controllers.portRouting.$inject = ['$scope', 'ravennaCometdService', '$routeParams'];

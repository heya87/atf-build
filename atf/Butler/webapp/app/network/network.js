// basic network settings and all network interfaces
rv.controllers.networkSettings = function($scope, $modal, ravennaCometdService) {
    $scope.server = {
        hostname: '',
        gateway: ''
    };
    
    // all interface names, e.g. 'eth0'
    $scope.interfaces = [];

    $scope.disabled = function() {
        return !$scope.expertMode[0]  ||  ravennaCometdService.data._capabilities.networkSettingsReadOnly;
    };
    
    $scope.openProperties = function() {
        var child = $scope.$new();
        child.local = angular.copy($scope.server);
        child.isClean = function() { return angular.equals($scope.server, child.local); };
        
        var modalInstance = $modal.open({
            templateUrl: 'app/network/hostProperties.html',
            scope: child
        });

        modalInstance.result.then(function() {
                ravennaCometdService.publish({path: '$.network', value: child.local}, {
                    onComplete: function(message) {},
                    onError: function(message) {}
                });
            }, function () {
        });
    };
    
    // settings listener
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.network;
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server.hostname = data.network.hostname;
                $scope.server.gateway = data.network.gateway;
                
                if (data.network.interfaces) {
                    // collect all available interfaces
                    $scope.interfaces = [];
                    angular.forEach(ravennaCometdService.data.network.interfaces, function(v, k) {
                        $scope.interfaces.push(k);
                    });
                }
            });
        });
};
rv.controllers.networkSettings.$inject = ['$scope', '$modal', 'ravennaCometdService'];

// a single network interfaces
// note: the scope member 'ifName' must be set to the actual interface name
rv.controllers.networkInterface = function($scope, $modal, ravennaCometdService, $routeParams) {
    $scope.server = {
        config: 0,
        address: '0.0.0.0',
        netmask: '255.255.255.255'
    };
    
    $scope.rebootRequired = false;
    
    $scope.configs = [{id: 0, label: 'Static'}, {id: 1, label: 'DHCP'}]; //, {id: 2, label: 'Zeroconf'}];
    
    $scope.openNicProperties = function(size) {
        var child = $scope.$new();
        child.local = angular.copy($scope.server);
        child.isClean = function() { return angular.equals(child.local, $scope.server); };
    
        child.save = function() {
            $scope.rebootRequired = true;
            ravennaCometdService.publish({path: '$.network.interfaces.' + $scope.ifName, value: child.local}, {
                onComplete: function(message) {},
                onError: function(message) {}
            });
        };
        
        var modalInstance = $modal.open({
            templateUrl: 'app/network/nicProperties.html',
            scope: child
        });
        modalInstance.result.then(function() {
                $scope.reboot();
            }, function () {
        });
    };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.network  &&  data.network.interfaces  &&  data.network.interfaces[$scope.ifName];
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server = data.network.interfaces[$scope.ifName];
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.networkInterface.$inject = ['$scope', '$modal', 'ravennaCometdService', '$routeParams'];


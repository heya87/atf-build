// network host name
rv.controllers.hostname = function($scope, ravennaCometdService) {
    $scope.server = {
        hostname: '',
        gateway: ''
    };
    $scope.local = angular.copy($scope.server);
    $scope.disabled = true;
    
    $scope.isClean = function() {
        return angular.equals($scope.local.hostname, $scope.server.hostname);
    };
    
    $scope.save = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.network.hostname', value: $scope.local.hostname}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
    };
    
    $scope.reset = function() {
        $scope.local.hostname = angular.copy($scope.server.hostname);
        $scope.disabled = false;
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
                $scope.reset();
            });
        });
};
rv.controllers.hostname.$inject = ['$scope', 'ravennaCometdService'];

// all network interfaces
rv.controllers.networkInterfaces = function($scope, ravennaCometdService) {
    // all interface names, e.g. 'eth0'
    $scope.interfaces = [];
    
    // settings listener
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.network  &&  data.network.interfaces;
        },
        function(data) { // apply function
            $scope.$apply(function() {
                // collect all available interfaces
                $scope.interfaces = [];
                angular.forEach(ravennaCometdService.data.network.interfaces, function(v, k) {
                    $scope.interfaces.push(k);
                });
            });
        });
};
rv.controllers.networkInterfaces.$inject = ['$scope', 'ravennaCometdService'];

// a single network interfaces
// note: the scope member 'ifName' must be set to the actual interface name
rv.controllers.networkInterface = function($scope, ravennaCometdService, $routeParams) {
    if ($routeParams  &&  $routeParams.ifName)
        $scope.ifName = $routeParams.ifName;
    
    $scope.server = {
        config: 0,
        address: '0.0.0.0',
        netmask: '255.255.255.255'
    };
    $scope.local = angular.copy($scope.server);
    $scope.disabled = true;
    $scope.configs = [{id: 0, label: 'Static'}, {id: 1, label: 'DHCP'}, {id: 2, label: 'Zeroconf'}];
    
    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.server);
    };
    
    $scope.save = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.network.interfaces.' + $scope.ifName, value: $scope.local}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
    };
    
    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);
        $scope.disabled = false;
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
                $scope.reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
};
rv.controllers.networkInterfaces.$inject = ['$scope', 'ravennaCometdService', '$routeParams'];

// clock
rv.controllers.clock = function($scope, ravennaCometdService) {
    // server dummy data
    $scope.server = {
        domain: 0,
        master_ip: "",
        prio1: 0,
        prio2: 0,
        announce: 0, 
        sync: 0,
        slaveOnly: false,
        delayMechanism: 0,
        dscp: 56
    };
    
    // local data
    $scope.local = angular.copy($scope.server);
    
    // dropdown boxes
    $scope.announces = [];
    for (var i = 0; i < 5; i ++) $scope.announces.push({value: i, label: Math.pow(2, i) + ' sec.'});
    $scope.syncs = [{value: -1, label: '0.5 sec.'}, {value: 0, label: '1 sec.'}, {value: 1, label: '2 sec.'}];
    $scope.dscps = [{value: 56, label: '56 (CS7)'}, {value: 48, label: '48 (CS6)'}, {value: 46, label: '46 (EF)'}];    
    $scope.delayMechanisms = [{value: 1, label: 'E2E'}, {value: 2, label: 'P2P'}];
    
    // the current status
    $scope.status = {};

    // graph data: pairs of index/offset pairs
    $scope.graphData = [[]];

    // all is disabled if true
    $scope.disabled = true;
    
    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.server);
    };
    
    $scope.save = function() {
        $scope.disabled = true;
        ravennaCometdService.publish({path: '$.network.services.ptp', value: $scope.local}, {
            onComplete: function(message) { $scope.$apply(function() {$scope.reset();}) },
            onError: function(message) { $scope.$apply(function() {$scope.reset();}) }
        });
    };
    
    $scope.reset = function() {
        $scope.local = angular.copy($scope.server);
        $scope.disabled = false;
    };
    
    // settings listener
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.network  &&  data.network.services  &&  data.network.services.ptp;
        },
        function(data) { // apply function
            $scope.$apply(function() {
                $scope.server = data.network.services.ptp;
                $scope.reset();
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
    
    // status messages listener
    var s = ravennaCometdService.subscribe('/ravenna/stream/network/services/ptp', function(message) {
        $scope.$apply(function() {
            // create graph data
            var arr = $scope.graphData[0];
            while (arr.length < $scope.graphLength)
                arr.push([]);
            
            arr.push([0, message.data.offset]);
            if (arr.length > $scope.graphLength)
                arr.splice(0, arr.length - $scope.graphLength);
            
            angular.forEach(arr, function(e, i) { if (e) e[0] = i; });
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.clock.$inject = ['$scope', 'ravennaCometdService'];


// clock
rv.controllers.PTP = function($scope, $modal, ravennaCometdService) {
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
        dscp: 56,
        interfaces: {
            ra0: {
            }
        }
    };
    
    // dropdown boxes
    $scope.announces = [];
    for (var i = 0; i < 5; i ++) $scope.announces.push({value: i, label: Math.pow(2, i) + ' sec.'});
    $scope.syncs = [{value: -1, label: '0.5 sec.'}, {value: 0, label: '1 sec.'}, {value: 1, label: '2 sec.'}];
    $scope.dscps = [{value: 56, label: '56 (CS7)'}, {value: 48, label: '48 (CS6)'}, {value: 46, label: '46 (EF)'}];    
    $scope.delayMechanisms = [{value: 1, label: 'E2E'}, {value: 2, label: 'P2P'}];
    
    // the current status
    $scope.status = {};

    // graph data: colors, pairs of index/offset pairs
    var graphColors = ["rgb(20, 235, 20)", "rgb(242, 222, 7)", "rgb(242, 170, 7)"];
    $scope.graphData = [{color: graphColors[0], data:[]}];

    $scope.editPTP = function(size) {
        var modalInstance = $modal.open({
            templateUrl: 'app/ptp/ptpProperties.html',
            scope: $scope,
            controller:  rv.controllers.editPTP
        });

        modalInstance.result.then(function(changes) {
                ravennaCometdService.publish({path: '$.network.services.ptp', value: changes}, {
                    onComplete: function(message) {},
                    onError: function(message) {}
                });
            }, function () {
        });
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
            });
        }));
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); })});
    
    // status messages listener
    var s = ravennaCometdService.subscribe('/ravenna/stream/network/services/ptp', function(message) {
        $scope.$apply(function() {
            // create graph data
            var graph = $scope.graphData[0];
            
            var arr = graph.data;
            while (arr.length < $scope.graphLength)
                arr.push([]);
            
            arr.push([0, message.data.offset]);
            if (arr.length > $scope.graphLength)
                arr.splice(0, arr.length - $scope.graphLength);
            
            // color handling
            graph.color = graphColors[0]; // green
            for (var i = 0; i < arr.length; ++i) {
                if (arr[i]  &&  arr[i].length == 2) {
                    if (Math.abs(arr[i][1]) > 5.0)
                        graph.color = graphColors[2]; // orangeish
                    else if (Math.abs(arr[i][1]) > 1.0)
                        graph.color = graphColors[1]; // yellowish
                }
            }
            
            angular.forEach(arr, function(e, i) { if (e) e[0] = i; });
        });
    });
    $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
};
rv.controllers.PTP.$inject = ['$scope', '$modal', 'ravennaCometdService'];

// ptp edit mode
rv.controllers.editPTP = function($scope, ravennaCometdService) {
    // local data
    $scope.local = angular.copy($scope.server);
    delete $scope.local.accuracy;
    delete $scope.local.class;
    delete $scope.local.gmId;
    delete $scope.local.masterIp;
    delete $scope.local.offsetFromMaster;
    delete $scope.local.state;
    $scope.local2 = angular.copy($scope.local);
    
    // @return true if the network settings are read-only (i.e. not in expert mode or not possible on this platform)
    $scope.disabled = function() {
        return !$scope.expertMode[0]  ||  ravennaCometdService.data._capabilities.networkSettingsReadOnly;
    };
    
    // @return true if nothing has been changed by the user (so far)
    $scope.isClean = function() {
        return angular.equals($scope.local, $scope.local2);
    };
};
rv.controllers.editPTP.$inject = ['$scope', 'ravennaCometdService'];

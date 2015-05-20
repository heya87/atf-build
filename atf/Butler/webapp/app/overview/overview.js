// all destinations
rv.controllers.destinations = function($scope, $modal, $debounce, ravennaCometdService, ravennaSessionsService) {
    // all destinations
    $scope.destinations = [];
    
    // selected destinations
    $scope.selected = [];

    $scope.scrollLimit = 999;
/*    $scope.addItems = function() {
        if ($scope.scrollLimit < $scope.destinations.length)
            $scope.scrollLimit += 20;
    };*/

    // adds a new session destination
    // temprorarily add a command listener to wait for the 'created' message from the server with the new id
    $scope.addDestination = function() {
        // create a new scope and assign an empty data template
        var child = $scope.$new();
        child.server = angular.copy(ravennaSessionsService.getEmptyDestination());
        
        var modalInstance = $modal.open({
            templateUrl: 'app/destination/destinationProperties.html',
            scope: child,
            controller: rv.controllers.editDestination
        });

        modalInstance.result.then(function(changes) {
                var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
                    if (message.data.command == 'create') {
                        ravennaCometdService.unsubscribe(s);
                        ravennaSessionsService.saveDestination(message.data.result, changes);
                    }
                });
                $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
                ravennaCometdService.command({path: '$.streaming.sessions.destinations', command: 'create'});
            }, function () {
            });
    };
    
    $scope.selectAll = function() {
        $scope.selected = angular.copy($scope.destinations);
    };
    
    $scope.selectNone = function() {
        $scope.selected = [];
    };
    
    $scope.toggle = function(id) {
        var n = $scope.selected.indexOf(id);
        if (n >= 0)
            $scope.selected.splice(n, 1);
        else
            $scope.selected.push(id);
    };

    $scope.isSelected = function(id) {
        return $scope.selected.indexOf(id) >= 0;
    };

    $scope.deleteSelected = function() {
        angular.forEach($scope.selected, function(id) {
            ravennaCometdService.command({path: '$.streaming.sessions.destinations.' + id, command: 'remove'});
        });
        $scope.selectNone();
    };
    
    var updateDestinations = function() { 
        var dataDestinations = ravennaCometdService.data.streaming.sessions.destinations; 
        var destinations = [];
        angular.forEach(dataDestinations, function(s, k) { if (k != "SCHEMA") destinations.push(k); });

        if (!angular.equals($scope.destinations, destinations))
            $scope.$apply(function() { $scope.destinations = destinations; });
        
        // remove any selected items that are no longer available
        for (var i = $scope.selected.length - 1; i >= 0; -- i) {
            var selected = $scope.selected[i];
            if (destinations.indexOf(selected) >= 0)
                $scope.toggle(selected);
        }
    };

    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  && data.streaming.sessions  &&  data.streaming.sessions.destinations;
        },
        function(data) { // apply function
            $debounce(updateDestinations, 300);
        }));
    var removeListener = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'remove') {
            updateDestinations();
        }
    });
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); }); ravennaCometdService.unsubscribe(removeListener); });
};
rv.controllers.destinations.$inject = ['$scope', '$modal', '$debounce', 'ravennaCometdService', 'ravennaSessionsService'];

// all sources
rv.controllers.sources = function($scope, $modal, $debounce, ravennaCometdService, ravennaSessionsService) {
    // all sources
    $scope.sources = [];

    // the selected sources
    $scope.selected = [];
    
    $scope.scrollLimit = 999;
/*    $scope.addItems = function() {
        if ($scope.scrollLimit < $scope.sources.length)
            $scope.scrollLimit += 20;
    };*/

    // adds a new session destination
    // temprorarily add a command listener to wait for the 'created' message from the server with the new id
    $scope.addSource = function() {
        // create a new scope and assign an empty data template
        var child = $scope.$new();
        child.server = angular.copy(ravennaSessionsService.getEmptySource());
        
        var modalInstance = $modal.open({
            templateUrl: 'app/source/sourceProperties.html',
            scope: child,
            controller: rv.controllers.editSource
        });

        modalInstance.result.then(function(changes) {
                var s = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
                    if (message.data.command == 'create') {
                        ravennaCometdService.unsubscribe(s);
                        ravennaSessionsService.saveSource(message.data.result, changes);
                    }
                });
                $scope.$on('$destroy', function() { ravennaCometdService.unsubscribe(s); });
                ravennaCometdService.command({path: '$.streaming.sessions.sources', command: 'create'});
            }, function () {
            });
    };
        
    $scope.selectAll = function() {
        $scope.selected = angular.copy($scope.sources);
    };
    
    $scope.selectNone = function() {
        $scope.selected = [];
    };
    
    $scope.toggle = function(id) {
        var n = $scope.selected.indexOf(id);
        if (n >= 0)
            $scope.selected.splice(n, 1);
        else
            $scope.selected.push(id);
    };

    $scope.isSelected = function(id) {
        return $scope.selected.indexOf(id) >= 0;
    };

    $scope.deleteSelected = function() {
        angular.forEach($scope.selected, function(id) {
            ravennaCometdService.command({path: '$.streaming.sessions.sources.' + id, command: 'remove'});
        });
        $scope.selectNone();
    };
    
    var updateSources = function() { 
        var dataSources = ravennaCometdService.data.streaming.sessions.sources;
        var sources = [];
        angular.forEach(dataSources, function(s, k) { if (k != "SCHEMA") sources.push(k); });

        if (!angular.equals($scope.sources, sources))
            $scope.$apply(function() { $scope.sources = sources; });

        // remove any selected items that are no longer available
        for (var i = $scope.selected.length - 1; i >= 0; -- i) {
            var selected = $scope.selected[i];
            if (sources.indexOf(selected) >= 0)
                $scope.toggle(selected);
        }
    };

    var listeners = [];
    // settings listener
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.streaming  &&  data.streaming.sessions &&  data.streaming.sessions.sources;
        },
        function(data) { // apply function
            $debounce(updateSources, 300);
        }));
    var removeListener = ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'remove') {
            updateSources();
        }
    });
    $scope.$on('$destroy', function() { angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); }); ravennaCometdService.unsubscribe(removeListener); });
};
rv.controllers.sources.$inject = ['$scope', '$modal', '$debounce', 'ravennaCometdService', 'ravennaSessionsService'];

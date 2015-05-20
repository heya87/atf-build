rv.controllers.global = function($scope, $location, $modal, ravennaCometdService, ngToast) {
    // make the location available everywhere
    $scope.location = $location;
    
    // regular expressions for input fields
    $scope.ipAddressPattern = /^((\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)(?:\.(\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)){3})$/;
    $scope.ipAddressAndPortPattern = /^((\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)(?:\.(\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)){3})(\:(6553[0-5]|655[0-2]\d|65[0-4]\d\d|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}|0))?$/;
    $scope.ipAddressPortTTLPattern = /^((\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)(?:\.(\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)){3})(\:(6553[0-5]|655[0-2]\d|65[0-4]\d\d|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}|0))?(\/(2[0-4]\d|25[0-5]|1\d\d|[1-9]\d|\d))?$/;
    $scope.ipAddressPortTTLPatternWithAuto = /^(auto|((\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)(?:\.(\d|[1-9]\d|2[0-4]\d|25[0-5]|1\d\d)){3})(\:(6553[0-5]|655[0-2]\d|65[0-4]\d\d|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}|0))?(\/(2[0-4]\d|25[0-5]|1\d\d|[1-9]\d|\d))?)$/;
    $scope.hostnamePattern = /^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$/;

    // a little workaround to allow dynamic bootstrap popovers 
    $scope.updatePopover = function(e) {
        var element = jQuery(e);
        var x = element.data('popover');
        x.options.content = null; // reset original content
        x.setContent.call(x);
    };
    
    // show/hide expert mode settings
    $scope.expertMode = [false];
    
    // number of pairs for graphs
    $scope.graphLength = 15;

    // the build numbers and expire dates
    $scope._version = { butler: '', streamer: '', expire: null };
    
    // capabilities like: 'logfiles', 'firmwareUpdate', ...
    $scope._capabilities = {}; 
    
    // a list of all discovered RAVENNA services (the HTTP URIs)
    $scope.discoveredServices = [];

    $scope.enableEditMode = function() {
        if (!$scope.expertMode[0]) {
            var child = $scope.$new();
            child.validate = function(password) {
                if (password == "ravenna") {
                    $scope.expertMode[0] = true;
                    return true;
                }
                return false;
            };
            var modalInstance = $modal.open({
                templateUrl: 'editMode.html',
                scope: child
            });
            modalInstance.result.then(function() {
                }, function () {
            });
        }
    };

    $scope.updateDiscoveredHTTPServices = function() {
        ravennaCometdService.command({command: 'listServices'});
    };
    
    // Causes this web client to connect to the HTTP service denoted by the given URL
    // @param uri a dnssd uri that resolves to a RAVENNA HTTP service
    $scope.switchTo = function(uri) {
        ravennaCometdService.command({command: 'resolveService', params: {uri: uri}});
    };
    
    $scope.reboot = function() {
        ravennaCometdService.command({command: 'reboot'}); 
    };

    $scope.rebootDialog = function() { 
        if ($scope.expertMode[0]) {
            var modalInstance = $modal.open({
                templateUrl: 'app/advanced/reboot.html',
            });
            modalInstance.result.then(function() {
                    $scope.reboot();
                }, function () {
            });
        }
    };
    
    $scope.showDialog = function(template, size) { 
        var modalInstance = $modal.open({
            templateUrl: template,
            size: size
        });
    };
    
    $scope.go = function(x) {
        $location.path(x);
    };

    $scope.goBack = function() { 
        setTimeout(function() { window.history.back(); }, 1); 
    }; 
    
    // expert mode setting is stored in local storage
    var expertModeKey = "ravenna.expertMode";
    $scope.expertMode[0] = localStorage.getItem(expertModeKey) == 'true';
    $scope.$watch('expertMode[0]', function() {localStorage.setItem(expertModeKey, $scope.expertMode[0]); });
    
    // cometd initialization
    $scope.cometd = {
        connected: true
    };
    
    // listener for cometd events 
    ravennaCometdService.addListener('/meta/connect', function(message) {
        if ($scope.cometd.connected != (message.successful === true)) {
            $scope.$apply(function() {
                $scope.cometd.connected = (message.successful === true);
            });
        }
    });

    // listener for notifications sent by the server
    var s = ravennaCometdService.subscribe('/ravenna/stream/errors', function(message) {
        $scope.$apply(function() {
            ngToast.create({
                content: message.data,
                class: 'danger'
            });
        });
    });

    // settings listener for buildnr and capabilities
    var listeners = [];
    listeners.push(ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data._capabilities  ||  data.routing;
        },
        function(data) { // apply function
            if (data._capabilities)
                $scope._capabilities = data._capabilities;
            if (data.routing)
                $scope._capabilities.routing = true;
        }));
    listeners.push(ravennaCometdService.subscribe('/ravenna/commands', function(message) {
        if (message.data.command == 'listServices') {
            $scope.$apply(function() {
               $scope.discoveredServices = message.data.result;
            });
        }
        // we resolved a HTTP service - this means we want to switch to that client
        if (message.data.command == 'resolveService') {
            var httpUrl = "http://" + message.data.result.address + ":" + message.data.result.port;
            window.open(httpUrl, "_self");
        }
    }));
    $scope.$on('$destroy', function() { 
        angular.forEach(listeners, function(l) { ravennaCometdService.removeSettingsListener(l); });
        ravennaCometdService.unsubscribe(s);
    });
};
rv.controllers.global.$inject = ['$scope', '$location', '$modal', 'ravennaCometdService', 'ngToast'];

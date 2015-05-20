var rv = {};
rv.controllers = {};

// declare a module
rv.app = angular.module('rv', ['ngRoute', 'rv.cometdServiceModule', 'rv.servicesModule', 'rv.filters', 'rv.directives', 'ui', 'infinite-scroll'], function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|rtsp):/);
    })
    .config(['$routeProvider', function($routeProvider) {
        $routeProvider
            .when('/about', {templateUrl: 'inc/about.html'})
            .when('/advanced', {templateUrl: 'inc/advanced.html'})
            .when('/clock', {templateUrl: 'inc/clock.html', controller: rv.controllers.clock})
            .when('/media/:ioName', {templateUrl: 'inc/io.html', controller: rv.controllers.io})
            .when('/media/:ioName/labels', {templateUrl: 'inc/io-labels.html', controller: rv.controllers.io})
            .when('/medias', {templateUrl: 'inc/ios.html'})
            .when('/network_if/:ifName', {templateUrl: 'inc/network_if.html', controller: rv.controllers.networkInterface})
            .when('/network', {templateUrl: 'inc/network.html'})
            .when('/overview', {templateUrl: 'inc/overview.html'})
            .when('/overview2', {templateUrl: 'inc/overview2.html'})
            .when('/destination/:id', {templateUrl: 'inc/destination.html', controller: rv.controllers.destination})
            .when('/source/:id', {templateUrl: 'inc/source.html', controller: rv.controllers.source})
            .when('/update', {templateUrl: 'inc/update.html'})
            .when('/routing', {templateUrl: 'inc/routing.html', controller: rv.controllers.routing})
            .when('/port-routing/:block/:port/:combine', {templateUrl: 'inc/port-routing.html', controller: rv.controllers.portRouting})
            .otherwise({redirectTo: '/overview'});
    }]);

// misc. helper methods
rv.helpers = {}
rv.helpers.formatInsOuts = function(tracks, ownId, markerForUsed) {
    var c = [];
    angular.forEach(tracks, function(track, key) {
        var index = parseInt(key);
        var userLabel = track.labels  &&  track.labels.user ? track.labels.user : '(Track ' + index + ')';
        var available = true;
        if (markerForUsed) {
            if (track.available !== undefined  &&  !track.available)
                available = false;
            else if (track.in  &&  track.in.length > 0) {
                if (track.in.indexOf(ownId) != 0)
                    available = false;
            }
        }
        c[index] = {id: index, index: index, name: available ? userLabel : userLabel + markerForUsed, text: available ? userLabel : userLabel + markerForUsed};
    });
    return c;
};

// helper method for generating UUIDs
rv.helpers.generateGUID = (typeof(window.crypto) != 'undefined' && typeof(window.crypto.getRandomValues) != 'undefined') ?
        function() {
            // If we have a cryptographically secure PRNG, use that
            // http://stackoverflow.com/questions/6906916/collisions-when-generating-uuids-in-javascript
            var buf = new Uint16Array(8);
            window.crypto.getRandomValues(buf);
            var S4 = function(num) {
                var ret = num.toString(16);
                while (ret.length < 4) {
                    ret = "0" + ret;
                }
                return ret;
            };
            return (S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-"
                    + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]));
        }

        :

        function() {
            // Otherwise, just use Math.random
            // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
                    function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r
                                : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
        };

var rv = {};
rv.controllers = {};

// declare a module
rv.app = angular.module('rv', ['ngRoute', 'rv.cometdServiceModule', 'rv.servicesModule', 'rv.filters', 'rv.directives', 'ui', 'ui.bootstrap', 'ngAnimate', 'ngToast'], function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|rtsp):/);
    })
    .config(['$routeProvider', function($routeProvider) {
        $routeProvider
            .when('/overview', {templateUrl: 'app/overview/overview.html'})
            .when('/routing', {templateUrl: 'app/routing/routing.html', controller: rv.controllers.routing})
            .when('/port-routing/:block/:port/:combine', {templateUrl: 'app/routing/port-routing.html', controller: rv.controllers.portRouting})
            .otherwise({redirectTo: '/overview'});
    }]);

// misc. helper methods
rv.helpers = {}

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

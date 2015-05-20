angular.module('rv.directives', [])
.directive('zippy', function() {
    return {
        restrict: 'C',
        replace: true,
        transclude: true,
        scope: {
            title: '@zippyTitle'
        },
        template: '<div>' +
                      '<div class="title">{{title}}</div>' +
                      '<div class="body" ng-transclude></div>' +
                  '</div>',

        // the linking function will add behavior to the template
        link: function(scope, element, attrs) {
            // title element
            var title = angular.element(element.children()[0]);

            // local storage key
            var key = 'ravenna.zippy.' + attrs.zippyTitle;

            // opened / closed state
            var opened = localStorage.getItem(key) != 'true';

            // clicking on title should open/close the zippy
            title.bind('click', toggle);

            // toggle the closed/opened state
            function toggle() {
                opened = !opened;
                element.removeClass(opened ? 'closed' : 'opened');
                element.addClass(opened ? 'opened' : 'closed');

                localStorage.setItem(key, opened);
            }

            // initialize the zippy
            toggle();
        }
    }
})
.directive('flot', function() {
    return {
        restrict: 'C',
        replace: true,
        template: '<div></div>',

        link: function(scope, element, attrs) {
            var redraw = function() {
                var data = scope[attrs.flotData]
                var minmax = 0.5;
                angular.forEach(data[0].data, function(xy) {
                    if (xy  &&  xy[1] > minmax)
                        minmax = xy[1];
                });
                var flotOptions = scope[attrs.flotOptions];
                flotOptions.yaxis.min = -minmax;
                flotOptions.yaxis.max = minmax;
                jQuery.plot(jQuery(element), data, flotOptions);
            };
            jQuery(window).resize(redraw);
            scope.$watch(attrs.flotData, redraw, true);
        }
    }
})
// a specific directive for channel selection
.directive('rvChannelMap', function() {
    return {
        restrict: 'C',
        require: '?ngModel',
        replace: true,
        template: '<input type="hidden"></input>',

        link: function(scope, element, attrs, ngModel) {
            if (!ngModel) return;

            function is(element, callback) {
                var options = scope[attrs.data];
                var v = element.val();
                var data = [];
                if (v.length > 0)
                    angular.forEach(v.split(','), function(key) {data.push(options[parseInt(key)]);});
                callback(data);
            };

            // update possible selections
            var options = scope[attrs.data];
            element.select2({multiple: true, data: options, initSelection: is});
            scope.$watch(attrs.data, function() {
                var options = scope[attrs.data];
                element.select2({multiple: true, data: options, initSelection: is});
                ngModel.$render();
             });

            // specify how UI should be updated
            ngModel.$render = function() {
                element.select2("val", ngModel.$viewValue);
            };

            // write data to the model
            function read() {
                var v = element.val();
                var data = [];
                if (v.length > 0)
                    angular.forEach(v.split(','), function(key) { data.push(parseInt(key)); });
                ngModel.$setViewValue(data);
            }

            // listen for change events to enable binding
            element.bind('blur keyup change', function() {
                scope.$apply(read);
            });
            read(); // initialize
        }
    }
})
// a directive to display a parsed SDP
.directive('prettySdp', ['$compile', function ($compile) {
    return {
        restrict: 'C',
        replace: false,
        scope: {
            sdp: '=' // the sdp
        },
        transclude: true,
        template: '<div class="popover top" style="display: block; min-width: 300px; top: left: -100px;" onclick="return false" ng-click="$event.stopPropagation()" >' +
                      '<div style="left: 100px;" class="arrow"></div>' +
                      '<div class="popover-title">{{name}}</div>' +
                      '<div class="form-inline pull-right"><input type="checkbox" ng-checked="showUnformatted" ng-click="flickFormat(); $event.stopPropagation();"></input><label>Show SDP source</label></div>' +
                      '<div class="popover-content form-inline">' +
                      '  <div ng-show="!showUnformatted">' +
                      '    <div><label>Codec</label><span>{{codec}}</span></div>' +
                      '    <div><label>Sample Rate</label><span>{{sampleRate}}</span></div>' +
                      '    <div><label>Frame size</label><span>{{frameCount}}</span><span ng-show="frameCount==48"> (AES67 Standard Stream)</span></div>' +
                      '    <div><label>Channels</label><span>{{channels}}</span></div>' +
                      '  </div>' +
                      '  <div style="margin-top: 10px;" ng-show="showUnformatted"><pre>{{sdp}}</pre></div>' +
                      '</div>' +
                  '</div>',

        // the linking function will add behavior to the template
        link: function($scope, $element, attrs) {
            $scope.showUnformatted = false;
            $scope.flickFormat = function() { $scope.showUnformatted = !$scope.showUnformatted; };

            var update = function() {
                if ($scope.sdp) {
                    var names = $scope.sdp.match(/(s=(.*))\r\n/);
                    $scope.name = names[2];

                    var codecs = $scope.sdp.match(/(a=rtpmap:[0-9]+ (.*)\/(.*))\/.*\r\n/);
                    $scope.codec = codecs[2];
                    $scope.sampleRate = codecs[3];

                    var frameCount = $scope.sdp.match(/(a=framecount:([0-9]+))/);
                    $scope.frameCount = parseInt(frameCount[2]);

                    var channels = $scope.sdp.match(/(i=(.*))\r\n/);
                    channels = channels[2].split(',');
                    $scope.channels = "";
                    for (var i = 0; i < channels.length  &&  i < 4; ++i) {
                        if (i > 0)
                            $scope.channels += ", ";
                        $scope.channels += channels[i];
                    }
                    if (channels.length > 4) // don't show more than 4 channels
                        $scope.channels = ", ... + (" + channels.length + ")";
                }
            };
            $scope.$watch('sdp', update);
        }
    }
}])
// a directive to display a single output port
.directive('portRouting', function() {
    return {
        restrict: 'C',
        replace: true,
        transclude: true,
        scope: {
            items: '=items',
            port: '=port',
            block: '=block',
            combine: '=combine'
        },
        template: '<div></div>',
        selection: [],
        
        link: function($scope, element, attrs) {
            var parseRoutingEntry = function(entry) {
                var j = entry.indexOf('/');
                return {media: entry.substr(0, j), index: entry.substr(j + 1)}; // note: index is a string, also
            };
            var getInputLabel = function(input) {
                var routingEntry = parseRoutingEntry(input);
                return routingEntry.media + "/" + (parseInt(routingEntry.index) + 1);
            };
            var getOutputLabel = function(output) {
                var routingEntry = parseRoutingEntry(output);
                return routingEntry.media + "/" + (parseInt(routingEntry.index) + 1);
            };
            
            var c = jQuery(element);
            var render = function() {
                if (!$scope.items)
                    return;

                function block(b) {
                    if (b === undefined)
                        return "default";
                    var i = b.indexOf('/');
                    if (i > 0)
                        return b.substring(0, i);
                    return b;
                }

                var colors = rv.controllers.routing.colors;
                function color(b) {
                    if (b.indexOf('RAVENNA Audio') == 0)
                        return colors['ravenna'];
                    return colors[block(b)] || colors['default'];
                }

                var port = parseInt($scope.port);
                var combine = parseInt($scope.combine) || 1;
                var temp = jQuery('<div class="rav-routing"/>');
                if (combine <= 8) {
                    for (var n = 0; n < combine; ++ n) {
                        var input = $scope.items[port + n];
                        if (input && input.in)
                            input = input.in;
                        
                        if (input == 'mute/0')
                            input = 'mute';
                        else
                            input = getInputLabel(input);
                        
                        temp.append('<div class="rav-routing-entry">' +
                            '<div class="rav-port-input" style="background-color:' + color(input) + '">'  + input + '</div>' +
                            '<i class="icon-long-arrow-right" />' +
                            '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">' + (port + n + 1).toString() + '</div></div>');
                    }
                }
                else {
                    var input0 = getInputLabel($scope.items[0].in);
                    var input1 = getInputLabel($scope.items[combine - 1].in);
                    var b = block(input0);
                    for (var i = 1; i < combine; ++ i) {
                        if (block($scope.items[i].in) != b) {
                            input1 = "&nbsp;";
                            break;
                        }
                    }
                    if (input0 == 'mute/0')
                        input0 = 'mute';
                    if (input1 == 'mute/0')
                        input1 = 'mute';
                    temp.append('<div class="rav-routing-entry">' +
                        '<div class="rav-port-input" style="background-color:' + color(input0) + '">'  + input0 + '</div>' +
                        '<i class="icon-long-arrow-right" />' +
                        '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">1</div></div>');
                    temp.append('<div class="rav-routing-entry">' +
                        '<div class="rav-port-input" style="background-color:' + color(input1) + '">- '  + input1 + '</div>' +
                        '<i class="icon-long-arrow-right" />' +
                        '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">- 64</div></div>');
                }
                c.children().detach();
                c.append(temp);
            };

            $scope.$watch('items', render, true);
            $scope.$watch('combine', render);

            render();
        }
    }
})
// a directive to display a single input port
.directive('inputPort', function() {
    return {
        restrict: 'C',
        replace: true,
        transclude: true,
        scope: {
            block: '=block',
           items: '=items',
           port: '=port',
           combine: '=combine'
        },
        template: '<div></div>',
        selection: [],

        link: function($scope, element, attrs) {
            var c = jQuery(element);
            var render = function() {
                if (!$scope.items)
                    return;

                var colors = rv.controllers.routing.colors;
                function color(block) {
                    if (block.indexOf('RAVENNA Audio') == 0)
                        return colors['ravenna'];
                    
                    var i = block.indexOf('/');
                    if (i > 0)
                        return colors[block.substring(0, i)]  ||  colors['default'];
                    return colors[block]  ||  colors['default'];
                }

                var port = parseInt($scope.port);
                var combine = parseInt($scope.combine) || 1;
                var temp = jQuery("<div/>");
                if (combine <= 8) {
                    var ports = "";

                    for (var n = 0; n < combine; ++ n)
                        ports += '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">' + (port + n + 1).toString() + '</div>';

                    var x = jQuery('<div class="rav-ports" >' + ports + '</div>');
                    temp.append(x);
                }
                else {
                    temp.append('<div class="rav-ports">'
                            + '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">1</div>'
                            + '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">- 64</div></div>');
                }
                c.children().detach();
                c.append(temp);
            };

            $scope.$watch('items', render, true);
            $scope.$watch('combine', render);

            render();
        }
    };
})
.directive('staticInclude', ["$http", "$templateCache", "$compile", "$parse", function($http, $templateCache, $compile, $parse) {
    return function(scope, element, attrs) {
            var templatePath = $parse(attrs.staticInclude)(scope);

            attrs.$observe("staticInclude", function(value) {
                scope.$watch(value, function(templatePath){
                loadTemplate(templatePath);                    
            });
        });

        function loadTemplate(templatePath){
            $http.get(templatePath, {cache: $templateCache}).success(function(response) {
                element.html(response);
                $compile( element.contents() )(scope);
            });
        }
    };
}])
.directive('autofocus', ['$timeout', function($timeout) {
  return {
    restrict: 'A',
    link : function($scope, $element) {
      $timeout(function() {
        $element[0].focus();
      }, 200);
    }
  }
}]);

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
.directive('dropdownx', function() {
    return {
        restrict: 'C',
        link: function(scope, element, attrs) {
            jQuery('html').on('click', function () { element.removeClass('open'); });
            jQuery('.dropdown-toggle', element).on('click', function(e) {
                var x = element.hasClass('open');
                jQuery('.dropdown').removeClass('open');
                if (!x)
                    element.toggleClass('open');
                return false;
            });
            scope.dropdownClose = function() {
                element.removeClass('open');
            };
            jQuery('.dropdown-close', element).on('click', function(e) {
                element.removeClass('open');
            });
        }
    }
})
.directive('flot', function() {
    return {
        restrict: 'C',
        replace: true,
        template: '<div></div>',
        
        link: function(scope, element, attrs) {
            var redraw = function(data) {
                jQuery.plot(jQuery(element), data, scope[attrs.flotOptions]);
            };
            scope.$watch(attrs.flotData, redraw, true);
        }
    }
})
.directive('modal', function($timeout) {
    var link = function(scope, elm, attrs) {
        var modal = jQuery(elm);

        // Escape event has to be declared so that when modal closes,
        // we only unbind modal escape and not everything
        var escapeEvent = function(e) {
            if (e.which == 27)
                closeModal();
        };

        var openModal = function(event, hasBackdrop, hasEscapeExit) {
            // Make click on backdrop close modal
            if (hasBackdrop === true) {
                //If no backdrop el, have to add it
                if (!document.getElementById('modal-backdrop')) {
                    jQuery('body').append(
                        '<div id="modal-backdrop" class="modal-backdrop"></div>'
                    );
                }
                jQuery('#modal-backdrop').
                    css({ display: 'block' });
                    //bind('click', closeModal);
            }

            // Make escape close modal
            if (hasEscapeExit === true)
                jQuery('body').bind('keyup', escapeEvent);
            
            //Add modal-open class to body
            jQuery('body').addClass('modal-open');

            //Find all the children with class close, 
            //and make them trigger close the modal on click
            jQuery('.close', modal).bind('click', closeModal);

            modal.css({ display: 'block' });
        };
        
        var closeModal = function(event) {
            jQuery('#modal-backdrop').
                unbind('click', closeModal).
                css({ display: 'none' });
            jQuery('body').
                unbind('keyup', escapeEvent).
                removeClass('modal-open');
            modal.css({ display: 'none' });
        };

        //Bind modalOpen and modalClose events, so outsiders can trigger it
        //We have to wait until the template has been fully put in to do this,
        //so we will wait 100ms
        $timeout(function() {
            modal.
                bind('modalOpen', openModal).
                bind('modalClose', closeModal);
        }, 100);
    };

    return {
        restrict: 'C',
        link: link
    };
})
.directive('modalOpen', function() {
    return {
        restrict: 'A',
        link: function(scope, elm, attrs) {
            var hasBackdrop = attrs.backdrop === undefined ? true : attrs.backdrop;
            var hasEscapeExit = attrs.escapeExit === undefined ? true : attrs.escapeExit;

            // Allow user to specify whether he wants it to open modal on click or what Defaults to click
            var eventType = attrs.modalEvent === undefined ? 'click' : eventType;
            
            jQuery(elm).bind(eventType, function() {
                jQuery('#' + attrs.modalOpen).trigger('modalOpen', [hasBackdrop, hasEscapeExit]);
            });
        }
    };
})
.directive('notify', function() {
    return {
        restrict: 'C',
        replace: true,
        transclude: true,
        template: '<div id="notify" style="display:none">' +
                '<div id="basic-template">' +
                    '<a class="ui-notify-cross ui-notify-close" href="#">x</a>' +
                    '<h1>#{title}</h1>' +
                    '<p>#{text}</p>' +
                '</div>' +
            '</div>',

        link: function(scope, elm, attrs) {
            var container = jQuery("#notify");
            container.notify({speed: 500, expires: 4000});
            scope.$on('notify', function(event, args) {
                container.notify("create", args); 
            });
        }
    };
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
// a drop down box that also allows user input
.directive('comboBox', function() {
    return {
        restrict: 'C',
        require: '?ngModel',
        replace: true,
        template: '<input type="hidden"></input>',
        
        link: function(scope, element, attrs, ngModel) {
            if (!ngModel) return;

            function qf(query) {
                var options = scope.$eval(attrs.data);;
                var data = {results: []};
                if (query.term.length == 0) {
                    data.results = angular.copy(options);
                }
                else {
                    angular.forEach(options, function(option) {if (option.text.search(new RegExp(".*" + query.term + ".*", "i")) >= 0) data.results.push(option);});
                }
                data.results.push({id: query.term, text: query.term});
                query.callback(data);
            };
            
            // update possible selections
            element.select2({query: qf});
            attrs.$observe('data', function() { 
                element.select2({query: qf});
                ngModel.$render();
             });
            
            // specify how UI should be updated
            ngModel.$render = function() {
                var text = ngModel.$viewValue;
                if (text  &&  text.substr(0, 16) == "ravenna_session:")
                    text = text.substr(16);
                element.select2('data', {id: ngModel.$viewValue, text: text});
            };
            
            // write data to the model
            function read() {
                ngModel.$setViewValue(element.val());            
            }
            
            // listen for change events to enable binding
            element.bind('blur keyup change', function() {
                scope.$apply(read);
            });
            read(); // initialize
        }
    }
})
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
                };
                
                var colors = rv.controllers.routing.colors; 
                function color(b) {
                    return colors[block(b)] || colors['default']
                };
                
                var port = parseInt($scope.port);
                var combine = parseInt($scope.combine) || 1;
                var temp = jQuery('<div class="rav-routing"/>');
                if (combine <= 8) {
                    for (var n = 0; n < combine; ++ n) {
                        var input = $scope.items[port + n];
                        if (input && input.in)
                            input = input.in;
                        temp.append('<div class="rav-routing-entry">' +
                            '<div class="rav-port-input" style="background-color:' + color(input) + '">'  + input + '</div>' +
                            '<i class="icon-long-arrow-right" />' +
                            '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">' + (port + n).toString() + '</div></div>');
                    }
                }
                else {
                    var input0 = $scope.items[0].in;
                    var input1 = $scope.items[combine - 1].in;
                    var b = block(input0);
                    for (var i = 1; i < combine; ++ i) {
                        if (block($scope.items[i].in) != b) {
                            input1 = "&nbsp;";
                            break;
                        }
                    }
                    temp.append('<div class="rav-routing-entry">' +
                        '<div class="rav-port-input" style="background-color:' + color(input0) + '">'  + input0 + '</div>' +
                        '<i class="icon-long-arrow-right" />' +
                        '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">0</div></div>');
                    temp.append('<div class="rav-routing-entry">' +
                        '<div class="rav-port-input" style="background-color:' + color(input1) + '">- '  + input1 + '</div>' +
                        '<i class="icon-long-arrow-right" />' +
                        '<div class="rav-port-output" style="background-color:' + color($scope.block) + '">- 63</div></div>');
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
                    var i = block.indexOf('/');
                    if (i > 0)
                        return colors[block.substring(0, i)]  ||  colors['default'];
                    return colors[block]  ||  colors['default']; 
                };
                    
                var port = parseInt($scope.port);
                var combine = parseInt($scope.combine) || 1;
                var temp = jQuery("<div/>");
                if (combine <= 8) {
                    var ports = "";
                        
                    for (var n = 0; n < combine; ++ n)
                        ports += '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">' + (port + n).toString() + '</div>';
                    
                    var x = jQuery('<div class="rav-ports" >' + ports + '</div>');
                    temp.append(x);
                }
                else {
                    temp.append('<div class="rav-ports">'
                            + '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">0</div>'
                            + '<div class="rav-port-input" style="background-color:' + color($scope.block) + '">- 63</div></div>');
                }
                c.children().detach();
                c.append(temp);
            };
            
            $scope.$watch('items', render, true);
            $scope.$watch('combine', render);
            
            render();
        }
    }
});

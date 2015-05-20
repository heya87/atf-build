/** 
 * Provides the _cometd service using the jquery/_cometd apis.
 * 
 * methods:
 *   connect(callback)
 *   isConnected()
 *   disconnect()
 *   subscribe(channel, callback)
 *   publish(message, args)
 *   command(message, args) 
 */
angular.module('rv.cometdServiceModule', [])
    .factory('ravennaCometdService', function() {
        var url = location.protocol + '//' + location.host + '/cometd';
        var c = {
            _cometd: $.cometd,
            _trackData: [],
            _connecting: false,
            _connected: false,
            _wasConnected: false,
            _connectCallbacks: [], // to be executed whenever a (re-) connect occured
            _subscriptionHandlers: [], // to be executed whenever a (re-) connect occured
            _settingsListeners: [],
            data: {},

            connect: function(callback) {
                if (callback) {
                    c._connectCallbacks.push(callback);
                    if (c._connected) {
                        callback();
                        return;
                    }
                }
                
                if (c._connecting)
                    return;

                c._cometd.websocketEnabled = true;
                c._cometd.configure({url: url});
                c._cometd.addListener('/meta/connect', angular.bind(c, c._metaConnect));
                c._cometd.handshake();
                
                c._connecting = true;
            },
            
            isConnected: function() {
                return c._connected  &&  c.data.identity;
            },
            
            disconnect: function() {
                c._cometd.disconnect();
                c._connecting = false;
                c._connected = false;
                c._wasConnected = false;
            },
            
            subscribe: function(channel, callback) {
                // mind subscribe for re-connects
                var v = []; // this variable will be captured by the delegate
                var subscriptionHandler = function(b) {
                    if (b)
                        v[0] = c._cometd.subscribe(channel, function(message) { setTimeout(function() { callback(message); }, 1); }); // make sure to call from outside of angular
                    else
                        c._cometd.unsubscribe(v[0]);
                }
                c._subscriptionHandlers.push(subscriptionHandler);
                
                if (c._connected)
                    subscriptionHandler(true); // we are already connected - subscribe now
                else
                    c.connect();
                
                return subscriptionHandler;
            },
            
            unsubscribe: function(subscriptionHandler) {
                subscriptionHandler(false); // unsubscribe
                
                for (var i = c._subscriptionHandlers.length - 1; i >= 0; -- i) {
                    if (c._subscriptionHandlers[i] == subscriptionHandler) {
                        c._subscriptionHandlers.splice(i, 1);
                        break;
                    }
                }
            },
            
            addSettingsListener: function(testfunc, callback) {
                var v = {tf: testfunc, cb: callback};
                c._settingsListeners.push(v);
                
                if (c._connected) {
                    if (testfunc(c.data))
                        setTimeout(function() { callback(c.data, c.data); }, 1); // make sure to not call from within angular framework
                }
                else
                    c.connect();
                    
                return v;
            },
            
            removeSettingsListener: function(listener) {
                for (var i = c._settingsListeners.length; i >= 0; -- i) {
                    if (c._settingsListeners[i] == listener)
                        c._settingsListeners.splice(i, 1);
                }
            },
            
            addListener: function(channel, func) {
                return c._cometd.addListener(channel, func);
            },
            
            publish: function(message, args) {
                c._trackData.push({args: args}); // mind args and changes in local array
                c._cometd.publish('/service/ravenna/settings', message);
            },
            
            command: function(message, args) {
                c._trackData.push({args: args}); // mind args and changes in local array
                c._cometd.publish('/service/ravenna/commands', message);
            },
                        
            _unsubscribe: function() {
                angular.forEach(c._subscriptionsCallbacks, function(v) { v(false); });
            },
    
            _connectionSucceeded: function() {
                c.data= {};
                c._trackData = [];
                
                c._cometd.startBatch();
                c._unsubscribe();
                c._connecting = false;
                c.subscribe('/ravenna/settings', c._handleSettings); // note: we are the first to get notified
                c.subscribe('/ravenna/commands', c._handleCommands); // note: we are the first to get notified
                angular.forEach(c._connectCallbacks, function(v) { v(); });
                angular.forEach(c._subscriptionHandlers, function(v) { try { v(true); } catch (e) { alert(e); } });
                c._cometd.publish('/service/ravenna/commands', { command: 'update' });
                c._cometd.endBatch();
            },
            
            _connectionBroken: function() {
                c._unsubscribe();
                c._connected = false;
            },
            
            _metaConnect: function(message) {
                c._connecting = false;
                c._wasConnected = c._connected;
                c._connected = (message.successful === true);
                if (!c._wasConnected  &&  c._connected)
                    c._connectionSucceeded();
                else if (c._wasConnected  &&  !c._connected)
                    c._connectionBroken();
            },
            
            _handleSettings: function(message) {
                var path = [];
                if (message.data.path)
                    path = c._parsePath(message.data.path);
                
                var newValue = c._setUsingPath({}, path, message.data.value);
                
                if (path.length == 0)
                    c.data = message.data.value;
                else
                    c._setUsingPath(c.data, path, message.data.value);

                angular.forEach(c._settingsListeners, function(entry) {
                    try {
                        if (entry.tf(newValue))
                            entry.cb(c.data);
                    }
                    catch (e) {
                        console.log(JSON.stringify(e));
                    }
                });
            },
            
            _handleCommands: function(message) {
                if (message.data.command == 'remove') {
                    if (!message.data.path)
                        return;
                        
                    var path = c._parsePath(message.data.path);
                    var obj = c._followPath(c.data, path.slice(0, path.length - 1));
                    delete obj[path[path.length - 1]];
                }
            },
            
            _parsePath: function(pathString) {
                var path = [];
                for (var i = 1; i < pathString.length; ++ i) {
                    if (pathString[i] == '[') {
                        ++ i;
                        if (pathString[i] == '\'') { // string
                            ++ i;
                            var end = pathString.indexOf('\'', i);
                            path.push(pathString.substring(i, end));
                            i = end + 1;
                        }
                        else { // number
                            var end = pathString.indexOf(']', i);
                            path.push(parseInt(pathString.substring(i, end)));
                            i = end;
                        }
                    }
                }
                return path;
            },
            
            _followPath: function(obj, path) {
                for (var i = 0; i < path.length; ++ i) {
                    if (!obj[path[i]])
                        obj[path[i]] = {};
                    obj = obj[path[i]];
                }
                return obj;
            },
            
            _setUsingPath: function(obj, path, value) {
                if (path.length == 0)
                    return value;
                
                var temp = obj;
                for (var i = 0; i < path.length - 1; ++ i) {
                    if (!temp[path[i]])
                        temp[path[i]] = {};
                    temp = temp[path[i]];
                }
                temp[path[i]] = value;
                return obj;
            }            
        };
    
        // disconnect when the page unloads using jQuery
        $(window).unload(function() {
           c.disconnect(); 
        });
        
        // from here onward comes the error handling code ...
        // using an extension we can record the assigned message id ...
        var trackHandler = {
            outgoing: function(message) {
                if (message.channel.substring(0, 9) == '/service/') {
                    var n = c._trackData.length;
                    if (n > 0)
                        c._trackData[n - 1].id = message.id;
                }
            }            
        };
        c._cometd.registerExtension('TrackHandler', trackHandler);
        // ... and match it against incoming messages
        var errorHandler = function(message) {
            // lookup the track data using the message id
            var trackData;
            for (var i = 0; i < c._trackData.length; i ++) {
                if (c._trackData[i].id == message.id) {
                    trackData = c._trackData[i];
                    c._trackData.splice(i, 1);
                    break;
                }
            }

            if (trackData === undefined)
                return;
            
            // check message status, take actions and call callbacks
            var args = trackData.args || {};
            if (message.successful) {
                if (args.onComplete)
                    args.onComplete(message);
            }
            else {
                if (args.onError)
                    args.onError(message.error);
            }
        };
        c._cometd.addListener('/meta/publish', errorHandler);
    
        return c;
    });

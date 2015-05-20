angular.module('rv.servicesModule', [])
/**
 * A simple service that calls the provided callback whenever configured IOs change. 
 */
.factory('ravennaIONamesService', function(ravennaCometdService) {
    // map with scope.$id and callback method
    var insListeners = {};
    var outsListeners = {};
    
    var ins = [];
    var outs = [];
    
    ravennaCometdService.addSettingsListener(
        function(data) { // test function
            return data.medias;
        },
        function(data) { // apply function
            // gather names of the configured IOs and build inputs lists
            ins = [];
            angular.forEach(data.medias, function(value, key) { if (value.configured   &&  value.inputs  &&  value.inputs["0"]) ins.push(key); });

            // call callbacks with the updated io names
            angular.forEach(insListeners, function(cb, key) { cb(ins); });
            
            // gather names of the configured IOs and build outputs lists
            outs = [];
            angular.forEach(data.medias, function(value, key) { if (value.configured   &&  value.outputs  &&  value.outputs["0"]) outs.push(key); });
            
            // call callbacks with the updated io names
            angular.forEach(outsListeners, function(cb, key) { cb(outs); });
        });
    
    var c = {
        addInsListener: function(scope, cb) {
            insListeners[scope.$id] = cb;
            
            setTimeout(function() { cb(ins); }, 1);
            
            scope.$on('$destroy', function() { 
                delete insListeners[scope.$id]; 
            });
        },                

        addOutsListener: function(scope, cb) {
            outsListeners[scope.$id] = cb;
            
            setTimeout(function() { cb(outs); }, 1);
            
            scope.$on('$destroy', function() { 
                delete outsListeners[scope.$id]; 
            });
        }                
    };
    return c;
})
/**
 * Parses an SDP into a JSON structure.
 * @todo this is currently very crude and only really parses a very simplistic RAVENNA sdp with a single stream
 * @param sdp the sdp string
 */
.factory('sdpParser', function() {
    return {
        parse: function(sdpString) {
            if (sdpString === undefined  ||  sdpString.length == 0)
                return undefined;
            
            var sdp = {};
            
            var name = sdpString.match(/(s=(.*))\r\n/);
            if (name  &&  name.length == 3)
                sdp.name = name[2];
            
            sdp.streams = [];
            sdp.streams[0] = {};
            
            var codecs = sdpString.match(/(a=rtpmap:[0-9]+ (.*)\/(.*)\/(.*))/);
            if (codecs  &&  codecs.length == 5) {
                sdp.streams[0].codec = codecs[2];
                sdp.streams[0].sampleRate = parseInt(codecs[3]);
                sdp.streams[0].channelCount = parseInt(codecs[4]);
            }
            
            var frameCount = sdpString.match(/(a=framecount:([0-9]+))/);
            if (frameCount  &&  frameCount.length == 3)
                sdp.streams[0].frameCount = parseInt(frameCount[2]);
            
            var channels = sdpString.match(/(i=(.*))/);
            if (channels  &&  channels.length == 3) {
                channels = channels[2].split(', ');
                sdp.streams[0].channels = channels;
            }
            else 
                sdp.streams[0].channels = new Array(sdp.streams[0].channelCount);

            return sdp;
        }
    };
})
/**
 * Preset handler.
 * @param stream a source stream
 * @param preset 'aes67', 'ravStereo', 'ravSurround', 'ravAESEBUStereo' or undefined
 */
.factory('presetHandler', function() {
    return {
        names: {
            aes67: 'AES67 Standard Stereo Stream',
            ravStereo: 'RAVENNA Stereo Stream',
            ravSurround: 'RAVENNA Surround Stream',
            ravAESEBUStereo: 'RAVENNA AES/EBU Stereo Stream'
        },
        colors: {
            aes67: '#49afcd',
            ravStereo: '#bfc81f',
            ravSurround: '#bfc81f',
            ravAESEBUStereo: '#bfc81f'
        },
         
        detect: function(sdp) {
            if (sdp  &&  sdp.streams  &&  sdp.streams[0]) {
               if (sdp.streams[0].frameCount == 48  &&  sdp.streams[0].codec == 'L24' &&  sdp.streams[0].sampleRate == 48000  &&  sdp.streams[0].channelCount == 2)
                   return 'aes67';
               if (sdp.streams[0].frameCount == 64  &&  sdp.streams[0].codec == 'L24' &&  sdp.streams[0].sampleRate == 48000  &&  sdp.streams[0].channelCount == 2)
                   return 'ravStereo';
               else if (sdp.streams[0].frameCount == 58  &&  sdp.streams[0].codec == 'L24' &&  sdp.streams[0].sampleRate == 48000  &&  sdp.streams[0].channelCount == 8)
                   return 'ravSurround'
               else if (sdp.streams[0].frameCount == 64  &&  sdp.streams[0].codec == 'AM824' &&  sdp.streams[0].sampleRate == 48000  &&  sdp.streams[0].channelCount == 2)
                   return 'ravAESEBUStereo';
            }
            return undefined;
        },
        
        detect2: function(scope, stream) {
            if (stream.map.length == 2  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 48)
                return 'aes67';
            if (stream.map.length == 2  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 64)
                return 'ravStereo';
            if (stream.map.length == 8  &&  stream.codec == 'L24'  &&  stream.codecParameters.frameSize == 58)
                return 'ravSurround';
            if (stream.map.length == 2  &&  stream.codec == 'AM824'  &&  stream.codecParameters.frameSize == 64)
                return 'ravAESEBUStereo';
            return '';
        },
         
        set: function(preset, scope, stream) {
            if (preset == 'aes67') {
                scope.channelCount = 2;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 48;
            }
            else if (preset == 'ravStereo') {
                scope.channelCount = 2;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 64;
            }
            else if (preset == 'ravSurround') {
                scope.channelCount = 8;
                stream.codec = 'L24';
                stream.codecParameters.frameSize = 58;
            }
            else if (preset == 'ravAESEBUStereo') {
                scope.channelCount = 2;
                stream.codec = 'AM824';
                stream.codecParameters.frameSize = 64;
            }
        }
    };
});

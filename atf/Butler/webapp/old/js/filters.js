angular.module('rv.filters', [])
    /** 
     * Creates an array of objects from an object of objects where the key is a number
     * @param input the source array
     */
    .filter('asArray', function() {
        return function(input) {
            if (!input) return [];
            var out = [];
            for (var i = 0; input[i]; ++ i) {
                out.push(input[i]);
                out[i].index = i;
            }
            return out;
        }
    })
    /**
     * Channel status filter
     */
    .filter('channelStatus', function(ravennaCometdService, $filter) {
        return function(channel) {
            if (channel.usedBy  &&  ravennaCometdService.data.sessions.sinks) {
                var sink = ravennaCometdService.data.sessions.sinks[channel.usedBy];
                var sinkName = $filter('sinkName');
                return channel.name + ' (in use by: ' + sinkName(sink) + ')';
            }
            return channel.name;
        }
    })
    // creates a list of channel names using the given channel map and the complete channel list
    .filter('channelMap', function() {
        return function(map, allChannels) {
            if (!map  ||  !allChannels)
                return "";
            
            var channels = [];
            for (var i = 0; i < map.length; ++ i) {
                if (map[i] === null  ||  map[i] < 0  ||  map[i] >= allChannels.length) // this should never happen
                    channels.push('-');
                else
                    channels.push(allChannels[map[i]].name);
            }
            return channels;
        }
    })
    // creates a short list of the given channel names (max. 4 channels) suitable for display
    .filter('channelList', function() {
        return function(channels) {
            if (!channels)
                return "";
            
            if (!angular.isArray(channels))
                return channels;
            
            var maxChannels = 4;
            var s = "";
            for (var i = 0; i < channels.length  &&  i < maxChannels; ++ i) {
                if (i > 0)
                    s += ", ";
                s += channels[i];
            }
            if (channels.length > maxChannels)
                s += ", ... (" + channels.length + ")";
            return s;
        }
    })
    .filter('sourceName', function() {
        return function(source) {
            return source.name ||  source.id;
        }
    })
    .filter('sourceURI', function() {
        return function(source) {
            if (source  &&  source.substr(0, 16) == "ravenna_session:")
                return source.substr(16);
            return source;
        }
    })
    .filter('dnssdTrim', function() {
        return function(uri) {
            return uri.replace("dnssd://", "").replace("._http._tcp", "");
        }
    })
    .filter('sourceURIs4comboBox', function() {
        return function(sources) {
            var options = [];
            angular.forEach(sources, function(el) { options.push({id: el, text: el.substr(16)}); }); // remove "ravenna_session:"
            return options;
        }
    })
    .filter('sinkName', function() {
        return function(sink) {
            return sink.name  ||  sink.id;
        }
    })
    .filter('range', function() {
        return function(input, total) {
            total = parseInt(total);
            for (var i = 0; i < total; ++ i)
                input.push(i);
            return input;
        }
    });
/**
 * Helper methods for sessions (sources and sinks)
 */ 
rv.controllers.session = {
    
    // evaluates if the given map is a block
    evalMapLinked: function(map) {
        var isMapLinked = true;
        if (map.length > 0) {
            if (map[0] === null)
                isMapLinked = false;
            for (var i = 1; i < map.length  &&  isMapLinked; i ++) {
                if (map[i] === null  ||  map[i] != map[0] + i)
                    isMapLinked = false;
            }
        }
        return isMapLinked;
    },
    
    // updates the map in case the channel count has changed
    updateMap: function(map, channelCount, isMapLinked) {
        while (map.length < channelCount  &&  map.length < 1024)
            map.push(0);
        if (channelCount < map.length)
            map.splice(channelCount);
        
        if (isMapLinked) {
            for (var i = 1; i < map.length; ++ i)
                map[i] = map[i -1] + 1;
        }
    }
};

/*
 * Map editor mode :
 * 0 = reading
 * 1 = add poi
 */

var EditorMode = Object.freeze({
    "READING": 0,
    "ADD_POI": 1,
    "FOLLOW_POSITION": 2,
    "POI_EDIT": 3,
    properties: {
        0: {
            name: "READING",
            value: 0
        },
        1: {
            name: "ADD_POI",
            value: 1
        },
        2: {
            name: "FOLLOW_POSITION",
            value: 1
        },
        3: {
            name: "POI_EDIT",
            value: 3
        }

    }
});

var MapManager = function() {
    this.map = L.map('editorMap', {
        editable: true
    }).setView([48.742917, -3.459180], 15);

    this.group = new L.featureGroup();

    this.group.addTo(this.map);
    this.waitingPoi = null;
    this.poiTypesMap = new Map();
    this.tracksMap = new Map();
    this.poiMap = new Map();

    this.currentPositionMarker;
    this.recordTrack = false;
    this.recordedTrack = null;
    this.recorder = null;
    this.intervalRecord = 5000;

    this.waypoints = [];

    this.distance = 0;
    this.currentEditID = 0;

    this.mode = EditorMode.READING;

    var keepThis = this;

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OSM</a>'
    }).addTo(this.map);

    var BackToLocationCtrl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.backgroundColor = 'white';
            container.style.width = '30px';
            container.style.height = '30px';
            container.style.backgroundImage = "url(../../img/icon-center-position.svg)";
            container.onclick = function() {
                keepThis.backToLocation();
            }
            return container;
        },
    });

    this.map.addControl(new BackToLocationCtrl());

};
MapManager.prototype.initialize = function() {
    /* MAP LISTENERS */
    var keepThis = this;

    this.map.addEventListener('click', function(e) {
        // console.log("Mode : "+EditorMode.properties[keepThis.mode].name);
        switch (keepThis.mode) {
            case EditorMode.READING:
                break;
            case EditorMode.ADD_POI:
                MicroModal.show('add-poi-popin');
                keepThis.waitingPoi = new Poi(keepThis.map);
                keepThis.waitingPoi.marker.setLatLng(e.latlng);
                //mapManager.addPoiFromClick(e);
                if (editor.activeTab = "pois-pan") keepThis.switchMode(EditorMode.POI_EDIT);
                else keepThis.switchMode(EditorMode.READING);
                document.getElementById("addPoiButton").classList.remove("add--poi");
                break;
            case EditorMode.TRACK_EDIT:
                break;
            case EditorMode.POI_EDIT:
                break;
            default:
                // console.log("Something goes wrong with the map editor mode. " + this.mode);
        }
    });

    this.map.addEventListener('drag', function() {
        keepThis.switchMode(EditorMode.READING);
    });

    if (localStorage.recordedTrack != undefined && localStorage.recordedTrack != "") {

        var track = new Track();
        track.fromJSON(localStorage.recordedTrack);

        document.getElementById('track-name').innerHTML = track.name;
        MicroModal.show("restart-calibration-popin");

        document.getElementById('res-popin-stop-calibration').addEventListener('click', function(){
            keepThis.recordedTrack = track;
            keepThis.stopCalibration();
            MicroModal.close("restart-calibration-popin");
        });

        document.getElementById('res-popin-restart-calibration').addEventListener('click', function(){
            keepThis.recordedTrack = track;
            keepThis.recordTrack = true;
            keepThis.recordedTrack.line.addTo(mapManager.map);
            keepThis.recorder = setInterval(function() {
                console.log("Record current location");
                keepThis.recordLocation();
            }, keepThis.intervalRecord);
            toggleCalibrationButtons();
            MicroModal.close("restart-calibration-popin");
        });

        document.getElementById('res-popin-abort-calibration').addEventListener('click', function(){
            mapManager.recordedTrack = null;
            mapManager.recordTrack = false;
            localStorage.recordedTrack = "";
            MicroModal.close("restart-calibration-popin");
        });
    }

    this.loadRessources();
    this.loadTracks(); //Load tracks
    this.loadPois(); //Load PoiS
    this.startFollowLocation(); //Start geolocation follow
}

MapManager.prototype.startCalibration = function(name, color) {
    var keepThis = this;
    if (!keepThis.recordTrack) {
        keepThis.recordedTrack = new Track();
        keepThis.recordedTrack.name = name;
        keepThis.recordedTrack.color = color;

        keepThis.recordedTrack.line.addTo(mapManager.map);

        keepThis.recordTrack = true;

        document.getElementById('recordStatusBar--distance').innerHTML = Math.round(10 * keepThis.recordedTrack.distance / 1000) / 10 + " Km";
        document.getElementById("recordStatusBar").classList.add('recordStatusBar--visible');

        localStorage.recordedTrack = keepThis.recordedTrack.toJSON();

        keepThis.recorder = setInterval(function() {
            console.log("Record current location");
            keepThis.recordLocation();
        }, keepThis.intervalRecord);

    } else {

    }
};

MapManager.prototype.stopCalibration = function() {
    var keepThis = this;
    JSONApiCall('PUT', "organizer/raid/" + raidID + "/track", this.recordedTrack.toJSON(), function(responseText, status) {
        if (status === 200) {
            track = JSON.parse(responseText);
            mapManager.addTrack(track);
            mapManager.recordedTrack = null;
            mapManager.recordTrack = false;
            localStorage.recordedTrack = "";
            toggleCalibrationButtons();
            clearInterval(keepThis.recorder);
            document.getElementById("recordStatusBar").classList.remove('recordStatusBar--visible');
        } else {
            // console.log("Status de la réponse: %d (%s)", xhr_object.status, xhr_object.statusText);
        }
    });
};

MapManager.prototype.startFollowLocation = function() {
    var keepThis = this;
    var positionWatchId = navigator.geolocation.watchPosition(
        function(e) {
            let latLng = new L.LatLng(e.coords.latitude, e.coords.longitude);
            if (keepThis.mode == EditorMode.FOLLOW_POSITION) {
                mapManager.updateCurrentPosition(latLng);
            }
        }, null, {
            'enableHighAccuracy': true
        });
    mapManager.switchMode(EditorMode.FOLLOW_POSITION);
}

MapManager.prototype.backToLocation = function() {

    console.log("backToLocation");
    mapManager.switchMode(EditorMode.FOLLOW_POSITION);
    navigator.geolocation.getCurrentPosition(
        function(e) {
            let latLng = new L.LatLng(e.coords.latitude, e.coords.longitude);
            console.log(latLng);
            mapManager.updateCurrentPosition(latLng);
        }, null, {
            'enableHighAccuracy': true
        });
}

MapManager.prototype.recordLocation = function() {
    var keepThis = this;
    navigator.geolocation.getCurrentPosition(
        function(e) {
            let latLng = new L.LatLng(e.coords.latitude, e.coords.longitude);
            keepThis.recordedTrack.line.addLatLng(latLng);
            keepThis.recordedTrack.calculDistance();

            localStorage.recordedTrack = keepThis.recordedTrack.toJSON();

            document.getElementById('recordStatusBar--distance').innerHTML = Math.round(10 * keepThis.recordedTrack.distance / 1000) / 10 + " Km";
        }, null, {
            'enableHighAccuracy': true
        });
}

MapManager.prototype.addPoiAtCurrentLocation = function(){

    document.getElementById('addPoi_name').value="";
    document.getElementById('addPoi_nbhelper').value="";

    navigator.geolocation.getCurrentPosition(
        function(e) {
            let latLng = new L.LatLng(e.coords.latitude, e.coords.longitude);
            MicroModal.show('add-poi-popin');
        }, null, {
            'enableHighAccuracy': true
        });
}

MapManager.prototype.loadRessources = function() {
    var keepThis = this;
    apiCall('GET', "organizer/poitype", null, function(responseText, status) {
        if (status === 200) {

            var select = document.getElementById('addPoi_type');
            var html = "";
            var poiTypes = JSON.parse(responseText);
            for (poiType of poiTypes) {
                keepThis.poiTypesMap.set(poiType.id, poiType);
                html += "<option value='"+poiType.id+"'>"+poiType.type+"</option>";
            }
            select.innerHTML = html;
        } else {
            // console.log("Status de la réponse: %d (%s)", xhr_object.status, xhr_object.statusText);
        }
    });
}

MapManager.prototype.switchMode = function(mode) {
    if (this.mode != mode) this.lastMode = this.mode;
    this.mode = mode;
    // console.log("Switch mode to : "+EditorMode.properties[mode].name);
    switch (mode) {
        case EditorMode.ADD_POI:
            this.setPoiEditable(false);
            break;
        case EditorMode.POI_EDIT:
            document.getElementById('addPoiButton').classList.remove("add--poi");
            document.querySelectorAll('.track--edit').forEach(function(el) {
                el.classList.remove('track--edit')
            })
            this.setPoiEditable(true);
            break;
        case EditorMode.READING:
            document.getElementById('addPoiButton').classList.remove("add--poi");
            this.setPoiEditable(false);
            break;
    }
}

MapManager.prototype.addTrack = function(track) {
    newTrack = new Track(this.map);
    newTrack.fromObj(track);
    this.tracksMap.set(track.id, newTrack);

    var li = document.createElement('li');
    li = newTrack.buildUI(li);

    document.querySelector('.editor--list').appendChild(li);
}

MapManager.prototype.showTrack = function(id) {
    this.tracksMap.get(id).show();
}

MapManager.prototype.hideTrack = function(id) {
    this.tracksMap.get(id).hide();
}

MapManager.prototype.requestNewPoi = function(name, type, requiredHelpers) {
    var poi = this.waitingPoi;
    poi.name = name;
    poi.poiType = mapManager.poiTypesMap.get(parseInt(type));
    poi.requiredHelpers = parseInt(requiredHelpers);

    JSONApiCall('PUT', "organizer/raid/" + raidID + "/poi", poi.toJSON(), function(responseText, status) {
        if (status === 200) {
            poi = JSON.parse(responseText);
            mapManager.addPoi(poi);
        } else {
            //   console.log("Status de la réponse: %d (%s)", xhr_object.status, xhr_object.statusText);
        }
    });
}

MapManager.prototype.loadTracks = function() {
    apiCall('GET', "organizer/raid/" + raidID + "/track", null, function(responseText, status) {
        if (status === 200) {
            // console.log("Réponse reçue: %s", xhr_object.responseText);
            var tracks = JSON.parse(responseText);
            for (track of tracks) {
                mapManager.addTrack(track);
            }
            mapManager.map.fitBounds(mapManager.group.getBounds());

        } else {
            //  console.log("Status de la réponse: %d (%s)", xhr_object.status, xhr_object.statusText);
        }
        mapManager.switchMode(EditorMode.FOLLOW_POSITION);
    });
}

MapManager.prototype.loadPois = function() {
    apiCall('GET', "organizer/raid/" + raidID + "/poi", null, function(responseText, status) {
        if (status === 200) {
            // console.log("Réponse reçue: %s", xhr_object.responseText);
            var pois = JSON.parse(responseText);
            for (poi of pois) {
                mapManager.addPoi(poi);
            }
            mapManager.map.fitBounds(mapManager.group.getBounds());
        } else {
            // console.log("Status de la réponse: %d (%s)", xhr_object.status, xhr_object.statusText);
        }
        mapManager.switchMode(EditorMode.FOLLOW_POSITION);
    });
}


MapManager.prototype.addPoi = function(poi) {
    newPoi = new Poi(this.map);
    newPoi.fromObj(poi);
    this.poiMap.set(poi.id, newPoi);
}

MapManager.prototype.setPoiEditable = function(b) {
    this.poiMap.forEach(function(value, key, map) {
        value.setEditable(b);
    })
}

MapManager.prototype.updateCurrentPosition = function(latLng) {

    console.log(latLng);
    this.map.setView(latLng, 20);

    if (this.currentPositionMarker == null) {

        var icon = L.icon({
            iconUrl: '../../img/currentPositionMarker.png',

            iconSize:     [50, 50], // size of the icon
            iconAnchor:   [25, 25], // point of the icon which will correspond to marker's location
            popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
        });


        this.currentPositionMarker = L.marker(latLng, {icon: icon}).addTo(this.map);
    } else {
        this.currentPositionMarker.setLatLng(latLng);
    }
}

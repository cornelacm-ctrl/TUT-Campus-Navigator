const map = L.map('map').setView(
    [-25.7545, 28.2314],
    16
);

L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19
    }
).addTo(map);

navigator.geolocation.getCurrentPosition(
    function(position){

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        map.setView([lat,lng],18);

        L.marker([lat,lng])
            .addTo(map)
            .bindPopup("You are here")
            .openPopup();
    }
);
L.marker([-25.732823, 28.164855])
.addTo(map)
.bindPopup("Building 6");

L.marker([-25.732704, 28.165733])
.addTo(map)
.bindPopup("Building 6 Parking Lot 3");

L.marker([-25.733536, 28.164270])
.addTo(map)
.bindPopup("Building 6 Parking Lot 1");

L.marker([-25.733236, 28.164968])
.addTo(map)
.bindPopup("Building 6 Parking Lot 2");

L.marker([-25.731770, 28.165387])
.addTo(map)
.bindPopup("Building 7 Theunis Bester Hall");

L.marker([-25.731919, 28.165107])
.addTo(map)
.bindPopup("Building 7 Parking Lot");

L.marker([-25.731957, 28.164450])
.addTo(map)
.bindPopup("Building 5 Parking Lot");

L.marker([-25.732202, 28.164422])
.addTo(map)
.bindPopup("Building 5");

L.marker([-25.732144, 28.163585])
.addTo(map)
.bindPopup("Building 3");




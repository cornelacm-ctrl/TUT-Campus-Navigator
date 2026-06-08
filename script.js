const map = L.map('map').setView(
    [-25.732365, 28.161859],
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

        map.setView([-25.734012, 28.163396/*lat,lng*/],18);

        L.marker([lat,lng])
            .addTo(map)
            .bindPopup("You are here")
            .openPopup();
    }
);


locations.forEach(loc => {
  L.marker([loc.lat, loc.lng])
    .addTo(map)
    .bindPopup(loc.name);
});

document.getElementById("searchBox").addEventListener("input", function (e) {
  const query = e.target.value.toLowerCase();

  const match = locations.find(loc =>
    loc.name.toLowerCase().includes(query)
  );

  if (match) {
    map.setView([match.lat, match.lng], 18);

    L.popup()
      .setLatLng([match.lat, match.lng])
      .setContent(match.name)
      .openOn(map);
  }
});


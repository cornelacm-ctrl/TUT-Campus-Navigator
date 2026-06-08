let manualStart = null;
const campusCenter = [-25.734012, 28.163396];

const map = L.map('map').setView(campusCenter, 16);

L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19
    }
).addTo(map);

locations.forEach(loc => {
  L.marker([loc.lat, loc.lng])
    .addTo(map)
    .bindPopup(loc.name);
});

document.getElementById("searchBox").addEventListener("input", (e) => {

  const query = e.target.value.toLowerCase();
  if (!query) return;

  const matches = locations.filter(loc =>
  loc.name.toLowerCase().includes(query)
);

});

let userMarker;
let userLat, userLng;

function setStartLocation(lat, lng) {
  manualStart = { lat, lng };
}

function showUserLocation() {

  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition(position => {

    userLat = position.coords.latitude;
    userLng = position.coords.longitude;

    if (userMarker) {
      userMarker.setLatLng([userLat, userLng]);
    } else {
      userMarker = L.marker([userLat, userLng])
        .addTo(map)
        .bindPopup("📍 You are here");
    }

  }, error => {
    console.log(error);
    alert("Unable to get location");
  }, {
    enableHighAccuracy: true
  });
}

showUserLocation();

let routeControl;



function openPopup(match) {

  map.setView([match.lat, match.lng], 18);

  L.popup()
    .setLatLng([match.lat, match.lng])
    .setContent(`
      <b>${match.name}</b><br><br>
      <button onclick="goToDestination(${match.lat}, ${match.lng})">
        🧭 Go here
      </button>
    `)
    .openOn(map);
}

function goToDestination(destLat, destLng) {

  const start = manualStart || (userLat ? { lat: userLat, lng: userLng } : null);

  if (!start) {
    alert("No start location set");
    return;
  }

  if (routeControl) {
    map.removeControl(routeControl);
  }

  routeControl = L.Routing.control({
    waypoints: [
      L.latLng(start.lat, start.lng),
      L.latLng(destLat, destLng)
    ],
    routeWhileDragging: false
  }).addTo(map);
}

function loadSidebar() {

  const container = document.getElementById("buildingList");

  locations.forEach(loc => {

    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.borderBottom = "1px solid #eee";

    div.innerHTML = `
  <b>${loc.name}</b><br>

  <button onclick='openPopup(${JSON.stringify(loc)})'>
    Open
  </button>

  <button onclick='goToDestination(${loc.lat}, ${loc.lng})'>
    Navigate
  </button>

  <button onclick='setStartLocation(${loc.lat}, ${loc.lng})'>
    Set as Start
  </button>
`;

    container.appendChild(div);
  });
}

loadSidebar();


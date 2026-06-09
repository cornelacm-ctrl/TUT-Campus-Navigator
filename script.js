let manualStart = null;

const campusCenter = [-25.734012, 28.163396];

const map = L.map('map').setView(campusCenter, 16);
window.map = map;

L.tileLayer(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19 }
).addTo(map);

const locationMarkers = L.layerGroup().addTo(map);
const graphMarkers = L.layerGroup().addTo(map);

function serializeForInline(value) {
  return JSON.stringify(value).replace(/'/g, "\\u0027");
}

function normalizePoint(locationOrLat, lng) {
  if (typeof locationOrLat === "object" && locationOrLat !== null) {
    return locationOrLat;
  }

  return { lat: locationOrLat, lng };
}

function loadLocations() {

  if (!window.locations) return;

  locationMarkers.clearLayers();

  locations.forEach(loc => {
    const locationJson = serializeForInline(loc);

    L.marker([loc.lat, loc.lng])
      .addTo(locationMarkers)
      .bindPopup(`
        <b>${loc.name}</b><br><br>
        <button onclick='goToDestination(${locationJson})'>
          Navigate
        </button>
        <button onclick='setStartLocation(${locationJson})'>
          Set as Start
        </button>
      `);
  });
}

loadLocations();

document.getElementById("searchBox").addEventListener("input", (e) => {

  const query = e.target.value.toLowerCase();
  if (!query) return;

  const matches = locations.filter(loc =>
    loc.name.toLowerCase().includes(query)
  );

  if (matches.length === 0) return;

  const first = matches[0];

  map.setView([first.lat, first.lng], 17);

  let html = "<b>Results</b><br><br>";

  matches.forEach(m => {
    const locationJson = serializeForInline(m);

    html += `
      <div style="margin-bottom:8px;">
        <b>${m.name}</b><br>
        <button onclick='openPopup(${locationJson})'>
          Open
        </button>
        <button onclick='goToDestination(${locationJson})'>
          Navigate
        </button>
      </div>
    `;
  });

  L.popup()
    .setLatLng([first.lat, first.lng])
    .setContent(html)
    .openOn(map);
});


let userMarker;
let userLat, userLng;

function setStartLocation(locationOrLat, lng) {
  manualStart = normalizePoint(locationOrLat, lng);

  alert(`Start location saved${manualStart.name ? `: ${manualStart.name}` : ""}`);
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
  const locationJson = serializeForInline(match);

  map.setView([match.lat, match.lng], 18);

  L.popup()
    .setLatLng([match.lat, match.lng])
    .setContent(`
      <b>${match.name}</b><br><br>
      <button onclick='goToDestination(${locationJson})'>
        Navigate
      </button>
      <button onclick='setStartLocation(${locationJson})'>
        Set as Start
      </button>
    `)
    .openOn(map);
}

function goToDestination(locationOrLat, lng) {
  if (!window.graphNodes || !window.findShortestRoute || !window.drawPath) {
    alert("Campus node graph is not loaded");
    return;
  }

  const startPoint = manualStart || (
    userLat !== undefined && userLng !== undefined ? { lat: userLat, lng: userLng } : null
  );

  if (!startPoint) {
    alert("Please allow location access or set a start location first");
    return;
  }

  const endPoint = normalizePoint(locationOrLat, lng);
  const route = findShortestRoute(startPoint, endPoint, {
    startLocation: manualStart,
    endLocation: endPoint
  });

  if (route.path.length === 0) {
    alert("No node route found between those points yet");
    return;
  }

  if (routeControl) map.removeLayer(routeControl);

  routeControl = drawPath(route.path).addTo(map);
  map.fitBounds(routeControl.getBounds(), { padding: [40, 40] });

  console.log("Start node:", route.startNodeId);
  console.log("End node:", route.endNodeId);
  console.log("Route distance:", `${Math.round(route.distance)}m`);
  console.log("Node path:", route.path);
}

function loadSidebar() {

  const container = document.getElementById("buildingList");
  container.innerHTML = "";

  locations.forEach(loc => {
    const locationJson = serializeForInline(loc);

    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.borderBottom = "1px solid #eee";

    div.innerHTML = `
  <b>${loc.name}</b><br>

  <button onclick='openPopup(${locationJson})'>
    Open
  </button>

  <button onclick='goToDestination(${locationJson})'>
    Navigate
  </button>

  <button onclick='setStartLocation(${locationJson})'>
    Set as Start
  </button>
`;

    container.appendChild(div);
  });
}

loadSidebar();

function renderGraphNodes() {
  if (!window.graphNodes) return;

  graphMarkers.clearLayers();

  Object.keys(graphNodes).forEach(id => {

    const node = graphNodes[id];

    const color =
      node.type === "entrance" ? "green" :
      node.type === "indoor" ? "purple" :
      node.type === "junction" ? "blue" :
      "gray";

    const marker = L.circleMarker([node.lat, node.lng], {
      radius: 6,
      color: color
    })
    .addTo(graphMarkers)
    .bindPopup(id);

    marker.on("click", () => {
      if (window.adminSelectGraphNode) {
        window.adminSelectGraphNode(id);
      }
    });
  });
}

renderGraphNodes();

window.renderCampusLocations = loadLocations;
window.renderCampusSidebar = loadSidebar;
window.renderGraphNodes = renderGraphNodes;

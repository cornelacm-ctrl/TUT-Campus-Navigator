(function () {
  const map = window.map;
  const panel = document.getElementById("adminPanel");
  const toggleButton = document.getElementById("adminToggle");
  const closeButton = document.getElementById("adminClose");
  const loginForm = document.getElementById("adminLoginForm");
  const tools = document.getElementById("adminTools");
  const usernameInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const modeSelect = document.getElementById("adminMode");
  const itemForm = document.getElementById("adminItemForm");
  const itemNameInput = document.getElementById("adminItemName");
  const itemNameLabel = document.getElementById("adminNameLabel");
  const latInput = document.getElementById("adminLat");
  const lngInput = document.getElementById("adminLng");
  const roadTools = document.getElementById("adminRoadTools");
  const roadFromSelect = document.getElementById("adminRoadFrom");
  const roadToSelect = document.getElementById("adminRoadTo");
  const addRoadButton = document.getElementById("adminAddRoad");
  const showConnectionsInput = document.getElementById("adminShowConnections");
  const saveButton = document.getElementById("adminSave");
  const logoutButton = document.getElementById("adminLogout");
  const statusElement = document.getElementById("adminStatus");

  if (!map || !panel || !toggleButton) return;

  const locationTypes = {
    building: "building",
    parking: "parking",
    gate: "Gate",
    point: "point"
  };
  const graphTypes = {
    junction: "junction",
    indoor: "indoor",
    entrance: "entrance"
  };
  const roadLayer = L.layerGroup().addTo(map);
  const connectionLayer = L.layerGroup().addTo(map);
  const apiBase = window.location.port === "3000" ? "" : "http://localhost:3000";

  let adminToken = localStorage.getItem("campusAdminToken") || "";
  let previewMarker = null;
  let roadFrom = "";
  let roadTo = "";

  function setStatus(message, isError) {
    statusElement.textContent = message || "";
    statusElement.classList.toggle("error", Boolean(isError));
  }

  function setToolsVisible(isVisible) {
    loginForm.hidden = isVisible;
    tools.hidden = !isVisible;
    updateModeUi();
  }

  function togglePanel(forceVisible) {
    panel.hidden = forceVisible === undefined ? !panel.hidden : !forceVisible;

    if (panel.hidden) {
      roadLayer.clearLayers();
      connectionLayer.clearLayers();
    } else {
      updateModeUi();
    }
  }

  function formatCoord(value) {
    return Number(value).toFixed(6);
  }

  function setSelectedLatLng(lat, lng) {
    latInput.value = formatCoord(lat);
    lngInput.value = formatCoord(lng);

    if (previewMarker) {
      previewMarker.setLatLng([lat, lng]);
    } else {
      previewMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#d97706",
        fillColor: "#fbbf24",
        fillOpacity: 0.5
      }).addTo(map);
    }

    if ((modeSelect.value === "junction" || modeSelect.value === "indoor") &&
      itemNameInput.dataset.generated !== "false") {
      itemNameInput.value = getNextGraphNodeId(modeSelect.value);
      itemNameInput.dataset.generated = "true";
    }
  }

  function getNumericCoordinate(input) {
    const value = Number(input.value);

    return Number.isFinite(value) ? value : null;
  }

  function lettersToNumber(letters) {
    return letters.split("").reduce((total, letter) => {
      return total * 26 + letter.charCodeAt(0) - 96;
    }, 0);
  }

  function numberToLetters(number) {
    let value = number;
    let letters = "";

    while (value > 0) {
      value -= 1;
      letters = String.fromCharCode(97 + (value % 26)) + letters;
      value = Math.floor(value / 26);
    }

    return letters || "a";
  }

  function getNextGraphNodeId(mode) {
    const nodeIds = Object.keys(window.graphNodes || {});
    const prefix = mode === "indoor" ? "indoor_" : "node_";
    const pattern = new RegExp(`^${prefix}([a-z]+)$`);
    const maxNodeNumber = nodeIds.reduce((maxValue, nodeId) => {
      const match = nodeId.match(pattern);

      return match ? Math.max(maxValue, lettersToNumber(match[1])) : maxValue;
    }, 0);

    return `${prefix}${numberToLetters(maxNodeNumber + 1)}`;
  }

  function getGraphNodeIds() {
    return Object.keys(window.graphNodes || {}).sort((a, b) => a.localeCompare(b));
  }

  function setSelectOptions(select, ids, selectedValue) {
    select.innerHTML = `<option value="">Select node</option>`;

    ids.forEach(id => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      option.selected = id === selectedValue;
      select.appendChild(option);
    });
  }

  function refreshRoadSelects() {
    const ids = getGraphNodeIds();

    setSelectOptions(roadFromSelect, ids, roadFrom);
    setSelectOptions(roadToSelect, ids, roadTo);
  }

  function renderManualRoads() {
    roadLayer.clearLayers();

    if (panel.hidden || tools.hidden || modeSelect.value !== "road") return;

    const seenEdges = new Set();
    const nodes = window.graphNodes || {};
    const edges = window.manualGraphEdges || {};

    Object.keys(edges).forEach(from => {
      (edges[from] || []).forEach(to => {
        if (!nodes[from] || !nodes[to]) return;

        const key = [from, to].sort().join("::");
        if (seenEdges.has(key)) return;
        seenEdges.add(key);

        const indoorConnection = isIndoorConnection(from, to);

        L.polyline(
          [
            [nodes[from].lat, nodes[from].lng],
            [nodes[to].lat, nodes[to].lng]
          ],
          {
            color: indoorConnection ? "#7c3aed" : "#f97316",
            dashArray: "8 6",
            opacity: 0.9,
            weight: 4
          }
        )
          .addTo(roadLayer)
          .bindPopup(`${from} to ${to}`);
      });
    });
  }

  function getEdgeKey(from, to) {
    return [from, to].sort().join("::");
  }

  function isManualRoad(from, to) {
    return (window.manualGraphEdges[from] || []).includes(to) ||
      (window.manualGraphEdges[to] || []).includes(from);
  }

  function isIndoorConnection(from, to) {
    const nodes = window.graphNodes || {};

    return nodes[from] && nodes[to] &&
      (nodes[from].type === "indoor" || nodes[to].type === "indoor");
  }

  function renderGraphConnections() {
    connectionLayer.clearLayers();

    if (!showConnectionsInput.checked || panel.hidden || tools.hidden) return;

    const seenEdges = new Set();
    const nodes = window.graphNodes || {};
    const edges = window.graphEdges || {};

    Object.keys(edges).forEach(from => {
      (edges[from] || []).forEach(to => {
        if (!nodes[from] || !nodes[to]) return;

        const key = getEdgeKey(from, to);
        if (seenEdges.has(key)) return;
        seenEdges.add(key);

        const manualRoad = isManualRoad(from, to);
        const indoorConnection = isIndoorConnection(from, to);

        L.polyline(
          [
            [nodes[from].lat, nodes[from].lng],
            [nodes[to].lat, nodes[to].lng]
          ],
          {
            color: indoorConnection ? "#7c3aed" : manualRoad ? "#f97316" : "#64748b",
            dashArray: manualRoad ? "8 6" : null,
            opacity: manualRoad || indoorConnection ? 0.95 : 0.55,
            weight: manualRoad ? 4 : 2
          }
        )
          .addTo(connectionLayer)
          .bindPopup(`${from} to ${to}`);
      });
    });
  }

  function updateModeUi() {
    const mode = modeSelect.value;
    const isRoadMode = mode === "road";
    const isGraphMode = Boolean(graphTypes[mode]);

    itemForm.hidden = isRoadMode;
    roadTools.hidden = !isRoadMode;
    itemNameLabel.textContent = isGraphMode ? "Node / Entrance ID" : "Name";

    if ((mode === "junction" || mode === "indoor") &&
      (!itemNameInput.value || itemNameInput.dataset.generated === "true")) {
      itemNameInput.value = getNextGraphNodeId(mode);
      itemNameInput.dataset.generated = "true";
    }

    if (mode === "entrance") {
      itemNameInput.placeholder = "building21 Entrance A";
    } else if (mode === "indoor") {
      itemNameInput.placeholder = "indoor_a";
    } else if (mode === "junction") {
      itemNameInput.placeholder = "node_u";
    } else {
      itemNameInput.placeholder = "Building 21";
    }

    refreshRoadSelects();
    renderManualRoads();
    renderGraphConnections();
  }

  async function postJson(url, body, requiresAuth) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (requiresAuth) {
      headers.Authorization = `Bearer ${adminToken}`;
    }

    const response = await fetch(`${apiBase}${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const responseText = await response.text();
    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        data = {};
      }
    }

    if (!response.ok) {
      const message = data.error || responseText || "Request failed";
      const error = new Error(`${message} (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  async function saveAdminData(successMessage) {
    try {
      await postJson(
        "/api/admin/save",
        {
          locations: window.locations || [],
          graphNodes: window.graphNodes || {},
          manualGraphEdges: window.manualGraphEdges || {}
        },
        true
      );
      setStatus(successMessage || "Saved files");

      return true;
    } catch (error) {
      if (error.status === 401) {
        adminToken = "";
        localStorage.removeItem("campusAdminToken");
        setToolsVisible(false);
        setStatus("Admin session expired. Log in again.", true);

        return false;
      }

      const serverHint = error.status === 404 || error.status === 405 || error.name === "TypeError"
        ? ` Make sure npm start is running at http://localhost:3000.`
        : "";

      setStatus(
        `${error.message}.${serverHint}`,
        true
      );

      return false;
    }
  }

  function upsertLocation(location) {
    const existingIndex = window.locations.findIndex(item =>
      item.name.toLowerCase() === location.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      window.locations[existingIndex] = location;
    } else {
      window.locations.push(location);
    }

    if (window.renderCampusLocations) window.renderCampusLocations();
    if (window.renderCampusSidebar) window.renderCampusSidebar();
  }

  function upsertGraphNode(id, node) {
    window.graphNodes[id] = node;

    if (window.rebuildGraphEdges) window.rebuildGraphEdges();
    if (window.renderGraphNodes) window.renderGraphNodes();

    refreshRoadSelects();
    renderManualRoads();
    renderGraphConnections();
  }

  function addManualRoad(from, to) {
    if (!from || !to || from === to) {
      setStatus("Choose two different nodes for the road.", true);
      return false;
    }

    if (!window.graphNodes[from] || !window.graphNodes[to]) {
      setStatus("Both road endpoints must be graph nodes.", true);
      return false;
    }

    if (!window.manualGraphEdges[from]) window.manualGraphEdges[from] = [];
    if (!window.manualGraphEdges[to]) window.manualGraphEdges[to] = [];
    if (!window.manualGraphEdges[from].includes(to)) window.manualGraphEdges[from].push(to);
    if (!window.manualGraphEdges[to].includes(from)) window.manualGraphEdges[to].push(from);

    if (window.rebuildGraphEdges) window.rebuildGraphEdges();
    renderManualRoads();
    renderGraphConnections();

    return true;
  }

  async function handleItemSubmit(event) {
    event.preventDefault();

    const mode = modeSelect.value;
    const lat = getNumericCoordinate(latInput);
    const lng = getNumericCoordinate(lngInput);
    const name = itemNameInput.value.trim();

    if (!name) {
      setStatus("Enter a name or node ID.", true);
      return;
    }

    if (lat === null || lng === null) {
      setStatus("Click the map or enter valid coordinates.", true);
      return;
    }

    if (locationTypes[mode]) {
      upsertLocation({
        name,
        type: locationTypes[mode],
        lat,
        lng
      });
    } else if (graphTypes[mode]) {
      upsertGraphNode(name, {
        lat,
        lng,
        type: graphTypes[mode]
      });
    }

    const saved = await saveAdminData(`${name} saved`);

    if (saved && (mode === "junction" || mode === "indoor")) {
      itemNameInput.value = getNextGraphNodeId(mode);
      itemNameInput.dataset.generated = "true";
    }
  }

  function selectRoadNode(nodeId) {
    if (!adminToken || panel.hidden || modeSelect.value !== "road") return;

    if (!roadFrom || (roadFrom && roadTo)) {
      roadFrom = nodeId;
      roadTo = "";
    } else if (nodeId !== roadFrom) {
      roadTo = nodeId;
    }

    refreshRoadSelects();

    if (roadFrom && roadTo) {
      setStatus(`${roadFrom} to ${roadTo} selected`);
    } else {
      setStatus(`${roadFrom} selected`);
    }
  }

  function selectNearestRoadNode(latlng) {
    if (!window.findNearestNode || !window.distance) return false;

    const point = { lat: latlng.lat, lng: latlng.lng };
    const nearestId = window.findNearestNode(point);
    const nearestNode = nearestId ? window.graphNodes[nearestId] : null;

    if (!nearestNode || window.distance(point, nearestNode) > 25) return false;

    selectRoadNode(nearestId);
    return true;
  }

  window.adminSelectGraphNode = selectRoadNode;

  toggleButton.addEventListener("click", () => {
    togglePanel();
  });

  closeButton.addEventListener("click", () => {
    togglePanel(false);
  });

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    try {
      const data = await postJson(
        "/api/admin/login",
        {
          username: usernameInput.value.trim(),
          password: passwordInput.value
        },
        false
      );

      adminToken = data.token;
      localStorage.setItem("campusAdminToken", adminToken);
      passwordInput.value = "";
      setToolsVisible(true);
      setStatus("Logged in");
    } catch (error) {
      setStatus(`${error.message}. Start the site with npm start.`, true);
    }
  });

  logoutButton.addEventListener("click", () => {
    adminToken = "";
    localStorage.removeItem("campusAdminToken");
    setToolsVisible(false);
    setStatus("");
    roadLayer.clearLayers();
  });

  modeSelect.addEventListener("change", () => {
    updateModeUi();
  });

  showConnectionsInput.addEventListener("change", () => {
    renderGraphConnections();
  });

  itemNameInput.addEventListener("input", () => {
    itemNameInput.dataset.generated = "false";
  });

  itemForm.addEventListener("submit", handleItemSubmit);

  roadFromSelect.addEventListener("change", () => {
    roadFrom = roadFromSelect.value;
  });

  roadToSelect.addEventListener("change", () => {
    roadTo = roadToSelect.value;
  });

  addRoadButton.addEventListener("click", async () => {
    roadFrom = roadFromSelect.value;
    roadTo = roadToSelect.value;

    if (!addManualRoad(roadFrom, roadTo)) return;

    await saveAdminData(`${roadFrom} to ${roadTo} saved`);
  });

  saveButton.addEventListener("click", () => {
    saveAdminData("Saved files");
  });

  map.on("click", event => {
    if (!adminToken || panel.hidden || tools.hidden) return;

    if (modeSelect.value === "road") {
      if (!selectNearestRoadNode(event.latlng)) {
        setStatus("Click an existing node marker or choose nodes from the lists.", true);
      }

      return;
    }

    setSelectedLatLng(event.latlng.lat, event.latlng.lng);
    setStatus("Point selected");
  });

  setToolsVisible(Boolean(adminToken));
  updateModeUi();
})();

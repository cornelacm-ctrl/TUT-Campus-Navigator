const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";
const sessions = new Set();
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);
const graphNodeTypes = new Set(["junction", "entrance", "indoor"]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(data));
}

function sendError(response, statusCode, error) {
  sendJson(response, statusCode, { error });
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;

  if (!origin || !allowedOrigins.has(origin)) return;

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1] : "";
}

function requireAdmin(request, response) {
  const token = getBearerToken(request);

  if (!token || !sessions.has(token)) {
    sendError(response, 401, "Admin login required");
    return false;
  }

  return true;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => {
      body += chunk;

      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const body = await readRequestBody(request);

  if (!body) return {};

  return JSON.parse(body);
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 160);
}

function cleanCoordinate(value) {
  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
}

function isValidLatLng(lat, lng) {
  return lat !== null && lng !== null &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
}

function sanitizeLocations(locations) {
  if (!Array.isArray(locations)) return [];

  const seenNames = new Set();
  const cleanLocations = [];

  locations.forEach(location => {
    const name = cleanText(location.name);
    const type = cleanText(location.type, "point");
    const lat = cleanCoordinate(location.lat);
    const lng = cleanCoordinate(location.lng);
    const key = name.toLowerCase();

    if (!name || seenNames.has(key) || !isValidLatLng(lat, lng)) return;

    seenNames.add(key);
    cleanLocations.push({ name, type, lat, lng });
  });

  return cleanLocations;
}

function sanitizeGraphNodes(graphNodes) {
  if (!graphNodes || typeof graphNodes !== "object" || Array.isArray(graphNodes)) return {};

  const cleanNodes = {};

  Object.entries(graphNodes).forEach(([id, node]) => {
    const nodeId = cleanText(id);
    const lat = cleanCoordinate(node.lat);
    const lng = cleanCoordinate(node.lng);
    const rawType = cleanText(node.type, "junction").toLowerCase();
    const type = graphNodeTypes.has(rawType) ? rawType : "junction";

    if (!nodeId || !isValidLatLng(lat, lng)) return;

    cleanNodes[nodeId] = { lat, lng, type };
  });

  return cleanNodes;
}

function addEdge(edges, from, to) {
  if (!edges[from]) edges[from] = [];
  if (!edges[to]) edges[to] = [];
  if (!edges[from].includes(to)) edges[from].push(to);
  if (!edges[to].includes(from)) edges[to].push(from);
}

function sanitizeManualGraphEdges(manualGraphEdges, graphNodes) {
  if (!manualGraphEdges || typeof manualGraphEdges !== "object" || Array.isArray(manualGraphEdges)) return {};

  const cleanEdges = {};

  Object.entries(manualGraphEdges).forEach(([from, targets]) => {
    const fromId = cleanText(from);

    if (!graphNodes[fromId] || !Array.isArray(targets)) return;

    targets.forEach(target => {
      const toId = cleanText(target);

      if (!graphNodes[toId] || fromId === toId) return;

      addEdge(cleanEdges, fromId, toId);
    });
  });

  return cleanEdges;
}

function formatData(value) {
  return JSON.stringify(value, null, 2);
}

async function writeLocationsFile(locations) {
  const filePath = path.join(rootDir, "locations.js");
  const source = `const locations = ${formatData(locations)};\n\nwindow.locations = locations;\n`;

  await fs.writeFile(filePath, source, "utf8");
}

async function writeGraphFile(graphNodes, manualGraphEdges) {
  const filePath = path.join(rootDir, "graph.js");
  let source = await fs.readFile(filePath, "utf8");
  const graphNodesPattern = /const graphNodes = [\s\S]*?;\n\nconst manualGraphEdges =/;
  const manualEdgesPattern = /const manualGraphEdges = [\s\S]*?;\n\nconst autoEdgeSettings =/;

  if (!graphNodesPattern.test(source) || !manualEdgesPattern.test(source)) {
    throw new Error("Could not find graph.js data blocks");
  }

  source = source.replace(
    graphNodesPattern,
    `const graphNodes = ${formatData(graphNodes)};\n\nconst manualGraphEdges =`
  );

  source = source.replace(
    manualEdgesPattern,
    `const manualGraphEdges = ${formatData(manualGraphEdges)};\n\nconst autoEdgeSettings =`
  );

  await fs.writeFile(filePath, source, "utf8");
}

async function handleLogin(request, response) {
  const body = await readJsonBody(request);
  const username = cleanText(body.username || adminUsername);
  const password = String(body.password || "");

  if (username !== adminUsername || password !== adminPassword) {
    sendError(response, 401, "Invalid username or password");
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  sendJson(response, 200, { token });
}

async function handleSave(request, response) {
  if (!requireAdmin(request, response)) return;

  const body = await readJsonBody(request);
  const locations = sanitizeLocations(body.locations);
  const graphNodes = sanitizeGraphNodes(body.graphNodes);
  const manualGraphEdges = sanitizeManualGraphEdges(body.manualGraphEdges, graphNodes);

  await writeLocationsFile(locations);
  await writeGraphFile(graphNodes, manualGraphEdges);

  sendJson(response, 200, {
    ok: true,
    locations: locations.length,
    graphNodes: Object.keys(graphNodes).length,
    manualEdges: Object.values(manualGraphEdges).reduce((total, edges) => total + edges.length, 0) / 2
  });
}

async function serveStatic(request, response, url) {
  const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(rootDir, rawPath));
  const relativePath = path.relative(rootDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (request.method === "POST" && pathname === "/api/admin/login") {
      await handleLogin(request, response);
      return;
    }

    if (request.method === "POST" && pathname === "/api/admin/save") {
      await handleSave(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response, url);
      return;
    }

    sendError(response, 405, "Method not allowed");
  } catch (error) {
    sendError(response, 500, error.message || "Server error");
  }
});

server.listen(port, () => {
  console.log(`Campus Navigator running at http://localhost:${port}`);
  console.log(`Admin login: ${adminUsername} / ${adminPassword}`);
});

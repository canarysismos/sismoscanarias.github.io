const API_BASE = "https://api.quakes.earth";
let map, markersLayer, fp, markers = [];

// Helpers
const pad2 = n => String(n).padStart(2, "0");
const formatDDMMYYYY = d => `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
const toLocalHHMMSS = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function parseLastUpdate(val) {
  if (val == null) return null;
  if (typeof val === "number") return new Date(val * 1000);
  if (typeof val === "string") {
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim().match(/^\d+(\.\d+)?$/)) return new Date(num * 1000);
    const iso = new Date(val);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  return null;
}

// Color spectrum based on magnitude
function colorForMag(mag) {
  if (mag < 1) return "#FFFF99"; // light yellow
  if (mag < 2) return "#FFD700"; // yellow-orange
  if (mag < 3) return "#FF8C00"; // orange
  if (mag < 4) return "#FF4500"; // red
  return "#B22222";             // dark red
}

// Calculate marker radius
function calcRadius(mag, zoom) {
  return Math.max(3, (mag * 3) + zoom * 0.6);
}

function initMap() {
  map = L.map("map").setView([28.3, -16.6], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  // Animate marker resizing on zoom
  map.on("zoom", () => {
    const zoom = map.getZoom();
    markers.forEach(({ marker, mag }) => {
      const newRadius = calcRadius(mag, zoom);
      animateMarkerRadius(marker, newRadius);
    });
  });
}

// Smooth transition helper
function animateMarkerRadius(marker, newRadius) {
  const start = marker.options.radius;
  const diff = newRadius - start;
  const duration = 300; // 300ms for smoothness
  const startTime = performance.now();

  function step(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = start + diff * progress;
    marker.setRadius(eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

async function loadEarthquakes(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch(`${API_BASE}/day?date=${encodeURIComponent(dateStr)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected payload");

    markersLayer.clearLayers();
    markers = [];

    data.forEach(eq => {
      const lat = Number(eq.lat ?? eq.latitude);
      const lon = Number(eq.lon ?? eq.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;

      const mag = Number(eq.mag ?? eq.magnitud ?? eq.magnitude ?? 0) || 0;
      const prof = eq.prof ?? eq.profundidad ?? eq.prof_km ?? eq.depth ?? "";
      const loc = eq.localizacion ?? eq.loc ?? eq.localidad ?? "—";
      const fecha = eq.fecha ?? "—";
      const hora = eq.hora ?? "—";

      const zoom = map.getZoom();
      const radius = calcRadius(mag, zoom);

      const marker = L.circleMarker([lat, lon], {
        radius,
        color: "#000",
        weight: 1,
        fillColor: colorForMag(mag),
        fillOpacity: 0.85,
      });

      // Inside loadEarthquakes(), replace marker.bindPopup(...) with:
       marker.bindPopup(
  `<div class="quake-popup">
      <h3>${loc}</h3>
      <p><b>Fecha:</b> ${fecha} ${hora}</p>
      <p><b>Magnitud:</b> ${mag}</p>
      <p><b>Profundidad:</b> ${prof} km</p>
  </div>`,
  { className: "quake-popup-container" }
);

      markersLayer.addLayer(marker);
      markers.push({ marker, mag });
    });
  } catch (e) {
    console.error("loadEarthquakes failed:", e);
  }
}
const API_BASE = "https://api.quakes.earth";
let map, markersLayer, fp;

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

function initMap() {
  map = L.map("map").setView([28.3, -16.6], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

async function loadEarthquakes(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch(`${API_BASE}/day?date=${encodeURIComponent(dateStr)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected payload");

    markersLayer.clearLayers();

    data.forEach(eq => {
      const lat = Number(eq.lat ?? eq.latitude);
      const lon = Number(eq.lon ?? eq.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;

      const mag = Number(eq.mag ?? eq.magnitud ?? eq.magnitude ?? 0) || 0;
      const prof = eq.prof ?? eq.profundidad ?? eq.prof_km ?? eq.depth ?? "";
      const loc = eq.localizacion ?? eq.loc ?? eq.localidad ?? "—";
      const fecha = eq.fecha ?? "—";
      const hora = eq.hora ?? "—";

      // Dynamically scale radius based on zoom + magnitude
      const zoom = map.getZoom();
      const radius = Math.max(3, (mag * 3) + zoom * 0.6);

      const marker = L.circleMarker([lat, lon], {
        radius,
        color: "#000",
        weight: 1,
        fillColor: colorForMag(mag),
        fillOpacity: 0.85,
      });

      marker.bindPopup(
        `<b>${loc}</b><br/>${fecha} ${hora}<br/><b>Magnitud:</b> ${mag}<br/><b>Profundidad:</b> ${prof} km`
      );

      markersLayer.addLayer(marker);
    });
  } catch (e) {
    console.error("loadEarthquakes failed:", e);
  }
}
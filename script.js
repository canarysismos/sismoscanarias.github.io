const API_BASE = "https://api.quakes.earth";
let map, markersLayer, markers = [];

// ---------- Helpers ----------
const pad2 = n => String(n).padStart(2, "0");
const formatDDMMYYYY = d => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const toLocalHHMMSS = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function parseLastUpdate(val) {
    if (!val) return null;
    if (typeof val === "number") return new Date(val * 1000);
    if (typeof val === "string") {
        const num = Number(val);
        if (!Number.isNaN(num) && /^\d+(\.\d+)?$/.test(val.trim())) return new Date(num * 1000);
        const iso = new Date(val);
        if (!Number.isNaN(iso.getTime())) return iso;
    }
    return null;
}

// ---------- Marker Colors by Magnitude ----------
function colorForMag(mag) {
    if (isNaN(mag)) return "#999999";  // Default gray
    if (mag < 1) return "#FFFF99";    // Light yellow
    if (mag < 2) return "#FFD700";    // Yellow-orange
    if (mag < 3) return "#FF8C00";    // Orange
    if (mag < 4) return "#FF4500";    // Red
    return "#B22222";                 // Dark red
}

// ---------- Marker Radius ----------
function calcRadius(mag, zoom) {
    const m = Number.isFinite(mag) ? Math.max(0, mag) : 0.8;
    const z = Number.isFinite(zoom) ? zoom : 7;
    const size = 6 + (m * 4.0) + (z * 0.9);
    return Math.max(6, Math.min(size, 36));
}

// ---------- Initialize the Map ----------
function initMap() {
    map = L.map("map").setView([28.3, -16.6], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    map.on("zoom", () => {
        const zoom = map.getZoom();
        markers.forEach(({ marker, mag }) => {
            const target = calcRadius(mag, zoom);
            animateMarkerRadius(marker, target);
        });
    });
}

// ---------- Animate Marker Size ----------
function animateMarkerRadius(marker, newRadius) {
    const start = marker.options.radius;
    const diff = newRadius - start;
    const duration = 300;
    const startTime = performance.now();

    function step(ts) {
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = start + diff * progress;
        marker.setRadius(eased);
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

// ---------- Load Earthquake Data ----------
async function loadEarthquakes(dateStr) {
    if (!dateStr) return;

    try {
        const res = await fetch(`${API_BASE}/day?date=${encodeURIComponent(dateStr)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let data;
        try {
            data = await res.json();
        } catch (err) {
            console.error("Invalid JSON:", err);
            data = [];
        }

        if (!Array.isArray(data)) {
            console.warn("Unexpected payload format:", data);
            data = [];
        }

        markersLayer.clearLayers();
        markers = [];

        if (data.length === 0) {
            console.warn(`No earthquakes found for ${dateStr}`);
            return;
        }

        data.forEach(eq => {
            const lat = Number(eq.lat ?? eq.latitude);
            const lon = Number(eq.lon ?? eq.longitude);
            if (Number.isNaN(lat) || Number.isNaN(lon)) return;

            const mag = Number(eq.mag ?? eq.magnitud ?? eq.magnitude ?? 0) || 0;
            const prof = eq.prof ?? eq.profundidad ?? eq.prof_km ?? eq.depth ?? "—";
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
                fillOpacity: 0.9
            });

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

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    const today = formatDDMMYYYY(new Date());
    loadEarthquakes(today);
});
const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands

// Base OpenStreetMap layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

let earthquakeLayer = L.layerGroup().addTo(map);

// Colors by magnitude
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

// Marker size proportional to magnitude
function getRadius(mag) {
    return mag > 0 ? mag * 3.5 : 3;
}

// Plot earthquakes
function plotEarthquakes(data) {
    earthquakeLayer.clearLayers();
    data.forEach(eq => {
        const marker = L.circleMarker([eq.lat, eq.lon], {
            radius: getRadius(eq.mag),
            color: getColor(eq.mag),
            fillOpacity: 0.6,
            weight: 1
        });
        marker.bindPopup(`
            <b>${eq.title || "Earthquake"}</b><br>
            <b>Magnitude:</b> ${eq.mag}<br>
            <b>Depth:</b> ${eq.depth} km<br>
            <b>Time:</b> ${eq.time}<br>
            <a target="_blank" href="https://maps.google.com/?q=${eq.lat},${eq.lon}">
                🌍 View on Google Maps
            </a>
        `);
        marker.addTo(earthquakeLayer);
    });
}

// Load data from API
async function loadData(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        plotEarthquakes(data);
    } catch (err) {
        console.error(`Failed to fetch ${endpoint}:`, err);
    }
}

// Load initial data
loadData("/historical");
loadData(`/day/${new Date().toISOString().split("T")[0]}`);

// Auto-refresh today's data every 15 min
setInterval(() => {
    loadData(`/day/${new Date().toISOString().split("T")[0]}`);
}, 15 * 60 * 1000);

// Date picker handler
document.getElementById("date-picker").addEventListener("change", (e) => {
    const date = e.target.value;
    if (date) {
        loadData(`/day/${date}`);
    }
});
const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands center

// OpenStreetMap base tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// Marker colors based on magnitude
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :    // red
           mag >= 3 ? "#ff6600" :    // orange
           mag >= 2 ? "#ffcc00" :    // yellow
                       "#00cc66";    // green
}

// Marker size proportional to magnitude
function getRadius(mag) {
    return mag > 0 ? mag * 3.5 : 3;
}

// Plot earthquakes on map
function plotEarthquakes(data) {
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

        marker.addTo(map);
    });
}

// Load historical data
async function loadHistorical() {
    try {
        const res = await fetch(`${API_BASE}/historical`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        plotEarthquakes(data);
    } catch (err) {
        console.error("Failed to load historical data:", err);
    }
}

// Load today's data
async function loadToday() {
    try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`${API_BASE}/day/${today}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        plotEarthquakes(data);
    } catch (err) {
        console.error("Failed to load today's data:", err);
    }
}

// Initial load
loadHistorical();
loadToday();

// Auto-refresh today's earthquakes every 15 minutes
setInterval(loadToday, 15 * 60 * 1000);
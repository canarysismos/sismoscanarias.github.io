const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands center

// OpenStreetMap base layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// Layer for earthquakes
let earthquakeLayer = L.layerGroup().addTo(map);

// Get marker color based on magnitude
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :    // strong → red
           mag >= 3 ? "#ff6600" :    // moderate → orange
           mag >= 2 ? "#ffcc00" :    // light → yellow
                       "#00cc66";    // weak → green
}

// Marker size proportional to magnitude
function getRadius(mag) {
    return mag > 0 ? mag * 3.5 : 3;
}

// Plot earthquakes on the map
function plotEarthquakes(data) {
    earthquakeLayer.clearLayers();

    data.forEach(eq => {
        if (!eq.lat || !eq.lon || isNaN(eq.lat) || isNaN(eq.lon)) return;

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

// Parse the raw historical data file
async function loadHistorical() {
    try {
        const res = await fetch(`${API_BASE}/historical`);
        const rawText = await res.text();
        const lines = rawText.split("\n").filter(line => line.trim().length > 0);

        const data = lines.map(line => {
            const parts = line.trim().split(/\s+/);

            // IGN format assumption: YYYY-MM-DD HH:MM:SS LAT LON MAG DEPTH LOCATION...
            return {
                time: `${parts[0]} ${parts[1]}`,
                lat: parseFloat(parts[2]),
                lon: parseFloat(parts[3]),
                mag: parseFloat(parts[4]),
                depth: parseFloat(parts[5]),
                title: parts.slice(6).join(" ") || "Unknown location"
            };
        });

        plotEarthquakes(data);
    } catch (err) {
        console.error("Failed to load historical data:", err);
    }
}

// Load earthquakes for a specific day
async function loadDay(date) {
    try {
        const res = await fetch(`${API_BASE}/day/${date}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rawText = await res.text();
        const lines = rawText.split("\n").filter(line => line.trim().length > 0);

        const data = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                time: `${parts[0]} ${parts[1]}`,
                lat: parseFloat(parts[2]),
                lon: parseFloat(parts[3]),
                mag: parseFloat(parts[4]),
                depth: parseFloat(parts[5]),
                title: parts.slice(6).join(" ") || "Unknown location"
            };
        });

        plotEarthquakes(data);
    } catch (err) {
        console.error(`Failed to load data for ${date}:`, err);
    }
}

// Initial load → full history + today's data
loadHistorical();
loadDay(new Date().toISOString().split("T")[0]);

// Auto-refresh today's data every 15 minutes
setInterval(() => {
    loadDay(new Date().toISOString().split("T")[0]);
}, 15 * 60 * 1000);

// Date picker event
document.getElementById("date-picker").addEventListener("change", (e) => {
    const date = e.target.value;
    if (date) {
        loadDay(date);
    }
});
const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands center

// Add OpenStreetMap base tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// Create a layer for earthquake markers
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
    return mag && !isNaN(mag) ? mag * 3.5 : 3;
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
            <b>${eq.title || "Terremoto"}</b><br>
            <b>Fecha:</b> ${eq.fecha} ${eq.hora}<br>
            <b>Magnitud:</b> ${eq.mag || "N/A"} (${eq.tipo_mag})<br>
            <b>Profundidad:</b> ${eq.depth} km<br>
            <a target="_blank" href="https://www.openstreetmap.org/?mlat=${eq.lat}&mlon=${eq.lon}&zoom=12">
                🌍 Ver en OpenStreetMap
            </a>
        `);

        marker.addTo(earthquakeLayer);
    });
}

// Load historical earthquakes
async function loadHistorical() {
    try {
        const res = await fetch(`${API_BASE}/historical`);
        const data = await res.json();
        console.log(`Loaded ${data.length} historical earthquakes`);
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
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes for ${date}`);
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

// Handle date picker changes
document.getElementById("date-picker").addEventListener("change", (e) => {
    const date = e.target.value;
    if (date) {
        // Convert YYYY-MM-DD → DD/MM/YYYY for IGN format
        const [year, month, day] = date.split("-");
        const formatted = `${day}/${month}/${year}`;
        loadDay(formatted);
    }
});
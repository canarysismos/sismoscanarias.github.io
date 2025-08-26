const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands center

// Add OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

let earthquakeLayer = L.layerGroup().addTo(map);

// Color based on magnitude
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

// Radius proportional to magnitude
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

// Load all historical earthquakes
async function loadHistorical() {
    try {
        const res = await fetch(`${API_BASE}/historical`);
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes`);
        plotEarthquakes(data);
    } catch (err) {
        console.error("Failed to load historical data:", err);
    }
}

// Load earthquakes for a specific date (IGN format: DD/MM/YYYY)
async function loadDay(date) {
    try {
        const res = await fetch(`${API_BASE}/day/${date}`);
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes for ${date}`);
        plotEarthquakes(data);
    } catch (err) {
        console.error(`Failed to load data for ${date}:`, err);
    }
}

// Initial load → full history + today's data
loadHistorical();

// Fix: Convert JS date YYYY-MM-DD → IGN format DD/MM/YYYY
function getIGNDateFormat() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// Load today's earthquakes in IGN date format
loadDay(getIGNDateFormat());

// Auto-refresh every 15 min
setInterval(() => {
    loadDay(getIGNDateFormat());
}, 15 * 60 * 1000);

// Handle date picker → convert to IGN format DD/MM/YYYY
document.getElementById("date-picker").addEventListener("change", (e) => {
    const date = e.target.value;
    if (date) {
        const [year, month, day] = date.split("-");
        const formatted = `${day}/${month}/${year}`;
        loadDay(formatted);
    }
});

const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7); // Canary Islands center

// Add OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

// Layer for earthquake markers
let earthquakeLayer = L.layerGroup().addTo(map);

// HTML elements
const datePicker = document.getElementById("date-picker");
const dateLabel = document.getElementById("selected-date-label");

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

// Get today's date in ISO format (YYYY-MM-DD) for the <input type="date">
function getTodayISO() {
    const today = new Date();
    return today.toISOString().split("T")[0];
}

// Convert YYYY-MM-DD → DD/MM/YYYY for API
function toIGNDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
}

// Update the date label on the page (DD/MM/YYYY)
function updateDateLabel(isoDate) {
    dateLabel.textContent = `Fecha seleccionada: ${toIGNDate(isoDate)}`;
}

// Load earthquakes for a given ISO date
async function loadQuakesByISODate(isoDate) {
    const ignDate = toIGNDate(isoDate);
    try {
        const res = await fetch(`${API_BASE}/day/${ignDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes for ${ignDate}`);
        plotEarthquakes(data);
        updateDateLabel(isoDate);
    } catch (err) {
        console.error(`Failed to load data for ${ignDate}:`, err);
    }
}

// Handle date picker change → load new data
datePicker.addEventListener("change", (e) => {
    loadQuakesByISODate(e.target.value);
});

// Initialize to today's date on page load
const todayISO = getTodayISO();
datePicker.value = todayISO;
loadQuakesByISODate(todayISO);

// Auto-refresh currently selected date every 15 minutes
setInterval(() => {
    const isoDate = datePicker.value;
    loadQuakesByISODate(isoDate);
}, 15 * 60 * 1000);
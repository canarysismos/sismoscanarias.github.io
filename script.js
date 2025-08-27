const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);

// OpenStreetMap tiles
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

// Plot earthquakes on map
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

// Load earthquakes for a specific date
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

// Convert today's date into IGN format DD/MM/YYYY
function getIGNDateFormat() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// Convert YYYY-MM-DD → DD/MM/YYYY for API
function toIGNDateFormat(input) {
    const [year, month, day] = input.split("-");
    return `${day}/${month}/${year}`;
}

// Set default value in date picker (YYYY-MM-DD for input element)
function setDatePickerToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("date-picker").value = `${yyyy}-${mm}-${dd}`;
}

// Handle date picker change
document.getElementById("date-picker").addEventListener("change", (e) => {
    const date = e.target.value;
    if (date) {
        const formatted = toIGNDateFormat(date);
        console.log(`Date changed to ${formatted}`);
        loadDay(formatted);
    }
});

// Initialize → set picker to today + load today's data
setDatePickerToday();
loadDay(getIGNDateFormat());

// Auto-refresh data for currently selected date every 15 minutes
setInterval(() => {
    const pickerValue = document.getElementById("date-picker").value;
    const formatted = toIGNDateFormat(pickerValue);
    loadDay(formatted);
}, 15 * 60 * 1000);
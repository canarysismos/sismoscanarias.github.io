const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);

// OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

let earthquakeLayer = L.layerGroup().addTo(map);

// DOM elements
const datePicker = document.getElementById("date-picker");
const dateLabel = document.getElementById("selected-date-label");

// --- Utility functions ---
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

function getRadius(mag) {
    return mag && !isNaN(mag) ? mag * 3.5 : 3;
}

function toIGNDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
}

function updateDateLabel(isoDate) {
    dateLabel.textContent = `Fecha seleccionada: ${toIGNDate(isoDate)}`;
}

// --- Plot markers on the map ---
function plotEarthquakes(data) {
    earthquakeLayer.clearLayers();

    if (!data || data.length === 0) {
        alert("ℹ️ No earthquakes recorded on this date.");
        return;
    }

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

// --- Load earthquakes for specific date ---
async function loadQuakesByISODate(isoDate) {
    const ignDate = toIGNDate(isoDate);
    console.log(`Fetching data for ${ignDate}...`);

    try {
        const res = await fetch(`${API_BASE}/day?date=${ignDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes for ${ignDate}`);
        plotEarthquakes(data);
        updateDateLabel(isoDate);
    } catch (err) {
        console.error(`Failed to load data for ${ignDate}:`, err);
    }
}

// --- Fetch the latest active date and set it as default ---
async function setInitialDate() {
    try {
        const res = await fetch(`${API_BASE}/latest-date`);
        const json = await res.json();

        if (json.latest) {
            const [day, month, year] = json.latest.split("/");
            const isoDate = `${year}-${month}-${day}`;
            datePicker.value = isoDate;
            loadQuakesByISODate(isoDate);
        } else {
            console.warn("No earthquake data available.");
        }
    } catch (err) {
        console.error("Failed to fetch latest date:", err);
    }
}

// --- Date picker event listener ---
datePicker.addEventListener("change", (e) => {
    const isoDate = e.target.value;
    if (isoDate) loadQuakesByISODate(isoDate);
});

// --- Auto-refresh markers every 15 minutes ---
setInterval(() => {
    const isoDate = datePicker.value;
    loadQuakesByISODate(isoDate);
}, 15 * 60 * 1000);

// --- Initialize page ---
setInitialDate();
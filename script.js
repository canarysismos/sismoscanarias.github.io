const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

let earthquakeLayer = L.layerGroup().addTo(map);

const datePicker = document.getElementById("date-picker");
const dateLabel = document.getElementById("selected-date-label");

// Init custom date picker → force DD/MM/YYYY
flatpickr(datePicker, {
    dateFormat: "d/m/Y", // DD/MM/YYYY
    defaultDate: new Date(),
    onChange: function(selectedDates, dateStr) {
        if (dateStr) {
            loadQuakes(dateStr); // Send correct format directly
        }
    }
});

function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

function getRadius(mag) {
    return mag && !isNaN(mag) ? mag * 3.5 : 3;
}

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

async function loadQuakes(ignDate) {
    try {
        const res = await fetch(`${API_BASE}/day?date=${ignDate}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`Loaded ${data.length} earthquakes for ${ignDate}`);
        plotEarthquakes(data);
        dateLabel.textContent = `Fecha seleccionada: ${ignDate}`;
    } catch (err) {
        console.error(`Failed to load data for ${ignDate}:`, err);
    }
}

// Initialize today’s earthquakes
const today = new Date();
const todayDD = String(today.getDate()).padStart(2, "0");
const todayMM = String(today.getMonth() + 1).padStart(2, "0");
const todayYYYY = today.getFullYear();
const todayIGN = `${todayDD}/${todayMM}/${todayYYYY}`;

loadQuakes(todayIGN);

// Auto-refresh selected date every 15 minutes
setInterval(() => {
    const date = datePicker.value;
    if (date) loadQuakes(date);
}, 15 * 60 * 1000);
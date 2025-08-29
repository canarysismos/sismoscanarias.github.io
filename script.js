// =============================
//  Global Variables
// =============================
let map;
let markersLayer;
let lastSelectedDate = null;
const API_BASE = "https://api.quakes.earth";

// =============================
//  Initialize Map
// =============================
function initMap() {
    map = L.map("map").setView([28.3, -16.6], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

// =============================
//  Load Earthquake Markers
// =============================
async function loadEarthquakes(date) {
    if (!date) return;

    try {
        const res = await fetch(`${API_BASE}/day?date=${date}`);
        const data = await res.json();

        markersLayer.clearLayers();

        data.forEach(eq => {
            const marker = L.circleMarker([eq.lat, eq.lon], {
                radius: eq.mag >= 4 ? 7 : 5,
                fillColor: eq.mag >= 4 ? "#ff0000" : "#ffaa00",
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });

            marker.bindPopup(`
                <b>${eq.fecha} ${eq.hora}</b><br>
                <b>Mag:</b> ${eq.mag} ML<br>
                <b>Profundidad:</b> ${eq.profundidad} km<br>
                <b>Localización:</b> ${eq.localizacion}
            `);

            markersLayer.addLayer(marker);
        });
    } catch (err) {
        console.error("[ERROR] Failed loading earthquakes:", err);
    }
}

// =============================
//  Status Bar Updater
// =============================
async function updateStatus() {
    const statusBar = document.getElementById("status-bar");
    statusBar.textContent = "Cargando estado…";

    try {
        const res = await fetch(`${API_BASE}/status`);
        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();

        const lastUpdate = new Date(data.last_update);
        const now = new Date();
        const diffMins = Math.floor((now - lastUpdate) / 60000);

        statusBar.innerHTML = `
            Última actualización: <b>${lastUpdate.toLocaleDateString("es-ES")}</b>, 
            ${lastUpdate.toLocaleTimeString("es-ES")} 
            (${diffMins}m) · ⚡ Hoy: ${data.today} · 📚 Total: ${data.total}
        `;
    } catch (err) {
        console.error("[ERROR] Status fetch failed:", err);
        statusBar.textContent = "Estado no disponible";
    }
}

// =============================
//  Initialize Date Picker
// =============================
function initDatePicker() {
    const dateInput = document.getElementById("date-picker");

    flatpickr(dateInput, {
        dateFormat: "d/m/Y",
        defaultDate: lastSelectedDate || new Date(),
        allowInput: true,
        locale: "es",
        clickOpens: true,
        onChange: function(selectedDates, dateStr) {
            if (dateStr) {
                lastSelectedDate = dateStr;
                loadEarthquakes(dateStr);
            }
        }
    });
}

// =============================
//  Initialization
// =============================
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    initDatePicker();
    updateStatus();

    // Load today's quakes by default
    const today = new Date().toLocaleDateString("es-ES");
    lastSelectedDate = today;
    loadEarthquakes(today);

    // Refresh status every 60 sec
    setInterval(updateStatus, 60000);
});
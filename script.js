const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);

// =========================
// Calendar Setup
// =========================
const datePicker = flatpickr("#date-picker", {
    dateFormat: "d/m/Y",
    locale: "es",
    defaultDate: new Date(),
    clickOpens: true,
    onChange: (selectedDates, dateStr) => {
        loadEarthquakes(dateStr);
    }
});

// Icon opens the picker
document.getElementById("calendar-icon").addEventListener("click", () => {
    datePicker.open();
});

// =========================
// Fetch Earthquake Data
// =========================
async function loadEarthquakes(date) {
    try {
        const res = await fetch(`${API_BASE}/day?date=${date}`);
        const data = await res.json();

        markersLayer.clearLayers();

        data.forEach(eq => {
            const marker = L.circleMarker([eq.lat, eq.lon], {
                radius: Math.max(eq.mag * 2.5, 4),
                fillColor: getColor(eq.mag),
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            });

            marker.bindPopup(`
                <strong>${eq.fecha} ${eq.hora}</strong><br>
                <b>Mag:</b> ${eq.mag}<br>
                <b>Prof:</b> ${eq.prof} km<br>
                <b>Loc:</b> ${eq.loc}
            `);

            markersLayer.addLayer(marker);
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

// Color based on magnitude
function getColor(mag) {
    if (mag >= 4) return "#ff0000";
    if (mag >= 3) return "#ff6600";
    if (mag >= 2) return "#ffaa00";
    return "#00cc00";
}

// =========================
// Status Bar Refresh
// =========================
async function refreshStatus() {
    const statusBar = document.getElementById("status-bar");
    try {
        const res = await fetch(`${API_BASE}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const status = await res.json();

        statusBar.textContent = `Última actualización: ${status.last_update} (${status.elapsed}m) · ⚡ Hoy: ${status.today} · 📚 Total: ${status.total}`;
    } catch (err) {
        console.warn("Status unavailable:", err);
        statusBar.textContent = "⚠ Estado no disponible";
    }
}

// Auto-refresh markers + status every minute
setInterval(() => {
    const selectedDate = document.querySelector("#date-picker").value;
    loadEarthquakes(selectedDate);
    refreshStatus();
}, 60000);

// Initial load
loadEarthquakes(flatpickr.formatDate(new Date(), "d/m/Y"));
refreshStatus();
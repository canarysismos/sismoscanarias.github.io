const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const statusBar = document.getElementById("status-bar");
const datePicker = document.getElementById("date-picker");
const selectedDateLabel = document.getElementById("selected-date-label");
let markers = [];

// --- Date Helpers ---
function formatDate(date) {
    return date.toLocaleDateString("es-ES"); // Always DD/MM/YYYY
}

function parseDateInput(value) {
    const [day, month, year] = value.split("/");
    return new Date(`${year}-${month}-${day}`);
}

// --- Status Bar Update ---
function updateStatus() {
    fetch(`${API_BASE}/status`)
        .then(res => res.json())
        .then(data => {
            if (!data || data.status !== "ok") {
                statusBar.textContent = "Estado: error — dataset no disponible.";
                return;
            }

            const lastUpdate = new Date(data.last_update * 1000);
            const diffMinutes = Math.round((Date.now() - lastUpdate) / 60000);

            statusBar.textContent = `Última actualización: ${lastUpdate.toLocaleString("es-ES")} (${diffMinutes}m) · ⚡ Hoy: ${data.today} · 📚 Total: ${data.total}`;
        })
        .catch(() => {
            statusBar.textContent = "Estado: error al consultar /status.";
        });
}

// --- Load Markers ---
function loadMarkers(date) {
    fetch(`${API_BASE}/day?date=${date}`)
        .then(res => res.json())
        .then(data => {
            // Clear old markers
            markers.forEach(m => map.removeLayer(m));
            markers = [];

            // Add new markers
            data.forEach(eq => {
                const marker = L.circleMarker([eq.lat, eq.lon], {
                    radius: eq.mag * 2,
                    color: eq.mag >= 4 ? "#e74c3c" : "#2980b9",
                    fillColor: eq.mag >= 4 ? "#e74c3c" : "#3498db",
                    fillOpacity: 0.7,
                    weight: 1
                });

                marker.bindPopup(`
                    <b>${eq.localizacion}</b><br>
                    Fecha: ${eq.fecha} ${eq.hora}<br>
                    Magnitud: ${eq.mag}<br>
                    Profundidad: ${eq.profundidad} km
                `);

                marker.addTo(map);
                markers.push(marker);
            });
        })
        .catch(err => {
            console.error("Error fetching data:", err);
            statusBar.textContent = "Error al cargar datos de terremotos.";
        });
}

// --- Date Picker Setup ---
datePicker.addEventListener("click", () => {
    const date = parseDateInput(datePicker.value);
    datePicker.showPicker?.(); // Native picker for browsers that support it
});

// --- On Date Change ---
datePicker.addEventListener("change", () => {
    loadMarkers(datePicker.value);
});

// --- Init ---
const today = new Date();
datePicker.value = formatDate(today);
loadMarkers(datePicker.value);
updateStatus();
setInterval(updateStatus, 60000); // Refresh status every minute
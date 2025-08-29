const API_BASE = "https://api.quakes.earth";
const datePicker = document.getElementById("date-picker");
const calendarButton = document.getElementById("calendar-button");
const statusBar = document.getElementById("status-bar");

let markers = [];
const map = L.map("map").setView([28.3, -16.6], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
}

async function loadMarkers(date) {
    try {
        const res = await fetch(`${API_BASE}/day?date=${date}`);
        const data = await res.json();
        markers.forEach(m => map.removeLayer(m));
        markers = [];

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
    } catch (err) {
        console.error("Error fetching data:", err);
        statusBar.textContent = "⚠ Error al cargar datos";
    }
}

async function updateStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        if (!data || data.status !== "ok") {
            statusBar.textContent = "⚠ Estado: dataset no disponible.";
            return;
        }

        const lastUpdate = new Date(data.last_update * 1000);
        const diffMinutes = Math.round((Date.now() - lastUpdate) / 60000);
        statusBar.textContent = `Última actualización: ${lastUpdate.toLocaleString("es-ES")} (${diffMinutes}m) · ⚡ Hoy: ${data.today} · 📚 Total: ${data.total}`;
    } catch {
        statusBar.textContent = "⚠ Estado: error al consultar /status.";
    }
}

// Calendar button → triggers date picker
calendarButton.addEventListener("click", () => {
    datePicker.showPicker?.();
});

// Date picker → refresh markers
datePicker.addEventListener("change", () => {
    const selected = new Date(datePicker.value);
    datePicker.value = formatDate(selected);
    loadMarkers(datePicker.value);
});

// Init page
const today = new Date();
datePicker.value = formatDate(today);
loadMarkers(datePicker.value);
updateStatus();
setInterval(updateStatus, 60000);
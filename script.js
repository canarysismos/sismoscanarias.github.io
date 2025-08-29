// ======================
// CONFIG
// ======================
const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.2916, -16.6291], 7);
let markersLayer = L.layerGroup().addTo(map);

// ======================
// TILE LAYER
// ======================
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
}).addTo(map);

// ======================
// DOM ELEMENTS
// ======================
const datePicker = document.querySelector("#date-picker");
const statusBar = document.querySelector("#status-bar");

// ======================
// INIT FLATPICKR
// ======================
flatpickr(datePicker, {
  dateFormat: "d/m/Y",
  allowInput: true,
  defaultDate: new Date(),
  clickOpens: true,
  locale: {
    firstDayOfWeek: 1,
  },
  onChange: (selectedDates, dateStr) => {
    if (dateStr) {
      loadEarthquakes(dateStr);
    }
  },
});

// ======================
// LOAD EARTHQUAKES
// ======================
async function loadEarthquakes(date) {
  try {
    const res = await fetch(`${API_BASE}/day?date=${date}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    markersLayer.clearLayers();

    data.forEach(eq => {
      const { lat, lon, mag, fecha, hora, localizacion } = eq;

      const marker = L.circleMarker([lat, lon], {
        radius: mag * 2.5,
        color: mag >= 4 ? "#ff0000" : mag >= 2 ? "#ffa500" : "#008000",
        fillOpacity: 0.7,
      });

      marker.bindPopup(`
        <b>${localizacion}</b><br>
        ${fecha} ${hora}<br>
        <b>Mag:</b> ${mag}
      `);

      markersLayer.addLayer(marker);
    });

    console.log(`Loaded ${data.length} earthquakes for ${date}`);
  } catch (err) {
    console.error("Failed to load earthquakes:", err);
  }
}

// ======================
// STATUS BAR
// ======================
async function updateStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    if (statusBar) {
      statusBar.textContent = `Última actualización: ${data.last_update} (${data.last_diff}m) · ⚡ Hoy: ${data.today} · 📚 Total: ${data.total}`;
    }
  } catch (err) {
    console.warn("Status update failed:", err);
    if (statusBar) statusBar.textContent = "Estado: error cargando datos";
  }
}

// ======================
// AUTO-INIT
// ======================
const today = new Date();
const todayFormatted = today.toLocaleDateString("es-ES");
datePicker.value = todayFormatted;
loadEarthquakes(todayFormatted);
updateStatus();
setInterval(updateStatus, 60000);
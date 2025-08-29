// ----------------------------
// CONFIGURATION
// ----------------------------
const API_BASE = "https://api.quakes.earth";

// Leaflet map initialization
const map = L.map("map").setView([28.3, -16.5], 8);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 18,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

// ----------------------------
// UTILITIES
// ----------------------------

// Format Date -> DD/MM/YYYY
function formatDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// Parse DD/MM/YYYY to JS Date object
function parseDate(str) {
  const [d, m, y] = str.split("/");
  return new Date(`${y}-${m}-${d}`);
}

// Get today's date in correct format
const today = formatDate(new Date());

// ----------------------------
// STATUS BAR SETUP
// ----------------------------
const statusBar = document.createElement("div");
statusBar.id = "status-bar";
statusBar.style.position = "absolute";
statusBar.style.top = "15px";
statusBar.style.right = "15px";
statusBar.style.background = "rgba(255, 255, 255, 0.95)";
statusBar.style.borderRadius = "12px";
statusBar.style.padding = "10px 16px";
statusBar.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
statusBar.style.fontFamily = "Arial, sans-serif";
statusBar.style.fontSize = "14px";
statusBar.style.color = "#222";
statusBar.style.zIndex = "1000";
statusBar.style.lineHeight = "1.4";
statusBar.style.textAlign = "right";
document.body.appendChild(statusBar);

function updateStatusBar(info) {
  if (!info || info.status === "error") {
    statusBar.innerHTML = `<b>Estado:</b> Error — dataset no disponible`;
    return;
  }

  const lastUpdate = new Date(info.last_update * 1000);
  const diffMinutes = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);

  statusBar.innerHTML = `
    <b>Última actualización:</b> ${formatDate(lastUpdate)} ${lastUpdate.toLocaleTimeString("es-ES")} 
    (${diffMinutes}m) · ⚡ <b>Hoy:</b> ${info.today} · 📚 <b>Total:</b> ${info.total}
  `;
}

// ----------------------------
// LOAD EARTHQUAKES
// ----------------------------
async function loadEarthquakes(date) {
  try {
    const response = await fetch(`${API_BASE}/day?date=${date}`);
    const data = await response.json();

    markersLayer.clearLayers();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`No earthquakes for ${date}`);
      return;
    }

    data.forEach((quake) => {
      const marker = L.circleMarker([quake.lat, quake.lon], {
        radius: 6,
        fillColor: quake.mag >= 3 ? "#FF4B4B" : "#0077FF",
        color: "#222",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.bindPopup(`
        <b>${quake.fecha} ${quake.hora}</b><br>
        <b>Magnitud:</b> ${quake.mag}<br>
        <b>Profundidad:</b> ${quake.profundidad} km<br>
        <b>Localización:</b> ${quake.localizacion}
      `);

      markersLayer.addLayer(marker);
    });
  } catch (error) {
    console.error("Error loading earthquakes:", error);
  }
}

// ----------------------------
// DATE PICKER
// ----------------------------
const datePicker = document.querySelector("#date-picker");
const dateLabel = document.querySelector("#selected-date-label");

function initDatePicker() {
  flatpickr(datePicker, {
    dateFormat: "d/m/Y", // <-- Spanish format
    defaultDate: today,
    locale: {
      firstDayOfWeek: 1,
      weekdays: {
        shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
        longhand: [
          "Domingo",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
        ],
      },
      months: {
        shorthand: [
          "Ene", "Feb", "Mar", "Abr", "May", "Jun",
          "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
        ],
        longhand: [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ],
      },
    },
    onChange: (selectedDates) => {
      if (selectedDates.length > 0) {
        const selectedDate = formatDate(selectedDates[0]);
        dateLabel.textContent = selectedDate;
        loadEarthquakes(selectedDate);
      }
    },
  });

  // Set initial date and load data
  datePicker.value = today;
  dateLabel.textContent = today;
  loadEarthquakes(today);
}

// ----------------------------
// INITIALIZATION
// ----------------------------
async function init() {
  // Fetch status info
  try {
    const status = await fetch(`${API_BASE}/status`);
    const info = await status.json();
    updateStatusBar(info);
  } catch (e) {
    console.error("Failed fetching status:", e);
    updateStatusBar(null);
  }

  // Initialize date picker & load today's earthquakes
  initDatePicker();
}

init();
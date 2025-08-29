const API_BASE = "https://api.quakes.earth";

// --- Elements
const dateDisplay = document.getElementById("date-display");
const dateNative  = document.getElementById("date-native");
const calendarBtn = document.getElementById("calendar-button");
const statusBar   = document.getElementById("status-bar");

// --- Map
const map = L.map("map", { zoomControl: true }).setView([28.3, -16.6], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let markers = [];

// --- Date helpers
function toDisplay(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function toNativeValue(d) { // YYYY-MM-DD
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}
function fromNativeValue(v) { // YYYY-MM-DD -> Date
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// color scale green->red by magnitude (0..5)
function colorForMag(m) {
  const clamped = Math.max(0, Math.min(5, Number(m) || 0));
  const hue = 120 - (clamped / 5) * 120; // 120->0
  return `hsl(${hue}, 80%, 45%)`;
}

// --- API
async function fetchDay(ddmmyyyy) {
  const res = await fetch(`${API_BASE}/day?date=${encodeURIComponent(ddmmyyyy)}`);
  if (!res.ok) return [];
  return res.json();
}
async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) return { status: "error" };
    return res.json();
  } catch {
    return { status: "error" };
  }
}

// --- UI updates
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}
function addMarkers(list) {
  list.forEach(eq => {
    const r = Math.max(4, Math.min(18, (Number(eq.mag) || 0) * 4));
    const col = colorForMag(eq.mag);
    const marker = L.circleMarker([eq.lat, eq.lon], {
      radius: r, color: col, fillColor: col, fillOpacity: 0.7, weight: 1
    });
    marker.bindPopup(
      `<b>${eq.localizacion}</b><br>` +
      `Fecha: ${eq.fecha} ${eq.hora}<br>` +
      `Magnitud: ${eq.mag} · Profundidad: ${eq.profundidad} km`
    );
    marker.addTo(map);
    markers.push(marker);
  });
}

async function loadFor(dateDDMMYYYY) {
  clearMarkers();
  try {
    const data = await fetchDay(dateDDMMYYYY);
    addMarkers(data);
  } catch (e) {
    console.error(e);
    statusBar.textContent = "⚠ Error al cargar datos.";
  }
}

async function refreshStatus() {
  const s = await fetchStatus();
  if (s.status !== "ok") {
    statusBar.textContent = "⚠ Estado: dataset no disponible.";
    return;
  }
  const t = new Date(s.last_update * 1000);
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  statusBar.textContent =
    `Última actualización: ${t.toLocaleString("es-ES")} (${mins}m) · ` +
    `⚡ Hoy: ${s.today} · 📚 Total: ${s.total}`;
}

// --- Date interactions
function openNativePicker() {
  // Keep native input synced with displayed value
  const parts = dateDisplay.value.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d)) dateNative.value = toNativeValue(d);
  }
  if (dateNative.showPicker) dateNative.showPicker();
  else dateNative.focus();
}

calendarBtn.addEventListener("click", openNativePicker);
dateDisplay.addEventListener("click", openNativePicker);

dateNative.addEventListener("change", () => {
  const d = fromNativeValue(dateNative.value);
  const pretty = toDisplay(d);
  dateDisplay.value = pretty;
  loadFor(pretty);
});

// --- Init (always start with today and load markers immediately)
const today = new Date();
dateDisplay.value = toDisplay(today);
dateNative.value = toNativeValue(today);
loadFor(dateDisplay.value);
refreshStatus();
setInterval(refreshStatus, 60000);
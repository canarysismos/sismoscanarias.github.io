// =========================
// Config & Globals
// =========================
const API_BASE = "https://api.quakes.earth";
let map, markersLayer, fp;

// Helpers
const pad2 = n => String(n).padStart(2, "0");
const formatDDMMYYYY = d => `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
const toLocalHHMMSS = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function parseLastUpdate(val) {
  // Accept number (epoch seconds), numeric string, or ISO date string
  if (val == null) return null;
  if (typeof val === "number") return new Date(val * 1000);
  if (typeof val === "string") {
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim().match(/^\d+(\.\d+)?$/)) return new Date(num * 1000);
    const iso = new Date(val);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  return null;
}

// =========================
function initMap() {
  map = L.map("map").setView([28.3, -16.6], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function colorForMag(m) {
  // green→red gradient
  const mag = Math.max(0, Math.min(5, Number(m) || 0));   // clamp [0..5]
  const t = mag / 5;
  const r = Math.round(255 * t);
  const g = Math.round(255 * (1 - t));
  return `rgb(${r},${g},0)`;
}

async function loadEarthquakes(dateStr) {
  if (!dateStr) return;
  try {
    const res = await fetch(`${API_BASE}/day?date=${encodeURIComponent(dateStr)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected payload");

    markersLayer.clearLayers();

    data.forEach(eq => {
      const lat = Number(eq.lat ?? eq.latitude);
      const lon = Number(eq.lon ?? eq.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;

      const mag = Number(eq.mag ?? eq.magnitud ?? eq.magnitude ?? 0) || 0;
      const radius = Math.max(4, mag * 2.5);
      const prof =
        eq.prof ?? eq.profundidad ?? eq.prof_km ?? eq.depth ?? "";
      const loc = eq.localizacion ?? eq.loc ?? eq.localidad ?? "—";
      const fecha = eq.fecha ?? "—";
      const hora = eq.hora ?? "—";

      const marker = L.circleMarker([lat, lon], {
        radius,
        color: "#000",
        weight: 1,
        fillColor: colorForMag(mag),
        fillOpacity: 0.75,
      });

      marker.bindPopup(
        `<b>${loc}</b><br/>${fecha} ${hora}<br/><b>Magnitud:</b> ${mag}<br/><b>Profundidad:</b> ${prof} km`
      );

      markersLayer.addLayer(marker);
    });
  } catch (e) {
    console.error("loadEarthquakes failed:", e);
  }
}

async function fetchTodayCountFallback() {
  const today = formatDDMMYYYY(new Date());
  try {
    const r = await fetch(`${API_BASE}/day?date=${encodeURIComponent(today)}`, { cache: "no-store" });
    if (!r.ok) throw new Error();
    const arr = await r.json();
    return Array.isArray(arr) ? arr.length : undefined;
  } catch {
    return undefined;
  }
}

async function updateStatus() {
  const container = document.getElementById("status-container");
  const textEl = document.getElementById("status-text");
  if (!container || !textEl) return;

  try {
    const r = await fetch(`${API_BASE}/status`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const s = await r.json();

    // Parse fields defensively
    const lastUpdate = parseLastUpdate(s.last_update ?? s.last ?? s.updated_at);
    const now = new Date();
    let minsAgo = null;
    if (lastUpdate) minsAgo = Math.max(0, Math.round((now - lastUpdate) / 60000));
    if (minsAgo == null) minsAgo = s.last_diff ?? s.elapsed ?? "—";

    let todayCount = s.today ?? s.today_count ?? s.todayEvents;
    if (todayCount == null) todayCount = await fetchTodayCountFallback();

    const total = s.total ?? s.count_total ?? s.events_total ?? "—";

    const datePart = lastUpdate
      ? `${formatDDMMYYYY(lastUpdate)} ${toLocalHHMMSS(lastUpdate)}`
      : "N/A";
    const minsPart = typeof minsAgo === "number" ? `${minsAgo}m` : minsAgo;

    textEl.textContent = `Última actualización: ${datePart} (${minsPart}) · ⚡ Hoy: ${todayCount ?? "—"} · 📚 Total: ${total}`;
  } catch (e) {
    console.warn("Status fetch failed:", e);
    textEl.textContent = "⚠ Estado no disponible";
  }
}

// =========================
function initDatePicker() {
  const input = document.getElementById("date-picker");
  const icon = document.getElementById("calendar-icon");
  if (!input) return;

  fp = flatpickr(input, {
    locale: flatpickr.l10ns.es,
    dateFormat: "d/m/Y",
    defaultDate: new Date(),
    clickOpens: true,
    allowInput: false,
    onChange: (selectedDates, dateStr) => {
      if (dateStr) loadEarthquakes(dateStr);
    },
  });

  // Open when clicking the icon
  if (icon) icon.addEventListener("click", () => fp && fp.open());

  // Initial load for today
  input.value = formatDDMMYYYY(new Date());
  loadEarthquakes(input.value);
}

// =========================
function initStatusCollapsible() {
  const cont = document.getElementById("status-container");
  const pill = document.getElementById("status-pill");
  const collapseBtn = document.getElementById("collapse-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  if (!cont) return;

  // Collapse by default on small screens; expanded on desktop
  if (window.innerWidth <= 768) {
    cont.classList.add("collapsed");
  } else {
    cont.classList.remove("collapsed");
  }

  if (pill) {
    pill.addEventListener("click", () => cont.classList.remove("collapsed"));
  }
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => cont.classList.add("collapsed"));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      // Refresh status + current date markers
      await updateStatus();
      const input = document.getElementById("date-picker");
      const selected = input?.value || formatDDMMYYYY(new Date());
      await loadEarthquakes(selected);
    });
  }
}

// =========================
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initDatePicker();
  initStatusCollapsible();
  updateStatus();

  // Auto-refresh every 60s
  setInterval(updateStatus, 60000);
  setInterval(() => {
    const input = document.getElementById("date-picker");
    const selected = input?.value || formatDDMMYYYY(new Date());
    loadEarthquakes(selected);
  }, 60000);
});
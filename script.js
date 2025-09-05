// ---------- Config ----------
const API_BASE = "https://api.quakes.earth";

// ---------- State ----------
let map, markersLayer;
let markers = [];

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const els = {
  date:
    $("#date-picker") ||
    $("#date-input") ||
    document.querySelector('input[type="date"]'),
  status:
    $("#status-bar") ||
    $("#status") ||
    $(".status-chip") ||
    $(".status-text"),
  refresh:
    $("#refresh-btn") ||
    $(".refresh-btn") ||
    $(".status-refresh")
};

// ---------- Date helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const todayDate = () => new Date();
const toDDMMYYYY = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const isTodayDDMMYYYY = (s) => s === toDDMMYYYY(todayDate());

function parseLastUpdate(val) {
  if (!val) return null;
  if (typeof val === "number") return new Date(val * 1000);
  if (typeof val === "string") {
    const num = Number(val);
    if (!Number.isNaN(num) && /^\d+(\.\d+)?$/.test(val.trim()))
      return new Date(num * 1000);
    const iso = new Date(val);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  return null;
}

// ---------- Styling: color & size ----------
function colorForMag(m) {
  const mag = Number(m);
  if (!Number.isFinite(mag)) return "#999999"; // fallback grey
  if (mag < 1) return "#FFF5A5"; // light yellow
  if (mag < 2) return "#FFD54D"; // deep yellow
  if (mag < 3) return "#FF9800"; // orange
  if (mag < 4) return "#F44336"; // red
  return "#8B0000"; // dark red
}

function radiusFor(mag, zoom) {
  const m = Number.isFinite(+mag) ? Math.max(0, +mag) : 0.8;
  const z = Number.isFinite(zoom) ? zoom : 7;
  // Conservative scale so we never get a giant dot:
  // base 4px + per-mag 3px + per-zoom 0.8px, clamped
  const r = 4 + m * 3 + (z - 5) * 0.8;
  return Math.max(4, Math.min(r, 22));
}

// ---------- Map ----------
function initMap() {
  map = L.map("map").setView([28.3, -16.6], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // On zoom, resize all circle markers smoothly
  map.on("zoomend", () => {
    const z = map.getZoom();
    markers.forEach(({ marker, mag }) => {
      marker.setRadius(radiusFor(mag, z));
    });
  });
}

// ---------- Rendering ----------
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
  markers = [];
}

function renderMarkers(quakes) {
  clearMarkers();
  if (!Array.isArray(quakes) || quakes.length === 0) return;

  const z = map.getZoom();

  quakes.forEach((q) => {
    const lat = Number(q.lat ?? q.latitude);
    const lon = Number(q.lon ?? q.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const mag =
      Number(q.mag ?? q.magnitud ?? q.magnitude ?? q.Magnitud) || 0;
    const loc = q.localizacion ?? q.localidad ?? q.loc ?? "—";
    const fecha = q.fecha ?? "—";
    const hora = q.hora ?? q.time ?? "—";
    const prof = q.prof_km ?? q.prof ?? q.depth ?? "—";

    const marker = L.circleMarker([lat, lon], {
      radius: radiusFor(mag, z),
      color: "#4B1E1E",
      weight: 1,
      fillColor: colorForMag(mag),
      fillOpacity: 0.85
    });

    marker.bindPopup(
      `<div class="quake-popup">
        <h3 style="margin:0 0 .25rem 0">${loc}</h3>
        <div><b>Fecha:</b> ${fecha} ${hora}</div>
        <div><b>Magnitud:</b> ${mag}</div>
        <div><b>Profundidad:</b> ${prof} km</div>
      </div>`
    );

    markersLayer.addLayer(marker);
    markers.push({ marker, mag });
  });
}

// ---------- API ----------
async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (e) {
    console.error("fetchJSON failed:", e);
    return null;
  }
}

async function loadDay(dateStr) {
  const url = `${API_BASE}/day?date=${encodeURIComponent(dateStr)}`;
  const data = await fetchJSON(url);
  if (!Array.isArray(data)) {
    console.warn("Day payload not array:", data);
    return [];
  }
  return data;
}

async function loadStatus() {
  const data = await fetchJSON(`${API_BASE}/status`);
  if (!data) return null;

  // Try to normalize fields from whatever backend sends
  const total =
    data.total_count ?? data.total ?? data.count_total ?? data.totalEvents;
  const today =
    data.today_count ?? data.today ?? data.hoy ?? data.count_today;
  const lastRaw =
    data.last_update ??
    data.last_updated ??
    data.updated_at ??
    data.last_update_iso ??
    data.last_update_ts ??
    data.last;

  const last = parseLastUpdate(lastRaw);
  return {
    total: Number.isFinite(+total) ? +total : undefined,
    today: Number.isFinite(+today) ? +today : undefined,
    last
  };
}

// ---------- Status Bar ----------
function setStatus(text) {
  if (!els.status) return;
  els.status.textContent = text;
}

function humanAgo(d) {
  if (!d) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h`;
}

async function refreshStatusBar() {
  setStatus?.("Cargando estado...");
  const st = await loadStatus();

  if (!st) {
    setStatus?.("Estado: sin datos");
    return;
  }

  const when =
    st.last
      ? `${pad2(st.last.getDate())}/${pad2(
          st.last.getMonth() + 1
        )}/${st.last.getFullYear()} ${pad2(st.last.getHours())}:${pad2(
          st.last.getMinutes()
        )}:${pad2(st.last.getSeconds())}`
      : "—";

  const ago = st.last ? humanAgo(st.last) : "—";
  const today = Number.isFinite(st.today) ? st.today : "—";
  const total = Number.isFinite(st.total) ? st.total : "—";

  setStatus?.(`Última actualización: ${when} (${ago}) · ⚡ Hoy: ${today} · 📚 Total: ${total}`);
}

// ---------- Date picker wiring ----------
function getSelectedDate() {
  if (!els.date) return toDDMMYYYY(todayDate());
  const v = (els.date.value || "").trim();
  if (!v) return toDDMMYYYY(todayDate());

  // Accept both DD/MM/YYYY and native yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map((x) => +x);
    return `${pad2(d)}/${pad2(m)}/${y}`;
  }
  return toDDMMYYYY(todayDate());
}

function setDateIfEmpty() {
  if (!els.date) return;
  if (!els.date.value) {
    // Prefer native input=date if present
    if (els.date.type === "date") {
      const d = todayDate();
      els.date.value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
        d.getDate()
      )}`;
    } else {
      els.date.value = toDDMMYYYY(todayDate());
    }
  }
}

function wireDateInput(onChange) {
  if (!els.date) return;
  els.date.addEventListener("change", onChange);
  els.date.addEventListener("blur", onChange);
  els.date.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onChange();
  });
}

// ---------- Page orchestration ----------
async function reloadForCurrentDate() {
  const d = getSelectedDate();
  const quakes = await loadDay(d);
  renderMarkers(quakes);
}

function isSelectedToday() {
  return isTodayDDMMYYYY(getSelectedDate());
}

async function bootstrap() {
  initMap();
  setDateIfEmpty();

  // First paint
  await Promise.all([reloadForCurrentDate(), refreshStatusBar()]);

  // Wire controls
  wireDateInput(reloadForCurrentDate);
  els.refresh && els.refresh.addEventListener("click", async () => {
    await refreshStatusBar();
    if (isSelectedToday()) await reloadForCurrentDate();
  });

  // Keep status fresh; reload markers only when viewing today
  setInterval(async () => {
    await refreshStatusBar();
    if (isSelectedToday()) await reloadForCurrentDate();
  }, 60000);
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", bootstrap);

// Expose a tiny debug hook (optional)
window.quakesDebug = { reloadForCurrentDate, refreshStatusBar };
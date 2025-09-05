// ==============================
// quakes.earth — Frontend script
// Self-contained calendar + map
// ==============================

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
    // Prefer the dedicated text node to avoid nuking buttons
    $("#status-text") ||
    $(".status-text") ||
    $("#status") ||
    $(".status-chip") ||
    $("#status-bar"),
  refresh:
    $("#refresh-btn") ||
    $(".refresh-btn") ||
    $(".status-refresh"),
  calTrigger:
    // Support both id and class for the calendar button
    $("#calendar-icon") ||
    $("#calendar-btn") ||
    $(".calendar-btn") ||
    $(".calendar-icon") ||
    $('[data-cal-trigger]')
};

// ---------- Date helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const todayDate = () => new Date();
const toDDMMYYYY = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const isTodayDDMMYYYY = (s) => s === toDDMMYYYY(todayDate());

// Parse various last-update formats
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
  const r = 4 + m * 3 + (z - 5) * 0.8; // scaled by mag & zoom
  return Math.max(4, Math.min(r, 22));
}

// ---------- Minimal embedded datepicker (no deps) ----------
(function injectCalendarCSS() {
  const css = `
  .qpkr{position:absolute;z-index:9999;background:#0d6efd11;backdrop-filter:saturate(180%) blur(8px);
    border:1px solid #2c6fd5; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.15); overflow:hidden;
    font:14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue","Noto Sans",Arial;
    color:#083d77; min-width:260px}
  .qpkr *{box-sizing:border-box; user-select:none}
  .qpkr-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#0b5ed7;color:#fff}
  .qpkr-title{font-weight:600}
  .qpkr-nav{display:flex;gap:6px}
  .qpkr-btn{border:0;border-radius:8px;background:#ffffff22;color:#fff;padding:4px 8px;cursor:pointer}
  .qpkr-btn:hover{background:#ffffff33}
  .qpkr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:10px;background:#e9f2ff}
  .qpkr-wd{font-weight:600;font-size:12px;text-align:center;color:#1e63b5}
  .qpkr-day{height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;border:1px solid #cfe1ff}
  .qpkr-day:hover{background:#d8e7ff}
  .qpkr-day.qpkr-today{outline:2px solid #0d6efd}
  .qpkr-day.qpkr-muted{color:#9aa9c3}
  .qpkr-hide{display:none}
  @media (max-width:600px){.qpkr{transform:scale(.98); transform-origin:top right}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

class MiniDatePicker {
  constructor(input, trigger) {
    this.input = input;
    this.trigger = trigger || input;
    this.opened = false;

    // If the input is type="date", keep it text to unify behavior
    try {
      if (this.input.type === "date") this.input.type = "text";
    } catch {}

    // Default format is DD/MM/YYYY
    if (!this.input.value) this.input.value = toDDMMYYYY(todayDate());

    this._bind();
  }

  _bind() {
    const open = (e) => { e && e.preventDefault(); this.open(); };
    this.input.addEventListener("focus", open);
    this.input.addEventListener("click", open);
    this.trigger && this.trigger.addEventListener("click", open);

    document.addEventListener("click", (e) => {
      if (!this.opened) return;
      if (!this.picker) return;
      if (e.target === this.input || e.target === this.trigger) return;
      if (this.picker.contains(e.target)) return;
      this.close();
    });
    window.addEventListener("resize", () => this.position());
    window.addEventListener("scroll", () => this.position(), true);
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    // Build, unhide, then position so we can measure correctly
    this._build();
    this.picker.classList.remove("qpkr-hide");
    this.position();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.picker?.classList.add("qpkr-hide");
  }

  position() {
    if (!this.picker) return;
    const r = this.input.getBoundingClientRect();
    const margin = 8;
    const w = this.picker.offsetWidth || 280;
    const h = this.picker.offsetHeight || 320;

    // Horizontal: align to input right, clamped to viewport
    let left = window.scrollX + r.right - w;
    const maxLeft = window.scrollX + window.innerWidth - w - margin;
    left = Math.min(Math.max(left, window.scrollX + margin), maxLeft);

    // Vertical: prefer below; flip above if it would overflow
    let top = window.scrollY + r.bottom + 6;
    const overflowBottom = top + h + margin > window.scrollY + window.innerHeight;
    if (overflowBottom) top = window.scrollY + r.top - h - 6;
    if (top < window.scrollY + margin) top = window.scrollY + margin;

    this.picker.style.top = `${top}px`;
    this.picker.style.left = `${left}px`;
  }

  _build() {
    if (!this.picker) {
      this.picker = document.createElement("div");
      this.picker.className = "qpkr qpkr-hide";
      document.body.appendChild(this.picker);
    } else {
      this.picker.innerHTML = "";
    }

    const header = document.createElement("div");
    header.className = "qpkr-header";
    const title = document.createElement("div");
    title.className = "qpkr-title";
    const nav = document.createElement("div");
    nav.className = "qpkr-nav";
    const prev = document.createElement("button");
    prev.className = "qpkr-btn";
    prev.textContent = "«";
    const next = document.createElement("button");
    next.className = "qpkr-btn";
    next.textContent = "»";
    nav.append(prev, next);
    header.append(title, nav);

    const grid = document.createElement("div");
    grid.className = "qpkr-grid";

    const wds = ["L", "M", "X", "J", "V", "S", "D"];
    for (const w of wds) {
      const el = document.createElement("div");
      el.className = "qpkr-wd";
      el.textContent = w;
      grid.appendChild(el);
    }

    this.picker.append(header, grid);

    // Initial month/year from input value
    const d = this._parseInputOrToday();
    this._curYear = d.getFullYear();
    this._curMonth = d.getMonth();

    const render = () => {
      title.textContent = `${this._monthName(this._curMonth)} ${this._curYear}`;
      // Clear day cells (keep 7 headers)
      while (grid.children.length > 7) grid.removeChild(grid.lastChild);

      const firstOfMonth = new Date(this._curYear, this._curMonth, 1);
      // Make Monday the first column (0..6 => Mon..Sun)
      let startDow = (firstOfMonth.getDay() + 6) % 7;
      const daysInMonth = new Date(this._curYear, this._curMonth + 1, 0).getDate();

      // Previous month trailing days
      const prevMonthDays = new Date(this._curYear, this._curMonth, 0).getDate();
      for (let i = 0; i < startDow; i++) {
        const day = document.createElement("div");
        day.className = "qpkr-day qpkr-muted";
        day.textContent = String(prevMonthDays - startDow + 1 + i);
        grid.appendChild(day);
      }

      const today = new Date();
      const isToday = (y, m, d) =>
        y === today.getFullYear() &&
        m === today.getMonth() &&
        d === today.getDate();

      // Current month days
      for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement("div");
        cell.className = "qpkr-day";
        if (isToday(this._curYear, this._curMonth, i)) cell.classList.add("qpkr-today");
        cell.textContent = String(i);
        cell.addEventListener("click", () => {
          const picked = new Date(this._curYear, this._curMonth, i);
          this._apply(picked);
        });
        grid.appendChild(cell);
      }

      // Next month leading days to complete 6 rows
      const totalCells = grid.children.length;
      const need = 7 * 7 - totalCells; // 7 headers + 6*7 = 49 total
      for (let i = 1; i <= need; i++) {
        const cell = document.createElement("div");
        cell.className = "qpkr-day qpkr-muted";
        cell.textContent = String(i);
        grid.appendChild(cell);
      }
    };

    prev.addEventListener("click", () => {
      this._curMonth--;
      if (this._curMonth < 0) {
        this._curMonth = 11;
        this._curYear--;
      }
      render();
    });
    next.addEventListener("click", () => {
      this._curMonth++;
      if (this._curMonth > 11) {
        this._curMonth = 0;
        this._curYear++;
      }
      render();
    });

    render();
  }

  _monthName(m) {
    return [
      "Enero","Febrero","Marzo","Abril","Mayo","Junio",
      "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
    ][m];
  }

  _parseInputOrToday() {
    const v = (this.input.value || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [dd, mm, yyyy] = v.split("/").map(Number);
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [yyyy, mm, dd] = v.split("-").map(Number);
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return todayDate();
  }

  _apply(date) {
    const ddmmyyyy = toDDMMYYYY(date);
    this.input.value = ddmmyyyy;
    // bubble a change event so the app reloads
    const ev = new Event("change", { bubbles: true });
    this.input.dispatchEvent(ev);
    this.close();
  }
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

  setStatus?.(
    `Última actualización: ${when} (${ago}) · ⚡ Hoy: ${today} · 📚 Total: ${total}`
  );
}

// ---------- Date picker wiring ----------
function getSelectedDate() {
  if (!els.date) return toDDMMYYYY(todayDate());
  const v = (els.date.value || "").trim();
  if (!v) return toDDMMYYYY(todayDate());

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map((x) => +x);
    return `${pad2(d)}/${pad2(m)}/${y}`;
  }
  return toDDMMYYYY(todayDate());
}

function setDateIfEmpty() {
  if (!els.date) return;
  if (!els.date.value) els.date.value = toDDMMYYYY(todayDate());
  // Make sure it looks/acts like text for our picker
  try { if (els.date.type === "date") els.date.type = "text"; } catch {}
}

function wireDateInput(onChange) {
  if (!els.date) return;
  // Use our mini datepicker
  const dp = new MiniDatePicker(els.date, els.calTrigger);
  // Ensure calendar icon also opens the picker
  if (els.calTrigger) {
    els.calTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      dp.open();
    });
  }
  els.date.addEventListener("change", onChange);
  els.date.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onChange();
  });
  // Also reopen with Alt+Down
  els.date.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "ArrowDown") {
      dp.open();
    }
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

// Tiny debug hook
window.quakesDebug = { reloadForCurrentDate, refreshStatusBar };

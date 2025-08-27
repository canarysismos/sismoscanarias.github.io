const API_BASE = "https://api.quakes.earth";
const map = L.map("map").setView([28.3, -16.6], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

let earthquakeLayer = L.layerGroup().addTo(map);

// Elements
const datePicker = document.getElementById("date-picker");
const dateLabel = document.getElementById("selected-date-label");
const statusBar = document.getElementById("status-bar");

// --- Utilities ---
function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

function getRadius(mag) {
    return mag && !isNaN(mag) ? mag * 3.5 : 3;
}

function toIGNDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
}

function updateDateLabel(isoDate) {
    dateLabel.textContent = `Fecha seleccionada: ${toIGNDate(isoDate)}`;
}

// Parse IGN datetime for "ago" in status bar
function parseIgnDateTime(dt) {
    const [dPart, tPart] = dt.split(" ");
    const [dd, mm, yyyy] = dPart.split("/").map(Number);
    let hh = 0, mi = 0, ss = 0;
    if (tPart) [hh, mi, ss] = tPart.split(":").map(Number);
    return new Date(yyyy, mm - 1, dd, hh, mi, ss);
}

function timeAgo(dtString) {
    const d = parseIgnDateTime(dtString);
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    return `${day}d`;
}

function freshnessColor(dtString) {
    const d = parseIgnDateTime(dtString);
    const diffMin = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
    if (diffMin <= 15) return "status-fresh";   // 🟢
    if (diffMin <= 60) return "status-warning"; // 🟠
    return "status-stale";                      // 🔴
}

// --- Status bar ---
async function fetchStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const s = await res.json();

        if (!statusBar) return;

        if (!s || s.status !== "ok") {
            statusBar.className = "status status-error";
            statusBar.textContent = "Estado: error — dataset no disponible.";
            return;
        }

        const ago = timeAgo(s.last_update);
        statusBar.className = `status ${freshnessColor(s.last_update)}`;
        statusBar.innerHTML = `🔄 Última actualización: <b>${s.last_update}</b> (${ago}) · ⚡ Hoy: <b>${s.events_today}</b> · 📚 Total: <b>${s.total_events}</b>`;
    } catch (e) {
        if (!statusBar) return;
        statusBar.className = "status status-error";
        statusBar.textContent = "Estado: error al consultar /status.";
    }
}

// --- Plot markers ---
function plotEarthquakes(data) {
    earthquakeLayer.clearLayers();

    if (!data || data.length === 0) {
        alert("ℹ️ No earthquakes recorded on this date.");
        return;
    }

    data.forEach(eq => {
        if (!eq.lat || !eq.lon || isNaN(eq.lat) || isNaN(eq.lon)) return;

        const marker = L.circleMarker([eq.lat, eq.lon], {
            radius: getRadius(eq.mag),
            color: getColor(eq.mag),
            fillOpacity: 0.6,
            weight: 1
        });

        marker.bindPopup(`
            <b>${eq.title || "Terremoto"}</b><br>
            <b>Fecha:</b> ${eq.fecha} ${eq.hora}<br>
            <b>Magnitud:</b> ${eq.mag || "N/A"} (${eq.tipo_mag})<br>
            <b>Profundidad:</b> ${eq.depth} km<br>
            <a target="_blank" href="https://www.openstreetmap.org/?mlat=${eq.lat}&mlon=${eq.lon}&zoom=12">
                🌍 Ver en OpenStreetMap
            </a>
        `);

        marker.addTo(earthquakeLayer);
    });
}

// --- Load quakes for a date ---
async function loadQuakesByISODate(isoDate) {
    const ignDate = toIGNDate(isoDate);
    try {
        const res = await fetch(`${API_BASE}/day?date=${ignDate}`);
        const data = await res.json();
        plotEarthquakes(data);
        updateDateLabel(isoDate);
    } catch (err) {
        console.error(`Failed to load data for ${ignDate}`, err);
    }
}

// --- Set initial date to latest available with events ---
async function setInitialDate() {
    try {
        const res = await fetch(`${API_BASE}/latest-date`);
        const json = await res.json();

        if (json.latest) {
            const [day, month, year] = json.latest.split("/");
            const isoDate = `${year}-${month}-${day}`;
            datePicker.value = isoDate;
            datePicker.dataset.displayValue = json.latest;
            loadQuakesByISODate(isoDate);
        } else {
            console.warn("No earthquake data available.");
        }
    } catch (err) {
        console.error("Failed to fetch latest date:", err);
    }
}

// --- Display DD/MM/YYYY in input regardless of browser ---
datePicker.addEventListener("input", function () {
    const isoDate = this.value;
    this.dataset.displayValue = toIGNDate(isoDate);
});

// --- Force formatted value on render ---
const style = document.createElement("style");
style.innerHTML = `
    .status { padding: 6px 10px; border-radius: 6px; display: inline-block; margin-top: 5px; }
    .status-fresh   { background:#e8f5e9; color:#1b5e20; border:1px solid #c8e6c9; }    /* 🟢 Fresh */
    .status-warning { background:#fff8e1; color:#7c5c00; border:1px solid #ffe082; }    /* 🟠 Warn */
    .status-stale   { background:#ffebee; color:#b71c1c; border:1px solid #ffcdd2; }    /* 🔴 Stale */
    .status-error   { background:#ffebee; color:#b71c1c; border:1px solid #ffcdd2; }
    input[type="date"]::-webkit-datetime-edit,
    input[type="date"]::-webkit-clear-button,
    input[type="date"]::-webkit-inner-spin-button {
        display: none;
    }
    input[type="date"]::before {
        content: attr(data-display-value);
    }
`;
document.head.appendChild(style);

// --- Handle manual date changes ---
datePicker.addEventListener("change", (e) => {
    const isoDate = e.target.value;
    if (isoDate) {
        datePicker.dataset.displayValue = toIGNDate(isoDate);
        loadQuakesByISODate(isoDate);
    }
});

// --- Auto-refresh map + status every 15 min ---
setInterval(() => {
    const isoDate = datePicker.value;
    if (isoDate) loadQuakesByISODate(isoDate);
    fetchStatus();
}, 15 * 60 * 1000);

// Init
setInitialDate();
fetchStatus();
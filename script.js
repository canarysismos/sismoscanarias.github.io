const API_BASE = "https://api.quakes.earth";
const map = L.map('map').setView([28.3, -16.6], 8);

// OpenStreetMap Layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
}).addTo(map);

function getColor(mag) {
    return mag >= 4 ? "#ff0000" :
           mag >= 3 ? "#ff6600" :
           mag >= 2 ? "#ffcc00" :
                      "#00cc66";
}

function getRadius(mag) {
    return mag * 3.5; // proportional marker size
}

// Add markers to map
function plotEarthquakes(data) {
    data.forEach(eq => {
        const marker = L.circleMarker([eq.lat, eq.lon], {
            radius: getRadius(eq.mag),
            color: getColor(eq.mag),
            fillOpacity: 0.6
        });

        marker.bindPopup(`
            <b>${eq.title || 'Earthquake'}</b><br>
            <b>Mag:</b> ${eq.mag}<br>
            <b>Depth:</b> ${eq.depth} km<br>
            <b>Time:</b> ${eq.time}<br>
            <a target="_blank" href="https://maps.google.com/?q=${eq.lat},${eq.lon}">View on Google Maps</a>
        `);

        marker.addTo(map);
    });
}

// Fetch historical data on load
async function loadHistorical() {
    try {
        const res = await fetch(`${API_BASE}/historical`);
        const data = await res.json();
        plotEarthquakes(data);
    } catch (err) {
        console.error("Failed to load data", err);
    }
}

// Load data every 15 minutes
loadHistorical();
setInterval(loadHistorical, 15 * 60 * 1000);
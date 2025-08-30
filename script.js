document.addEventListener("DOMContentLoaded", function () {
    const dateInput = document.getElementById("date-input");
    const statusBar = document.getElementById("status-bar");
    const statusContent = document.getElementById("status-content");
    const statusToggle = document.getElementById("status-toggle");

    // --- Restore DD/MM/YYYY format ---
    function formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Initialize with today’s date
    const today = new Date();
    dateInput.value = formatDate(today);

    // Attach native calendar picker
    dateInput.addEventListener("focus", () => dateInput.showPicker && dateInput.showPicker());

    // --- Fetch and format status bar info ---
    async function updateStatus() {
        try {
            const response = await fetch("https://api.quakes.earth/status");
            if (!response.ok) throw new Error("Network error");
            const data = await response.json();

            // Parse last update timestamp safely
            const lastUpdate = new Date(data.last_update * 1000);
            const now = new Date();
            const diffMinutes = Math.round((now - lastUpdate) / 60000);

            statusContent.textContent =
                `Última actualización: ${formatDate(lastUpdate)} ${lastUpdate.toLocaleTimeString()} ` +
                `(${diffMinutes}m) · ⚡ Hoy: ${data.today_count} · 📚 Total: ${data.total}`;
        } catch (error) {
            statusContent.textContent = "⚠ No se puede cargar el estado.";
        }
    }

    updateStatus();
    setInterval(updateStatus, 60000); // refresh every minute

    // --- Mobile toggle button ---
    statusToggle.addEventListener("click", () => {
        statusBar.classList.toggle("collapsed");
    });
});
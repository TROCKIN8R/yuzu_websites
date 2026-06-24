(function initStmDashboard() {
  const root = document.getElementById("stmDashboard");
  const data = window.StmData;
  const mapApi = window.StmMap;
  if (!root || !data) return;

  const els = {
    status: document.getElementById("stmStatus"),
    kpis: document.getElementById("stmKpis"),
    serviceList: document.getElementById("stmServiceList"),
    mapCaption: document.getElementById("stmMapCaption"),
    refreshBtn: document.getElementById("stmRefreshBtn")
  };

  let refreshTimer = null;

  function setStatus(message, tone) {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.className = `stm-status stm-status--${tone || "idle"}`;
    els.status.hidden = !message;
  }

  function formatNum(n) {
    return new Intl.NumberFormat("en-CA").format(n || 0);
  }

  function renderKpis(cards) {
    if (!els.kpis) return;
    els.kpis.innerHTML = cards.map((card) => `
      <div class="stm-kpi" style="--kpi-accent:${card.accent || "var(--yuzu-500)"}">
        <span class="stm-kpi__label">${card.label}</span>
        <span class="stm-kpi__value">${card.value}</span>
        ${card.hint ? `<span class="stm-kpi__hint">${card.hint}</span>` : ""}
      </div>
    `).join("");
  }

  function summarizeServiceStatus(payload) {
    const raw = payload?.serviceStatus;
    if (!raw) return { total: 0, items: [] };

    const candidates = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(raw?.lignes)
          ? raw.lignes
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

    const items = candidates.slice(0, 12).map((item, index) => {
      const line = item.ligne || item.line || item.route || item.nom || item.name || `Item ${index + 1}`;
      const state = item.etat || item.status || item.message || item.texte || item.description || "—";
      const mode = item.mode || item.type || "";
      return { line: String(line), state: String(state), mode: String(mode) };
    });

    return { total: candidates.length, items };
  }

  function renderServiceList(summary) {
    if (!els.serviceList) return;

    if (!summary.items.length) {
      els.serviceList.innerHTML = `<p class="stm-empty">No service status rows returned. Check that your STM app includes the i3 API.</p>`;
      return;
    }

    els.serviceList.innerHTML = `
      <table class="stm-table">
        <thead>
          <tr><th>Line</th><th>Mode</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${summary.items.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.line)}</strong></td>
              <td>${escapeHtml(item.mode || "—")}</td>
              <td>${escapeHtml(item.state)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function refresh() {
    if (!data.isConfigured()) {
      setStatus("STM demo not configured. See scripts/stm_setup.md", "error");
      return;
    }

    root.classList.add("stm-dashboard--loading");
    setStatus("Loading live STM feeds…", "loading");

    try {
      const [servicePayload, vehiclePayload] = await Promise.all([
        data.fetchServiceStatus(),
        data.fetchVehiclePositions()
      ]);

      const serviceSummary = summarizeServiceStatus(servicePayload);
      const plotted = mapApi?.plotVehicles(vehiclePayload.vehicles || []) || 0;
      const fetchedAt = vehiclePayload.fetchedAt || servicePayload.fetchedAt;
      const timeLabel = fetchedAt
        ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
        : "now";

      renderKpis([
        {
          label: "Buses tracked",
          value: formatNum(vehiclePayload.vehicleCount || plotted),
          hint: `${formatNum(vehiclePayload.entityCount || 0)} entities in feed`,
          accent: "var(--yuzu-500)"
        },
        {
          label: "Service messages",
          value: formatNum(serviceSummary.total),
          hint: "API i3 · métro & bus",
          accent: "var(--zest-500)"
        },
        {
          label: "Map points",
          value: formatNum(plotted),
          hint: "Live vehicle positions",
          accent: "var(--kumquat-500)"
        },
        {
          label: "Last refresh",
          value: timeLabel,
          hint: "Auto-refresh every 30s",
          accent: "var(--info-500)"
        }
      ]);

      renderServiceList(serviceSummary);

      if (els.mapCaption) {
        els.mapCaption.textContent = plotted
          ? `${formatNum(plotted)} buses on map · data via STM GTFS-RT`
          : "No vehicle coordinates returned for this refresh.";
      }

      setStatus(`Live STM data · refreshed ${timeLabel}`, "ok");
    } catch (error) {
      const message = String(error?.message || error);
      if (message.toLowerCase().includes("stm_api_key")) {
        setStatus("STM_API_KEY missing on server. Add it in Supabase Edge Function secrets.", "error");
      } else {
        setStatus(message, "error");
      }
      if (els.mapCaption) els.mapCaption.textContent = "Could not load live vehicle positions.";
    } finally {
      root.classList.remove("stm-dashboard--loading");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    const ms = data.config().refreshMs || 30000;
    refreshTimer = window.setInterval(refresh, ms);
  }

  els.refreshBtn?.addEventListener("click", refresh);
  mapApi?.init("stmLiveMap");
  refresh();
  scheduleRefresh();
})();

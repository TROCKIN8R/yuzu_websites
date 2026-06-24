(function initStmDashboard() {
  const root = document.getElementById("stmDashboard");
  const data = window.StmData;
  const mapApi = window.StmMap;
  const filtersApi = window.StmFilters;
  if (!root || !data || !filtersApi) return;

  const els = {
    status: document.getElementById("stmStatus"),
    kpis: document.getElementById("stmKpis"),
    serviceList: document.getElementById("stmServiceList"),
    mapCaption: document.getElementById("stmMapCaption"),
    refreshBtn: document.getElementById("stmRefreshBtn"),
    clearFiltersBtn: document.getElementById("stmClearFiltersBtn"),
    loadSlicers: document.getElementById("stmLoadSlicers"),
    motionSlicers: document.getElementById("stmMotionSlicers"),
    lineSearch: document.getElementById("stmLineSearch"),
    lineSlicers: document.getElementById("stmLineSlicers"),
    routeChart: document.getElementById("stmRouteChart"),
    vehicleTable: document.getElementById("stmVehicleTable"),
    filterSummary: document.getElementById("stmFilterSummary")
  };

  let refreshTimer = null;
  let filterState = filtersApi.defaultState();
  let rawVehicles = [];
  let rawAlerts = [];
  let routeIndex = [];
  let fetchedAt = null;
  let isFetching = false;
  let hasPlottedOnce = false;

  function setStatus(message, tone) {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.className = `stm-status stm-status--${tone || "idle"}`;
    els.status.hidden = !message;
  }

  function formatNum(n) {
    return new Intl.NumberFormat("en-CA").format(n || 0);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function activeFilterCount() {
    let count = 0;
    if (filterState.lines.size) count += 1;
    if (filterState.load !== "all") count += 1;
    if (filterState.motion !== "all") count += 1;
    if (filterState.lineSearch.trim()) count += 1;
    return count;
  }

  function getFilteredVehicles() {
    return filtersApi.apply(rawVehicles, filterState);
  }

  function renderKpis(filtered, total) {
    if (!els.kpis) return;

    const moving = filtered.filter((vehicle) => filtersApi.isMoving(vehicle)).length;
    const stopped = filtered.length - moving;
    const uniqueLines = new Set(filtered.map((vehicle) => vehicle.routeId).filter(Boolean)).size;
    const timeLabel = fetchedAt
      ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
      : "—";

    const cards = [
      {
        label: "Filtered vehicles",
        value: formatNum(filtered.length),
        hint: `${formatNum(total)} total in feed`,
        accent: "var(--yuzu-500)"
      },
      {
        label: "Bus lines",
        value: formatNum(uniqueLines),
        hint: filterState.lines.size ? `${filterState.lines.size} line filter(s)` : "All active lines",
        accent: "var(--zest-500)"
      },
      {
        label: "In motion",
        value: formatNum(moving),
        hint: `${formatNum(stopped)} stopped`,
        accent: "var(--kumquat-500)"
      },
      {
        label: "Last refresh",
        value: timeLabel,
        hint: activeFilterCount() ? `${activeFilterCount()} active slicer(s)` : "Auto-refresh every 30s",
        accent: "var(--info-500)"
      }
    ];

    els.kpis.innerHTML = cards.map((card) => `
      <div class="stm-kpi" style="--kpi-accent:${card.accent || "var(--yuzu-500)"}">
        <span class="stm-kpi__label">${card.label}</span>
        <span class="stm-kpi__value">${card.value}</span>
        ${card.hint ? `<span class="stm-kpi__hint">${card.hint}</span>` : ""}
      </div>
    `).join("");
  }

  function renderChipGroup(container, items, activeId, onSelect, options = {}) {
    if (!container) return;

    const { multi = false, activeSet = null } = options;
    container.innerHTML = items.map((item) => {
      const active = multi
        ? activeSet?.has(item.id)
        : activeId === item.id;
      const count = item.count != null ? `<span class="stm-chip__count">${formatNum(item.count)}</span>` : "";
      return `
        <button
          type="button"
          class="stm-chip${active ? " stm-chip--active" : ""}"
          data-id="${escapeHtml(item.id)}"
          aria-pressed="${active}"
        >
          ${escapeHtml(item.label)}${count}
        </button>
      `;
    }).join("");

    container.onclick = (event) => {
      const button = event.target.closest(".stm-chip");
      if (!button) return;
      onSelect(button.dataset.id);
    };
  }

  function renderLoadSlicers() {
    const counts = { light: 0, moderate: 0, busy: 0, unknown: 0 };
    rawVehicles.forEach((vehicle) => {
      counts[filtersApi.getLoadProfile(vehicle)] += 1;
    });

    const items = filtersApi.LOAD_PROFILES.map((profile) => ({
      ...profile,
      count: profile.id === "all" ? rawVehicles.length : counts[profile.id] || 0
    }));

    renderChipGroup(els.loadSlicers, items, filterState.load, (id) => {
      filterState.load = id;
      renderAll();
    });
  }

  function renderMotionSlicers() {
    const moving = rawVehicles.filter((vehicle) => filtersApi.isMoving(vehicle)).length;
    const items = filtersApi.MOTION_STATES.map((state) => ({
      ...state,
      count: state.id === "all"
        ? rawVehicles.length
        : state.id === "moving"
          ? moving
          : rawVehicles.length - moving
    }));

    renderChipGroup(els.motionSlicers, items, filterState.motion, (id) => {
      filterState.motion = id;
      renderAll();
    });
  }

  function renderLineSlicers() {
    const visibleRoutes = filtersApi
      .filterRoutesForSearch(routeIndex, filterState.lineSearch)
      .slice(0, 28)
      .map((route) => ({
        id: route.routeId,
        label: `Line ${route.routeId}`,
        count: route.count
      }));

    renderChipGroup(
      els.lineSlicers,
      visibleRoutes,
      null,
      (routeId) => {
        if (filterState.lines.has(routeId)) filterState.lines.delete(routeId);
        else filterState.lines.add(routeId);
        renderAll();
      },
      { multi: true, activeSet: filterState.lines }
    );
  }

  function renderFilterSummary(filtered) {
    if (!els.filterSummary) return;

    const parts = [];
    if (filterState.lines.size) {
      parts.push(`Lines: ${[...filterState.lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ")}`);
    }
    if (filterState.load !== "all") {
      const label = filtersApi.LOAD_PROFILES.find((item) => item.id === filterState.load)?.label;
      parts.push(`Load: ${label}`);
    }
    if (filterState.motion !== "all") {
      const label = filtersApi.MOTION_STATES.find((item) => item.id === filterState.motion)?.label;
      parts.push(label);
    }

    els.filterSummary.textContent = parts.length
      ? `${formatNum(filtered.length)} vehicles match · ${parts.join(" · ")}`
      : `${formatNum(filtered.length)} vehicles shown · no slicers active`;
  }

  function renderRouteChart(filtered) {
    if (!els.routeChart) return;

    const counts = filtersApi.buildRouteIndex(filtered).slice(0, 10);
    if (!counts.length) {
      els.routeChart.innerHTML = `<p class="stm-empty">No vehicles match the current slicers.</p>`;
      return;
    }

    const max = counts[0].count || 1;
    els.routeChart.innerHTML = counts.map((route) => {
      const width = Math.max(8, Math.round((route.count / max) * 100));
      return `
        <button type="button" class="stm-bar-row" data-route="${escapeHtml(route.routeId)}">
          <span class="stm-bar-row__label">Line ${escapeHtml(route.routeId)}</span>
          <span class="stm-bar-row__track" aria-hidden="true">
            <span class="stm-bar-row__fill" style="width:${width}%"></span>
          </span>
          <span class="stm-bar-row__value">${formatNum(route.count)}</span>
        </button>
      `;
    }).join("");

    els.routeChart.onclick = (event) => {
      const row = event.target.closest(".stm-bar-row");
      if (!row) return;
      const routeId = row.dataset.route;
      if (filterState.lines.has(routeId)) filterState.lines.delete(routeId);
      else filterState.lines.add(routeId);
      renderAll();
    };
  }

  function renderVehicleTable(filtered) {
    if (!els.vehicleTable) return;

    const rows = filtered
      .slice()
      .sort((a, b) => String(a.routeId).localeCompare(String(b.routeId), undefined, { numeric: true }))
      .slice(0, 40);

    if (!rows.length) {
      els.vehicleTable.innerHTML = `<p class="stm-empty">No vehicles to list for the current slicers.</p>`;
      return;
    }

    els.vehicleTable.innerHTML = `
      <table class="stm-table stm-table--compact">
        <thead>
          <tr>
            <th>Line</th>
            <th>Vehicle</th>
            <th>Load</th>
            <th>Motion</th>
            <th>Speed</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((vehicle) => `
            <tr>
              <td><strong>${escapeHtml(vehicle.routeId || "—")}</strong></td>
              <td>${escapeHtml(vehicle.id || "—")}</td>
              <td><span class="stm-pill stm-pill--${filtersApi.getLoadProfile(vehicle)}">${escapeHtml((vehicle.occupancyLabel || "unknown").replace(/_/g, " "))}</span></td>
              <td>${filtersApi.isMoving(vehicle) ? "Moving" : "Stopped"}</td>
              <td>${vehicle.speed != null ? `${Math.round(Number(vehicle.speed) * 3.6)} km/h` : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderServiceList(summary) {
    if (!els.serviceList) return;

    if (!summary.items.length) {
      els.serviceList.innerHTML = `<p class="stm-empty">No service alerts match the selected bus lines.</p>`;
      return;
    }

    els.serviceList.innerHTML = `
      <p class="stm-card-meta">${formatNum(summary.filtered)} of ${formatNum(summary.total)} alerts shown</p>
      <table class="stm-table">
        <thead>
          <tr><th>Line</th><th>Scope</th><th>Status</th></tr>
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

  function renderMap(filtered) {
    const shouldFit = activeFilterCount() > 0 || !hasPlottedOnce;
    const plotted = mapApi?.plotVehicles(filtered, {
      colorFor: filtersApi.vehicleMarkerColor,
      fitBounds: shouldFit,
      filters: filtersApi
    }) || 0;
    if (plotted) hasPlottedOnce = true;

    if (els.mapCaption) {
      const lineHint = filterState.lines.size
        ? ` · lines ${[...filterState.lines].join(", ")}`
        : "";
      els.mapCaption.textContent = plotted
        ? `${formatNum(plotted)} vehicles on map${lineHint} · colour = passenger load`
        : "No vehicle coordinates match the current slicers.";
    }

    return plotted;
  }

  function renderAll() {
    const filtered = getFilteredVehicles();
    const alertSummary = filtersApi.summarizeAlerts(rawAlerts, filterState.lines);

    renderKpis(filtered, rawVehicles.length);
    renderLoadSlicers();
    renderMotionSlicers();
    renderLineSlicers();
    renderFilterSummary(filtered);
    renderRouteChart(filtered);
    renderVehicleTable(filtered);
    renderServiceList(alertSummary);
    renderMap(filtered);

    if (els.clearFiltersBtn) {
      els.clearFiltersBtn.disabled = activeFilterCount() === 0;
    }
  }

  function clearFilters() {
    filterState = filtersApi.defaultState();
    if (els.lineSearch) els.lineSearch.value = "";
    mapApi?.resetBounds?.();
    hasPlottedOnce = false;
    renderAll();
  }

  async function refresh() {
    if (!data.isConfigured()) {
      setStatus("STM demo not configured. See scripts/stm_setup.md", "error");
      return;
    }

    if (isFetching) return;
    isFetching = true;
    root.classList.add("stm-dashboard--loading");
    setStatus("Loading live STM feeds…", "loading");

    try {
      const [servicePayload, vehiclePayload] = await Promise.all([
        data.fetchServiceStatus(),
        data.fetchVehiclePositions()
      ]);

      rawVehicles = vehiclePayload.vehicles || [];
      rawAlerts = servicePayload?.serviceStatus?.alerts || [];
      routeIndex = filtersApi.buildRouteIndex(rawVehicles);
      fetchedAt = vehiclePayload.fetchedAt || servicePayload.fetchedAt;

      renderAll();

      const timeLabel = fetchedAt
        ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
        : "now";
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
      isFetching = false;
      root.classList.remove("stm-dashboard--loading");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    const ms = data.config().refreshMs || 30000;
    refreshTimer = window.setInterval(refresh, ms);
  }

  els.refreshBtn?.addEventListener("click", refresh);
  els.clearFiltersBtn?.addEventListener("click", clearFilters);
  els.lineSearch?.addEventListener("input", (event) => {
    filterState.lineSearch = event.target.value;
    renderLineSlicers();
  });

  mapApi?.init("stmLiveMap");
  refresh();
  scheduleRefresh();
})();

(function initStmDashboard() {
  const root = document.getElementById("stmDashboard");
  const data = window.StmData;
  const mapApi = window.StmMap;
  const routesApi = window.StmRoutes;
  const filtersApi = window.StmFilters;
  const enrichApi = window.StmEnrich;
  const metroSim = window.StmMetroSim;
  if (!root || !data || !filtersApi || !enrichApi) return;

  const els = {
    status: document.getElementById("stmStatus"),
    kpis: document.getElementById("stmKpis"),
    mapCaption: document.getElementById("stmMapCaption"),
    mapLegendLoad: document.getElementById("stmMapLegendLoad"),
    mapLegendDelay: document.getElementById("stmMapLegendDelay"),
    refreshBtn: document.getElementById("stmRefreshBtn"),
    clearFiltersBtn: document.getElementById("stmClearFiltersBtn"),
    lineSlicers: document.getElementById("stmLineSlicers"),
    loadSlicers: document.getElementById("stmLoadSlicers"),
    speedSlicers: document.getElementById("stmSpeedSlicers"),
    delaySlicers: document.getElementById("stmDelaySlicers"),
    alertSlicers: document.getElementById("stmAlertSlicers"),
    freshnessSlicers: document.getElementById("stmFreshnessSlicers"),
    colorSlicers: document.getElementById("stmColorSlicers"),
    directionSelect: document.getElementById("stmDirectionSelect"),
    accessibleToggle: document.getElementById("stmAccessibleToggle"),
    vehicleTable: document.getElementById("stmVehicleTable"),
    tableTitle: document.getElementById("stmTableTitle"),
    tableGranularityBus: document.getElementById("stmTableGranularityBus"),
    tableGranularityLine: document.getElementById("stmTableGranularityLine"),
    filterSummary: document.getElementById("stmFilterSummary")
  };

  let refreshTimer = null;
  let metroAnimTimer = null;
  let filterState = filtersApi.defaultState();
  let rawVehicles = [];
  let busVehiclesRaw = [];
  let rawAlerts = [];
  let routeMeta = null;
  let routeHeadways = null;
  let metroData = null;
  let fetchedAt = null;
  let isFetching = false;
  let hasPlottedOnce = false;
  let focusLine = null;
  let focusVehicleId = null;
  let routeLoadToken = 0;
  let tableGranularity = "bus";
  let tableSort = { key: "line", dir: "desc" };
  const dropdownUi = {
    openId: null,
    search: Object.create(null),
    caret: null
  };

  const LOAD_SORT_RANK = { busy: 3, moderate: 2, light: 1, unknown: 0 };
  const DELAY_SORT_RANK = { late: 3, minor: 2, on_time: 1, unknown: 0 };

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

  function setHasValues(value) {
    return value instanceof Set ? value.size > 0 : Boolean(value && value !== "all");
  }

  function activeFilterCount() {
    let count = 0;
    if (filterState.lines.size) count += 1;
    if (setHasValues(filterState.load)) count += 1;
    if (setHasValues(filterState.speed)) count += 1;
    if (setHasValues(filterState.delay)) count += 1;
    if (setHasValues(filterState.alertFilter)) count += 1;
    if (setHasValues(filterState.freshness)) count += 1;
    if (filterState.colorMode !== "load") count += 1;
    if (filterState.accessibleOnly) count += 1;
    if (filterState.direction !== "all") count += 1;
    return count;
  }

  function toggleSetValue(set, id) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }

  function summarizeSelection(items, selectedSet, allLabel = "All") {
    if (!selectedSet.size) return allLabel;
    if (selectedSet.size === 1) {
      const id = [...selectedSet][0];
      return items.find((item) => item.id === id)?.label || id;
    }
    return `${selectedSet.size} selected`;
  }

  function getVehiclesForLineChart() {
    return filtersApi.apply(rawVehicles, { ...filterState, lines: new Set() }, {
      alerts: rawAlerts,
      includeMetro: false
    });
  }

  function getFilteredVehicles() {
    return filtersApi.apply(rawVehicles, filterState, {
      alerts: rawAlerts,
      includeMetro: true
    });
  }

  function getLinesForRouteDisplay() {
    if (filterState.lines.size) return [...filterState.lines];
    if (focusLine) return [focusLine];
    return [];
  }

  function markerColor(vehicle) {
    if (vehicle?.isMetro && vehicle.routeColor) return vehicle.routeColor;
    return filtersApi.vehicleMarkerColor(vehicle, filterState.colorMode);
  }

  function rebuildVehicleList(nowMs = Date.now()) {
    const estimated = metroSim && metroData
      ? metroSim.simulate(metroData, routeHeadways, nowMs)
      : [];
    rawVehicles = busVehiclesRaw.concat(estimated);
  }

  function tickMetroPositions() {
    if (!metroData || !metroSim || isFetching) return;
    rebuildVehicleList();
    const filtered = getFilteredVehicles();
    renderKpis(filtered);
    void renderMap(filtered);
  }

  function focusVehicle(vehicle) {
    if (!vehicle?.routeId || vehicle.isMetro) return;
    focusLine = String(vehicle.routeId);
    focusVehicleId = vehicle.id || null;
    mapApi?.setSelectedVehicle?.(focusVehicleId);
    mapApi?.panToVehicle?.(vehicle);
    renderAll();
  }

  function clearRouteFocus() {
    focusLine = null;
    focusVehicleId = null;
    mapApi?.setSelectedVehicle?.(null);
    mapApi?.clearRoutes?.();
  }

  function renderKpis(filtered) {
    if (!els.kpis) return;

    const buses = filtered.filter((vehicle) => !vehicle.isMetro);
    const metros = filtered.filter((vehicle) => vehicle.isMetro);
    const freshness = enrichApi.summarizeFreshness(buses);
    const delaySummary = enrichApi.summarizeDelay(filtered);
    const timeLabel = fetchedAt
      ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
      : "—";

    const isEmbed = document.body.classList.contains("stm-embed");
    const cards = [
      {
        label: "Vehicles in view",
        value: formatNum(filtered.length),
        hint: `${formatNum(buses.length)} buses · ${formatNum(metros.length)} metro trains`,
        accent: "var(--yuzu-500)"
      },
      {
        label: "On-time rate",
        value: delaySummary.onTimeRate != null ? `${delaySummary.onTimeRate}%` : "—",
        hint: `${formatNum(delaySummary.late)} late · ${formatNum(delaySummary.minor)} minor`,
        accent: "var(--zest-500)"
      },
      {
        label: "Fresh positions",
        value: formatNum(freshness.fresh),
        hint: `${formatNum(freshness.stale)} stale (>2 min)`,
        accent: "var(--kumquat-500)"
      },
      {
        label: "Active alerts",
        value: formatNum(rawAlerts.length),
        hint: filterState.lines.size ? `${filterState.lines.size} line filter(s)` : "Metro lines always on map",
        accent: "var(--info-500)"
      },
      {
        label: "Last refresh",
        value: timeLabel,
        hint: activeFilterCount() ? `${activeFilterCount()} active slicer(s)` : "Auto-refresh every 30s",
        accent: "var(--yuzu-600)"
      }
    ].filter((_, index) => !isEmbed || index < 3);

    els.kpis.innerHTML = cards.map((card) => `
      <div class="stm-kpi" style="--kpi-accent:${card.accent || "var(--yuzu-500)"}">
        <span class="stm-kpi__label">${card.label}</span>
        <span class="stm-kpi__value">${card.value}</span>
        ${card.hint ? `<span class="stm-kpi__hint">${card.hint}</span>` : ""}
      </div>
    `).join("");
  }

  function countBy(items, keyFn) {
    const counts = {};
    items.forEach((item) => {
      const key = keyFn(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function renderDropdown(container, config) {
    if (!container) return;

    const {
      id,
      label,
      items,
      selectedSet = null,
      selectedId = null,
      multi = true,
      allLabel = "All",
      onToggle,
      onSelect
    } = config;

    const searchable = items.length > 5;
    const query = String(dropdownUi.search[id] || "").trim().toLowerCase();
    const isOpen = dropdownUi.openId === id;
    const visibleItems = searchable && query
      ? items.filter((item) =>
        String(item.label || "").toLowerCase().includes(query)
        || String(item.id || "").toLowerCase().includes(query)
      )
      : items;

    const summary = multi
      ? summarizeSelection(items, selectedSet || new Set(), allLabel)
      : (items.find((item) => item.id === selectedId)?.label || allLabel);
    const active = multi ? Boolean(selectedSet?.size) : selectedId === "delay";
    const activeCount = multi ? (selectedSet?.size || 0) : 0;

    container.className = `stm-filter-dd${isOpen ? " stm-filter-dd--open" : ""}${active ? " stm-filter-dd--active" : ""}`;
    container.innerHTML = `
      <button type="button" class="stm-filter-dd__trigger" aria-haspopup="listbox" aria-expanded="${isOpen}" data-dd-trigger="${escapeHtml(id)}">
        <span class="stm-filter-dd__label">${escapeHtml(label)}</span>
        <span class="stm-filter-dd__value">${escapeHtml(summary)}${activeCount > 1 ? ` (${activeCount})` : ""}</span>
        <span class="stm-filter-dd__chevron" aria-hidden="true"></span>
      </button>
      <div class="stm-filter-dd__panel" role="listbox" ${multi ? 'aria-multiselectable="true"' : ""} ${isOpen ? "" : "hidden"}>
        ${searchable ? `
          <div class="stm-filter-dd__search">
            <input type="search" class="stm-filter-dd__search-input" data-dd-search="${escapeHtml(id)}" placeholder="Search…" value="${escapeHtml(dropdownUi.search[id] || "")}" aria-label="Search ${escapeHtml(label)}">
          </div>` : ""}
        <div class="stm-filter-dd__options">
          ${visibleItems.length ? visibleItems.map((item) => {
            const checked = multi
              ? selectedSet?.has(item.id)
              : selectedId === item.id;
            const count = item.count != null
              ? `<span class="stm-filter-dd__count">${formatNum(item.count)}</span>`
              : "";
            return `
              <label class="stm-filter-dd__option${checked ? " stm-filter-dd__option--checked" : ""}">
                <input type="${multi ? "checkbox" : "radio"}" name="stm-dd-${escapeHtml(id)}" value="${escapeHtml(item.id)}" ${checked ? "checked" : ""} data-dd-option="${escapeHtml(id)}">
                <span class="stm-filter-dd__option-label">${escapeHtml(item.label)}</span>
                ${count}
              </label>`;
          }).join("") : `<p class="stm-filter-dd__empty">No matches</p>`}
        </div>
        ${multi ? `
          <div class="stm-filter-dd__footer">
            <button type="button" class="stm-filter-dd__clear" data-dd-clear="${escapeHtml(id)}" ${selectedSet?.size ? "" : "disabled"}>Clear</button>
          </div>` : ""}
      </div>
    `;

    container.addEventListener("click", (event) => event.stopPropagation());

    container.querySelector("[data-dd-trigger]")?.addEventListener("click", () => {
      dropdownUi.openId = dropdownUi.openId === id ? null : id;
      renderFilterDropdowns();
    });

    container.querySelector("[data-dd-search]")?.addEventListener("input", (event) => {
      dropdownUi.search[id] = event.target.value;
      dropdownUi.caret = {
        id,
        start: event.target.selectionStart,
        end: event.target.selectionEnd
      };
      renderFilterDropdowns();
    });

    container.querySelectorAll("[data-dd-option]").forEach((input) => {
      input.addEventListener("change", () => {
        if (multi) onToggle?.(input.value);
        else onSelect?.(input.value);
        renderAll();
      });
    });

    container.querySelector("[data-dd-clear]")?.addEventListener("click", () => {
      selectedSet?.clear();
      renderAll();
    });

    if (isOpen && searchable && dropdownUi.caret?.id === id) {
      const caret = dropdownUi.caret;
      dropdownUi.caret = null;
      requestAnimationFrame(() => {
        if (dropdownUi.openId !== id) return;
        const live = container.querySelector("[data-dd-search]");
        if (!live) return;
        live.focus();
        const max = live.value.length;
        live.setSelectionRange(
          Math.min(caret.start ?? max, max),
          Math.min(caret.end ?? max, max)
        );
      });
    }
  }

  function busVehicles() {
    return rawVehicles.filter((vehicle) => !vehicle.isMetro);
  }

  function renderLineSlicers() {
    const routes = filtersApi.buildRouteIndex(getVehiclesForLineChart(), {
      alerts: rawAlerts,
      meta: routeMeta,
      alertFilter: filterState.alertFilter
    });
    renderDropdown(els.lineSlicers, {
      id: "line",
      label: "Lines",
      allLabel: "All lines",
      items: routes.map((route) => ({
        id: route.routeId,
        label: route.name ? `${route.routeId} · ${route.name}` : `Line ${route.routeId}`,
        count: route.count
      })),
      selectedSet: filterState.lines,
      onToggle: (id) => {
        toggleSetValue(filterState.lines, id);
        if (filterState.lines.size) {
          clearRouteFocus();
          filterState.direction = "all";
        }
      }
    });
  }

  function renderLoadSlicers() {
    const counts = countBy(busVehicles(), (v) => filtersApi.getLoadProfile(v));
    renderDropdown(els.loadSlicers, {
      id: "load",
      label: "Passenger load",
      allLabel: "All loads",
      items: filtersApi.LOAD_PROFILES.map((profile) => ({
        ...profile,
        count: counts[profile.id] || 0
      })),
      selectedSet: filterState.load,
      onToggle: (id) => toggleSetValue(filterState.load, id)
    });
  }

  function renderSpeedSlicers() {
    const counts = countBy(busVehicles(), (v) => v.speedBand || "unknown");
    renderDropdown(els.speedSlicers, {
      id: "speed",
      label: "Speed band",
      allLabel: "All speeds",
      items: filtersApi.SPEED_BANDS.map((band) => ({
        ...band,
        count: counts[band.id] || 0
      })),
      selectedSet: filterState.speed,
      onToggle: (id) => toggleSetValue(filterState.speed, id)
    });
  }

  function renderDelaySlicers() {
    const counts = countBy(busVehicles(), (v) => v.delayStatus || "unknown");
    renderDropdown(els.delaySlicers, {
      id: "delay",
      label: "Delay status",
      allLabel: "All delays",
      items: filtersApi.DELAY_STATES.map((state) => ({
        ...state,
        count: counts[state.id] || 0
      })),
      selectedSet: filterState.delay,
      onToggle: (id) => toggleSetValue(filterState.delay, id)
    });
  }

  function renderAlertSlicers() {
    renderDropdown(els.alertSlicers, {
      id: "alert",
      label: "Service alerts",
      allLabel: "All lines",
      items: filtersApi.ALERT_FILTERS,
      selectedSet: filterState.alertFilter,
      onToggle: (id) => toggleSetValue(filterState.alertFilter, id)
    });
  }

  function renderFreshnessSlicers() {
    const counts = countBy(busVehicles(), (v) => (v.isStale ? "stale" : "fresh"));
    renderDropdown(els.freshnessSlicers, {
      id: "freshness",
      label: "Freshness",
      allLabel: "All positions",
      items: filtersApi.FRESHNESS_FILTERS.map((item) => ({
        ...item,
        count: counts[item.id] || 0
      })),
      selectedSet: filterState.freshness,
      onToggle: (id) => toggleSetValue(filterState.freshness, id)
    });
  }

  function renderColorSlicers() {
    renderDropdown(els.colorSlicers, {
      id: "color",
      label: "Map colours",
      multi: false,
      selectedId: filterState.colorMode,
      items: filtersApi.COLOR_MODES,
      onSelect: (id) => {
        filterState.colorMode = id;
        dropdownUi.openId = null;
      }
    });
  }

  function renderFilterDropdowns() {
    renderLineSlicers();
    renderLoadSlicers();
    renderSpeedSlicers();
    renderDelaySlicers();
    renderAlertSlicers();
    renderFreshnessSlicers();
    renderColorSlicers();
  }

  function renderDirectionSelect() {
    if (!els.directionSelect) return;
    const lines = getLinesForRouteDisplay();
    const show = lines.length === 1;

    els.directionSelect.hidden = !show;
    if (!show) {
      filterState.direction = "all";
      return;
    }

    routesApi.fetchRoute(lines[0]).then((route) => {
      if (!route) return;
      const options = ["all", ...filtersApi.shapeOptions(route)];
      els.directionSelect.innerHTML = options.map((value) => `
        <option value="${escapeHtml(value)}"${filterState.direction === value ? " selected" : ""}>
          ${value === "all" ? "All directions" : escapeHtml(value)}
        </option>
      `).join("");
    });
  }

  function labelsForSet(items, selectedSet) {
    return items
      .filter((item) => selectedSet.has(item.id))
      .map((item) => item.label);
  }

  function renderFilterSummary(filtered) {
    if (!els.filterSummary) return;

    const parts = [];
    if (filterState.lines.size) {
      const lineIds = [...filterState.lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      parts.push(lineIds.length <= 3
        ? `Lines: ${lineIds.join(", ")}`
        : `Lines: ${lineIds.length} selected`);
    }
    const multiParts = [
      ["load", filtersApi.LOAD_PROFILES],
      ["speed", filtersApi.SPEED_BANDS],
      ["delay", filtersApi.DELAY_STATES],
      ["alertFilter", filtersApi.ALERT_FILTERS],
      ["freshness", filtersApi.FRESHNESS_FILTERS]
    ];
    multiParts.forEach(([key, list]) => {
      const selected = filterState[key];
      if (!(selected instanceof Set) || !selected.size) return;
      parts.push(...labelsForSet(list, selected));
    });
    if (filterState.colorMode === "delay") parts.push("Delay colours");
    if (filterState.accessibleOnly) parts.push("Accessible stops only");

    els.filterSummary.textContent = parts.length
      ? `${formatNum(filtered.length)} vehicles match · ${parts.join(" · ")}`
      : `${formatNum(filtered.length)} vehicles shown · metro lines always visible`;
  }

  function setTableGranularity(mode) {
    if (mode !== "bus" && mode !== "line") return;
    if (tableGranularity === mode) return;
    tableGranularity = mode;
    tableSort = {
      key: mode === "line" ? "buses" : "line",
      dir: "desc"
    };
    renderAll();
  }

  function toggleTableSort(key) {
    if (!key) return;
    if (tableSort.key === key) {
      tableSort = { key, dir: tableSort.dir === "desc" ? "asc" : "desc" };
    } else {
      tableSort = { key, dir: "desc" };
    }
    renderVehicleTable(getFilteredVehicles());
    updateTableGranularityControls();
  }

  function compareSortValues(a, b, dir) {
    const mul = dir === "asc" ? 1 : -1;
    const aMissing = a == null || Number.isNaN(a);
    const bMissing = b == null || Number.isNaN(b);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (typeof a === "number" && typeof b === "number") return (a - b) * mul;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * mul;
  }

  function sortRows(rows, valueFor) {
    return rows.slice().sort((left, right) => {
      const primary = compareSortValues(valueFor(left), valueFor(right), tableSort.dir);
      if (primary) return primary;
      return compareSortValues(left.routeId, right.routeId, "asc");
    });
  }

  function sortHeaderButton(key, label) {
    const active = tableSort.key === key;
    const ariaSort = !active ? "none" : (tableSort.dir === "asc" ? "ascending" : "descending");
    const marker = !active ? "" : (tableSort.dir === "asc" ? " ↑" : " ↓");
    return `
      <th aria-sort="${ariaSort}">
        <button type="button" class="stm-sort-btn${active ? " stm-sort-btn--active" : ""}" data-sort-key="${escapeHtml(key)}">
          ${escapeHtml(label)}${marker}
        </button>
      </th>`;
  }

  function buildLineRows(buses) {
    const groups = new Map();

    buses.forEach((vehicle) => {
      const routeId = String(vehicle.routeId || "").trim();
      if (!routeId) return;
      const current = groups.get(routeId) || {
        routeId,
        buses: 0,
        loadScoreTotal: 0,
        loadScoreCount: 0,
        loadCounts: { light: 0, moderate: 0, busy: 0, unknown: 0 },
        delayTotal: 0,
        delayCount: 0,
        delayRankTotal: 0,
        delayStatusCounts: { on_time: 0, minor: 0, late: 0, unknown: 0 },
        fresh: 0,
        stale: 0,
        speedTotal: 0,
        speedCount: 0,
        sampleVehicle: vehicle
      };

      current.buses += 1;
      const load = filtersApi.getLoadProfile(vehicle);
      current.loadCounts[load] = (current.loadCounts[load] || 0) + 1;
      if (vehicle.occupancyScore != null) {
        current.loadScoreTotal += vehicle.occupancyScore;
        current.loadScoreCount += 1;
      }

      const delayStatus = vehicle.delayStatus || "unknown";
      current.delayStatusCounts[delayStatus] = (current.delayStatusCounts[delayStatus] || 0) + 1;
      current.delayRankTotal += DELAY_SORT_RANK[delayStatus] || 0;
      if (vehicle.delay != null) {
        current.delayTotal += Number(vehicle.delay);
        current.delayCount += 1;
      }

      if (vehicle.isStale) current.stale += 1;
      else current.fresh += 1;

      if (vehicle.speed != null && Number.isFinite(Number(vehicle.speed))) {
        current.speedTotal += Number(vehicle.speed);
        current.speedCount += 1;
      }

      groups.set(routeId, current);
    });

    return [...groups.values()].map((row) => {
      const dominantLoad = Object.entries(row.loadCounts)
        .sort((a, b) => b[1] - a[1] || (LOAD_SORT_RANK[b[0]] || 0) - (LOAD_SORT_RANK[a[0]] || 0))[0]?.[0] || "unknown";
      const dominantDelay = Object.entries(row.delayStatusCounts)
        .sort((a, b) => b[1] - a[1] || (DELAY_SORT_RANK[b[0]] || 0) - (DELAY_SORT_RANK[a[0]] || 0))[0]?.[0] || "unknown";
      const avgDelayMin = row.delayCount ? row.delayTotal / row.delayCount / 60 : null;
      const avgSpeedKmh = row.speedCount ? (row.speedTotal / row.speedCount) * 3.6 : null;
      const freshShare = row.buses ? row.fresh / row.buses : 0;
      const routeName = routeMeta?.routes?.[row.routeId]?.name || "";

      return {
        ...row,
        routeName,
        loadProfile: dominantLoad,
        delayStatus: dominantDelay,
        avgDelayMin,
        avgSpeedKmh,
        freshShare,
        avgLoadScore: row.loadScoreCount ? row.loadScoreTotal / row.loadScoreCount : LOAD_SORT_RANK[dominantLoad] || 0
      };
    });
  }

  function updateTableGranularityControls() {
    const isBus = tableGranularity === "bus";
    if (els.tableTitle) {
      els.tableTitle.textContent = isBus ? "Filtered buses" : "Filtered lines";
    }
    if (els.tableGranularityBus) {
      els.tableGranularityBus.setAttribute("aria-pressed", isBus ? "true" : "false");
      els.tableGranularityBus.classList.toggle("stm-segmented__btn--active", isBus);
    }
    if (els.tableGranularityLine) {
      els.tableGranularityLine.setAttribute("aria-pressed", isBus ? "false" : "true");
      els.tableGranularityLine.classList.toggle("stm-segmented__btn--active", !isBus);
    }
  }

  function renderBusTable(buses) {
    const rows = sortRows(buses, (vehicle) => {
      switch (tableSort.key) {
        case "vehicle": return vehicle.id || "";
        case "load": return LOAD_SORT_RANK[filtersApi.getLoadProfile(vehicle)] ?? 0;
        case "delay": return vehicle.delay != null ? Number(vehicle.delay) : null;
        case "freshness": return vehicle.isStale ? 0 : 1;
        case "speed": return vehicle.speed != null ? Number(vehicle.speed) : null;
        case "line":
        default: return String(vehicle.routeId || "");
      }
    }).slice(0, 80);

    if (!rows.length) {
      els.vehicleTable.innerHTML = `<p class="stm-empty">No buses to list for the current filters.</p>`;
      return;
    }

    els.vehicleTable.innerHTML = `
      <table class="stm-table stm-table--compact">
        <thead>
          <tr>
            ${sortHeaderButton("line", "Line")}
            ${sortHeaderButton("vehicle", "Vehicle")}
            ${sortHeaderButton("load", "Load")}
            ${sortHeaderButton("delay", "Delay")}
            ${sortHeaderButton("freshness", "Freshness")}
            ${sortHeaderButton("speed", "Speed")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((vehicle) => {
            const selected = focusVehicleId && String(vehicle.id) === String(focusVehicleId);
            const routeName = routeMeta?.routes?.[vehicle.routeId]?.name;
            return `
            <tr class="stm-table-row${selected ? " stm-table-row--selected" : ""}" data-vehicle-id="${escapeHtml(vehicle.id || "")}" tabindex="0" role="button">
              <td><strong>${escapeHtml(vehicle.routeId || "—")}</strong>${routeName ? `<div class="stm-table-sub">${escapeHtml(routeName)}</div>` : ""}</td>
              <td>${escapeHtml(vehicle.id || "—")}</td>
              <td><span class="stm-pill stm-pill--${filtersApi.getLoadProfile(vehicle)}">${escapeHtml((vehicle.occupancyLabel || "unknown").replace(/_/g, " "))}</span></td>
              <td><span class="stm-pill stm-pill--${vehicle.delayStatus || "unknown"}">${vehicle.delay != null ? `${Math.round(vehicle.delay / 60)}m` : "—"}</span></td>
              <td>${vehicle.isStale ? "Stale" : "Fresh"}</td>
              <td>${vehicle.speed != null ? `${Math.round(Number(vehicle.speed) * 3.6)} km/h` : "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="stm-table-hint">Click a column header to sort · click a row to show that bus line on the map.</p>`;

    const selectRow = (row) => {
      const vehicle = rows.find((item) => String(item.id) === row.dataset.vehicleId);
      if (vehicle) focusVehicle(vehicle);
    };

    els.vehicleTable.onclick = (event) => {
      const sortBtn = event.target.closest("[data-sort-key]");
      if (sortBtn) {
        toggleTableSort(sortBtn.dataset.sortKey);
        return;
      }
      const row = event.target.closest(".stm-table-row");
      if (row) selectRow(row);
    };
    els.vehicleTable.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest(".stm-table-row");
      if (!row) return;
      event.preventDefault();
      selectRow(row);
    };
  }

  function renderLineTable(buses) {
    const rows = sortRows(buildLineRows(buses), (row) => {
      switch (tableSort.key) {
        case "buses": return row.buses;
        case "load": return row.avgLoadScore;
        case "delay": return row.avgDelayMin;
        case "freshness": return row.freshShare;
        case "speed": return row.avgSpeedKmh;
        case "line":
        default: return String(row.routeId || "");
      }
    });

    if (!rows.length) {
      els.vehicleTable.innerHTML = `<p class="stm-empty">No lines to list for the current filters.</p>`;
      return;
    }

    els.vehicleTable.innerHTML = `
      <table class="stm-table stm-table--compact">
        <thead>
          <tr>
            ${sortHeaderButton("line", "Line")}
            ${sortHeaderButton("buses", "Buses")}
            ${sortHeaderButton("load", "Load")}
            ${sortHeaderButton("delay", "Avg delay")}
            ${sortHeaderButton("freshness", "Freshness")}
            ${sortHeaderButton("speed", "Avg speed")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const selected = focusLine && String(focusLine) === String(row.routeId) && !focusVehicleId;
            const delayLabel = row.avgDelayMin != null ? `${row.avgDelayMin.toFixed(1)}m` : "—";
            const freshLabel = `${Math.round(row.freshShare * 100)}% fresh`;
            const speedLabel = row.avgSpeedKmh != null ? `${Math.round(row.avgSpeedKmh)} km/h` : "—";
            return `
            <tr class="stm-table-row${selected ? " stm-table-row--selected" : ""}" data-route-id="${escapeHtml(row.routeId || "")}" tabindex="0" role="button">
              <td><strong>${escapeHtml(row.routeId || "—")}</strong>${row.routeName ? `<div class="stm-table-sub">${escapeHtml(row.routeName)}</div>` : ""}</td>
              <td>${formatNum(row.buses)}</td>
              <td><span class="stm-pill stm-pill--${row.loadProfile}">${escapeHtml(row.loadProfile)}</span></td>
              <td><span class="stm-pill stm-pill--${row.delayStatus}">${delayLabel}</span></td>
              <td>${freshLabel}<div class="stm-table-sub">${formatNum(row.fresh)} fresh · ${formatNum(row.stale)} stale</div></td>
              <td>${speedLabel}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="stm-table-hint">Click a column header to sort · click a row to show that line path on the map.</p>`;

    const selectRow = (row) => {
      const routeId = row.dataset.routeId;
      if (!routeId) return;
      focusLine = routeId;
      focusVehicleId = null;
      mapApi?.setSelectedVehicle?.(null);
      filterState.direction = "all";
      renderAll();
    };

    els.vehicleTable.onclick = (event) => {
      const sortBtn = event.target.closest("[data-sort-key]");
      if (sortBtn) {
        toggleTableSort(sortBtn.dataset.sortKey);
        return;
      }
      const row = event.target.closest(".stm-table-row");
      if (row) selectRow(row);
    };
    els.vehicleTable.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest(".stm-table-row");
      if (!row) return;
      event.preventDefault();
      selectRow(row);
    };
  }

  function renderVehicleTable(filtered) {
    if (!els.vehicleTable) return;
    updateTableGranularityControls();
    const buses = filtered.filter((vehicle) => !vehicle.isMetro);
    if (tableGranularity === "line") renderLineTable(buses);
    else renderBusTable(buses);
  }

  function updateMapLegend() {
    if (els.mapLegendLoad) els.mapLegendLoad.hidden = filterState.colorMode !== "load";
    if (els.mapLegendDelay) els.mapLegendDelay.hidden = filterState.colorMode !== "delay";
  }

  async function renderMap(filtered) {
    const linesToShow = getLinesForRouteDisplay();
    const shouldFitVehicles = (activeFilterCount() > 0 || !hasPlottedOnce) && !linesToShow.length;

    const plotted = mapApi?.plotVehicles(filtered, {
      colorFor: markerColor,
      fitBounds: shouldFitVehicles,
      preserveBounds: linesToShow.length > 0,
      filters: filtersApi,
      meta: routeMeta,
      headways: routeHeadways,
      colorMode: filterState.colorMode
    }) || 0;
    if (plotted) hasPlottedOnce = true;

    updateMapLegend();

    const token = ++routeLoadToken;
    if (linesToShow.length && routesApi?.fetchRoutes) {
      const routePayloads = await routesApi.fetchRoutes(linesToShow);
      if (token !== routeLoadToken) return plotted;

      if (routePayloads.length) {
        mapApi?.plotRoutes?.(routePayloads, {
          alerts: rawAlerts,
          filters: filtersApi,
          fitBounds: true,
          direction: filterState.direction,
          accessibleOnly: filterState.accessibleOnly,
          headways: routeHeadways
        });
      } else {
        mapApi?.clearRoutes?.();
      }
    } else {
      mapApi?.clearRoutes?.();
    }

      if (els.mapCaption) {
      const metros = filtered.filter((vehicle) => vehicle.isMetro).length;
      const buses = filtered.filter((vehicle) => !vehicle.isMetro).length;
      const lineHint = linesToShow.length ? ` · bus path ${linesToShow.join(", ")}` : "";
      els.mapCaption.textContent = plotted
        ? `${formatNum(buses)} buses · ${formatNum(metros)} metro trains (headway estimate)${lineHint} · ${filterState.colorMode === "delay" ? "colour = delay" : "colour = load"}`
        : linesToShow.length
          ? `Showing line path for ${linesToShow.join(", ")}`
          : "No vehicles match the current slicers · metro lines remain visible";
    }

    return plotted;
  }

  function renderAll() {
    const filtered = getFilteredVehicles();

    renderKpis(filtered);
    renderFilterDropdowns();
    renderDirectionSelect();
    renderFilterSummary(filtered);
    renderVehicleTable(filtered);
    void renderMap(filtered);

    if (els.clearFiltersBtn) {
      els.clearFiltersBtn.disabled = activeFilterCount() === 0 && !focusLine;
    }
  }

  function clearFilters() {
    filterState = filtersApi.defaultState();
    dropdownUi.openId = null;
    dropdownUi.search = Object.create(null);
    dropdownUi.caret = null;
    if (els.accessibleToggle) els.accessibleToggle.checked = false;
    clearRouteFocus();
    mapApi?.resetBounds?.();
    hasPlottedOnce = false;
    routeLoadToken += 1;
    renderAll();
  }

  async function loadStaticData() {
    const [metro, meta, headways] = await Promise.all([
      routesApi.fetchMetro(),
      routesApi.fetchMeta(),
      routesApi.fetchHeadways()
    ]);
    metroData = metro;
    routeMeta = meta;
    routeHeadways = headways;
    if (metroData) mapApi?.plotMetroLines?.(metroData);
    rebuildVehicleList();
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
      const [servicePayload, vehiclePayload, tripPayload] = await Promise.all([
        data.fetchServiceStatus(),
        data.fetchVehiclePositions(),
        data.fetchTripUpdates()
      ]);

      if (!routeMeta) await loadStaticData();
      else if (metroData) mapApi?.plotMetroLines?.(metroData);

      rawAlerts = servicePayload?.serviceStatus?.alerts || [];
      fetchedAt = vehiclePayload.fetchedAt || servicePayload.fetchedAt;

      busVehiclesRaw = enrichApi.enrichVehicles(vehiclePayload.vehicles || [], {
        tripUpdates: tripPayload.tripUpdates || [],
        meta: routeMeta
      }).filter((vehicle) => !vehicle.isMetro);

      rebuildVehicleList();
      renderAll();

      const timeLabel = fetchedAt
        ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
        : "now";
      setStatus(`Live STM data · refreshed ${timeLabel}`, "ok");
    } catch (error) {
      const message = String(error?.message || error);
      setStatus(message.toLowerCase().includes("stm_api_key")
        ? "STM_API_KEY missing on server. Add it in Supabase Edge Function secrets."
        : message, "error");
      if (els.mapCaption) els.mapCaption.textContent = "Could not load live vehicle positions.";
    } finally {
      isFetching = false;
      root.classList.remove("stm-dashboard--loading");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(refresh, data.config().refreshMs || 30000);
    clearInterval(metroAnimTimer);
    metroAnimTimer = window.setInterval(tickMetroPositions, 3000);
  }

  els.refreshBtn?.addEventListener("click", refresh);
  els.clearFiltersBtn?.addEventListener("click", clearFilters);
  els.tableGranularityBus?.addEventListener("click", () => setTableGranularity("bus"));
  els.tableGranularityLine?.addEventListener("click", () => setTableGranularity("line"));
  els.directionSelect?.addEventListener("change", (event) => {
    filterState.direction = event.target.value;
    renderAll();
  });
  els.accessibleToggle?.addEventListener("change", (event) => {
    filterState.accessibleOnly = event.target.checked;
    renderAll();
  });

  document.addEventListener("click", (event) => {
    if (!dropdownUi.openId) return;
    if (event.target.closest(".stm-filter-dd")) return;
    dropdownUi.openId = null;
    renderFilterDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !dropdownUi.openId) return;
    dropdownUi.openId = null;
    renderFilterDropdowns();
  });

  mapApi?.init("stmLiveMap");
  mapApi?.invalidate?.();
  mapApi?.setVehicleSelectHandler?.((vehicle) => {
    focusVehicleId = vehicle.id || null;
    mapApi?.setSelectedVehicle?.(focusVehicleId);
    if (filterState.lines.size) {
      mapApi?.plotVehicles(getFilteredVehicles(), {
        colorFor: markerColor,
        fitBounds: false,
        preserveBounds: true,
        filters: filtersApi,
        meta: routeMeta,
        headways: routeHeadways,
        colorMode: filterState.colorMode
      });
      return;
    }
    focusVehicle(vehicle);
  });

  loadStaticData()
    .then(() => {
      if (rawVehicles.length) renderAll();
      return refresh();
    })
    .catch(() => {});
  scheduleRefresh();
})();

(function initStmLateDashboard() {
  const root = document.getElementById("stmLateDashboard");
  const data = window.StmData;
  const analysis = window.StmLateAnalysis;
  if (!root || !data || !analysis) return;

  const els = {
    status: document.getElementById("stmLateStatus"),
    kpis: document.getElementById("stmLateKpis"),
    topLines: document.getElementById("stmLateTopLines"),
    distribution: document.getElementById("stmLateDistribution"),
    meta: document.getElementById("stmLateMeta"),
    refreshBtn: document.getElementById("stmLateRefreshBtn")
  };

  let refreshTimer = null;
  let isFetching = false;

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

  function renderKpis(summary, fetchedAt) {
    if (!els.kpis) return;

    const timeLabel = fetchedAt
      ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
      : "—";

    const cards = [
      {
        label: "Trips monitored",
        value: formatNum(summary.totalTrips),
        hint: "GTFS-RT trip updates",
        accent: "var(--yuzu-500)"
      },
      {
        label: "Late arrivals",
        value: formatNum(summary.lateTrips),
        hint: `≥ ${analysis.formatDelay(summary.lateThresholdSec)} behind schedule`,
        accent: "var(--error-500)"
      },
      {
        label: "On-time rate",
        value: `${summary.onTimeRate}%`,
        hint: `${formatNum(summary.minorTrips)} minor delays`,
        accent: "var(--zest-500)"
      },
      {
        label: "Worst delay",
        value: analysis.formatDelay(summary.maxDelay),
        hint: `Avg delay ${analysis.formatDelay(summary.avgDelay)} · ${timeLabel}`,
        accent: "var(--kumquat-500)"
      }
    ];

    els.kpis.innerHTML = cards.map((card) => `
      <div class="stm-kpi" style="--kpi-accent:${card.accent}">
        <span class="stm-kpi__label">${card.label}</span>
        <span class="stm-kpi__value">${card.value}</span>
        ${card.hint ? `<span class="stm-kpi__hint">${card.hint}</span>` : ""}
      </div>
    `).join("");
  }

  function renderDistribution(summary) {
    if (!els.distribution) return;

    const max = Math.max(...summary.buckets.map((bucket) => bucket.count), 1);
    els.distribution.innerHTML = summary.buckets.map((bucket) => {
      const width = Math.max(6, Math.round((bucket.count / max) * 100));
      return `
        <div class="stm-delay-bucket">
          <div class="stm-delay-bucket__head">
            <span>${escapeHtml(bucket.label)}</span>
            <strong>${formatNum(bucket.count)}</strong>
          </div>
          <span class="stm-bar-row__track" aria-hidden="true">
            <span class="stm-bar-row__fill stm-bar-row__fill--${bucket.id}" style="width:${width}%"></span>
          </span>
        </div>
      `;
    }).join("");
  }

  function renderTopLines(summary) {
    if (!els.topLines) return;

    if (!summary.topLateLines.length) {
      els.topLines.innerHTML = `<p class="stm-empty">No trip updates returned for this refresh.</p>`;
      return;
    }

    const hasLateLines = summary.topLateLines.some((line) => line.lateCount > 0);
    const subtitle = hasLateLines
      ? "Ranked by late trip count, then average delay"
      : "No trips crossed the late threshold in this snapshot — showing highest average delays";

    els.topLines.innerHTML = `
      <p class="stm-card-meta">${subtitle}</p>
      <table class="stm-table stm-table--ranked">
        <thead>
          <tr>
            <th>#</th>
            <th>Line</th>
            <th>Late trips</th>
            <th>Avg delay</th>
            <th>Max delay</th>
            <th>Trips</th>
          </tr>
        </thead>
        <tbody>
          ${summary.topLateLines.map((line, index) => `
            <tr>
              <td><span class="stm-rank">${index + 1}</span></td>
              <td><strong>Line ${escapeHtml(line.routeId)}</strong></td>
              <td>${formatNum(line.lateCount)}</td>
              <td>${analysis.formatDelay(line.avgDelay)}</td>
              <td>${analysis.formatDelay(line.maxDelay)}</td>
              <td>${formatNum(line.tripCount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="stm-late-bars" aria-hidden="true">
        ${summary.topLateLines.map((line) => {
          const width = summary.maxDelay
            ? Math.max(8, Math.round((line.maxDelay / summary.maxDelay) * 100))
            : 8;
          return `
            <div class="stm-late-bar-row">
              <span>Line ${escapeHtml(line.routeId)}</span>
              <span class="stm-bar-row__track">
                <span class="stm-bar-row__fill stm-bar-row__fill--late" style="width:${width}%"></span>
              </span>
              <span>${analysis.formatDelay(line.maxDelay)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderMeta(summary, payload) {
    if (!els.meta) return;

    const entityCount = payload?.entityCount || summary.totalTrips;
    const capped = payload?.tripUpdateCount && payload?.entityCount > payload?.tripUpdateCount;
    els.meta.textContent = capped
      ? `Analysing ${formatNum(summary.totalTrips)} of ${formatNum(entityCount)} trip updates · late = ${analysis.formatDelay(summary.lateThresholdSec)} or more`
      : `Analysing ${formatNum(summary.totalTrips)} trip updates · late = ${analysis.formatDelay(summary.lateThresholdSec)} or more`;
  }

  async function refresh() {
    if (!data.isConfigured()) {
      setStatus("STM demo not configured. See scripts/stm_setup.md", "error");
      return;
    }

    if (isFetching) return;
    isFetching = true;
    root.classList.add("stm-dashboard--loading");
    setStatus("Loading trip updates…", "loading");

    try {
      const payload = await data.fetchTripUpdates();
      const summary = analysis.summarize(payload.tripUpdates || []);
      const fetchedAt = payload.fetchedAt;

      renderKpis(summary, fetchedAt);
      renderDistribution(summary);
      renderTopLines(summary);
      renderMeta(summary, payload);

      const timeLabel = fetchedAt
        ? new Date(fetchedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
        : "now";
      setStatus(`Trip delay analysis · refreshed ${timeLabel}`, "ok");
    } catch (error) {
      setStatus(String(error?.message || error), "error");
    } finally {
      isFetching = false;
      root.classList.remove("stm-dashboard--loading");
    }
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(refresh, data.config().refreshMs || 30000);
  }

  els.refreshBtn?.addEventListener("click", refresh);
  refresh();
  scheduleRefresh();
})();

window.RefreshWatchdogTable = {
  instances: new Map(),

  init(config) {
    const data = window.RefreshWatchdogData;
    if (!data) return null;

    const instance = {
      id: config.id,
      tbody: document.getElementById(config.tbodyId),
      statusEl: config.statusId ? document.getElementById(config.statusId) : null,
      limit: config.limit || 5,
      highlightId: '',
      burstTimer: null,
      idleTimer: null,
      idleMs: config.idleMs || 30000
    };

    if (!instance.tbody) return null;

    this.instances.set(config.id, instance);
    this.load(config.id);
    this.startIdlePolling(config.id);
    return instance;
  },

  formatDate(iso) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch (_) {
      return iso;
    }
  },

  formatDuration(seconds) {
    const value = Number(seconds) || 0;
    const minutes = Math.floor(value / 60);
    const secs = value % 60;
    return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  },

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  statusLabel(status) {
    return status === 'alert' ? 'Alert' : 'OK';
  },

  render(instance, entries) {
    const data = window.RefreshWatchdogData;
    const { tbody, limit, highlightId } = instance;
    const rows = entries.slice(0, limit);

    if (!rows.length) {
      tbody.innerHTML = `
        <tr class="opp-empty-row">
          <td colspan="5">No runs yet. Trigger a refresh to add the first row.</td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((entry) => {
      const isNew = highlightId && entry.id === highlightId;
      const statusKey = this.escapeHtml(entry.status || 'ok');
      const statusLabel = this.escapeHtml(this.statusLabel(entry.status));
      const pipeline = this.escapeHtml(data.pipelineLabel(entry.pipeline));
      return `
        <tr class="${isNew ? 'opp-row--new' : ''}">
          <td data-label="When">${this.escapeHtml(this.formatDate(entry.started_at))}</td>
          <td data-label="Pipeline">${pipeline}</td>
          <td data-label="Duration">${this.escapeHtml(this.formatDuration(entry.duration_seconds))}</td>
          <td data-label="SLA">${this.escapeHtml(`${entry.sla_minutes} min`)}</td>
          <td data-label="Status"><span class="refresh-status refresh-status--${statusKey}">${statusLabel}</span></td>
        </tr>`;
    }).join('');
  },

  setStatus(instance, message, isError) {
    if (!instance.statusEl) return;
    instance.statusEl.textContent = message;
    instance.statusEl.classList.toggle('opp-status-msg--error', Boolean(isError));
  },

  async load(id, { quiet } = {}) {
    const instance = this.instances.get(id);
    const data = window.RefreshWatchdogData;
    if (!instance || !data) return [];

    if (!quiet) {
      this.setStatus(instance, 'Refreshing…', false);
    }

    try {
      const entries = await data.fetchRuns(instance.limit);
      this.render(instance, entries);

      const found = instance.highlightId
        && entries.some((entry) => entry.id === instance.highlightId);

      let status = `Latest ${Math.min(entries.length, instance.limit)}`;
      if (instance.highlightId && found) {
        status += ' · your run is in';
      } else if (instance.highlightId) {
        status += ' · looking for your run…';
      }

      this.setStatus(instance, status, false);
      return entries;
    } catch (_) {
      this.setStatus(instance, 'Could not load table. Retrying…', true);
      return [];
    }
  },

  clearBurst(id) {
    const instance = this.instances.get(id);
    if (instance?.burstTimer) {
      clearInterval(instance.burstTimer);
      instance.burstTimer = null;
    }
  },

  startIdlePolling(id) {
    const instance = this.instances.get(id);
    if (!instance) return;

    if (instance.idleTimer) {
      clearInterval(instance.idleTimer);
    }

    instance.idleTimer = window.setInterval(
      () => this.load(id, { quiet: true }),
      instance.idleMs
    );
  },

  afterSubmit(id, rowId) {
    const instance = this.instances.get(id);
    if (!instance) return;

    instance.highlightId = rowId;
    this.clearBurst(id);

    let ticks = 0;
    const maxTicks = 5;

    this.load(id, { quiet: true });

    instance.burstTimer = window.setInterval(async () => {
      ticks += 1;
      const entries = await this.load(id, { quiet: true });
      const found = entries.some((entry) => entry.id === rowId);

      if (found || ticks >= maxTicks) {
        this.clearBurst(id);
        if (found) {
          this.setStatus(
            instance,
            `Latest ${Math.min(entries.length, instance.limit)} · your run appeared`,
            false
          );
        }
      }
    }, 2000);
  }
};

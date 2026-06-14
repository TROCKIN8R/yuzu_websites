window.OpportunityTable = {
    instances: new Map(),

    init(config) {
        const data = window.OpportunityData;
        if (!data) return null;

        const instance = {
            id: config.id,
            tbody: document.getElementById(config.tbodyId),
            statusEl: config.statusId ? document.getElementById(config.statusId) : null,
            limit: config.limit || 5,
            highlightName: '',
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

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    normalizeStatus(value) {
        const key = String(value || 'sent').trim().toLowerCase();
        return key === 'pending' ? 'sent' : key;
    },

    statusLabel(key) {
        return key.charAt(0).toUpperCase() + key.slice(1);
    },

    render(instance, entries) {
        const { tbody, limit, highlightName } = instance;
        const rows = entries.slice(0, limit);

        if (!rows.length) {
            tbody.innerHTML = `
                <tr class="opp-empty-row">
                    <td colspan="4">No entries yet. Submit the form to add the first row.</td>
                </tr>`;
            return;
        }

        tbody.innerHTML = rows.map((entry) => {
            const isNew = highlightName && entry.name === highlightName;
            const statusKey = this.normalizeStatus(entry.status);
            const statusLabel = this.escapeHtml(this.statusLabel(statusKey));
            return `
                <tr class="${isNew ? 'opp-row--new' : ''}">
                    <td data-label="When">${this.escapeHtml(this.formatDate(entry.submitted_at))}</td>
                    <td data-label="Name">${this.escapeHtml(entry.name)}</td>
                    <td data-label="Company">${this.escapeHtml(entry.company || '')}</td>
                    <td data-label="Status"><span class="opp-status opp-status--${this.escapeHtml(statusKey)}">${statusLabel}</span></td>
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
        const data = window.OpportunityData;
        if (!instance || !data) return [];

        if (!quiet) {
            this.setStatus(instance, 'Refreshing…', false);
        }

        try {
            const entries = await data.fetchEntries(instance.limit);
            this.render(instance, entries);

            const found = instance.highlightName
                && entries.some((entry) => entry.name === instance.highlightName);

            let status = `Latest ${Math.min(entries.length, instance.limit)}`;
            if (instance.highlightName && found) {
                status += ' · your row is in';
            } else if (instance.highlightName) {
                status += ' · looking for your row…';
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

    afterSubmit(id, name) {
        const instance = this.instances.get(id);
        if (!instance) return;

        instance.highlightName = name;
        this.clearBurst(id);

        let ticks = 0;
        const maxTicks = 5;

        this.load(id, { quiet: true });

        instance.burstTimer = window.setInterval(async () => {
            ticks += 1;
            const entries = await this.load(id, { quiet: true });
            const found = entries.some((entry) => entry.name === name);

            if (found || ticks >= maxTicks) {
                this.clearBurst(id);
                if (found) {
                    this.setStatus(
                        instance,
                        `Latest ${Math.min(entries.length, instance.limit)} · your row appeared`,
                        false
                    );
                }
            }
        }, 2000);
    }
};

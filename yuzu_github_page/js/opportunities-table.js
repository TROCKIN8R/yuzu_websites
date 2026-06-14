window.OpportunityTable = {
    instances: new Map(),

    sizeBadgeClass: {
        'Startup (1-50)': 'opp-badge--startup',
        'SMB (51-200)': 'opp-badge--smb',
        'Mid-market (201-999)': 'opp-badge--mid',
        'Enterprise (1,000+)': 'opp-badge--enterprise',
        'Personal / Unknown': 'opp-badge--unknown'
    },

    init(config) {
        const data = window.OpportunityData;
        if (!data) return null;

        const instance = {
            id: config.id,
            tbody: document.getElementById(config.tbodyId),
            statusEl: config.statusId ? document.getElementById(config.statusId) : null,
            refreshBtn: config.refreshBtnId ? document.getElementById(config.refreshBtnId) : null,
            limit: config.limit || 5,
            compact: Boolean(config.compact),
            highlightName: '',
            burstTimer: null,
            idleTimer: null,
            idleMs: config.idleMs || 30000
        };

        if (!instance.tbody) return null;

        this.instances.set(config.id, instance);

        if (instance.refreshBtn) {
            instance.refreshBtn.addEventListener('click', () => this.load(config.id));
        }

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

    render(instance, entries) {
        const { tbody, limit, highlightName, compact } = instance;
        const rows = entries.slice(0, limit);
        const colSpan = compact ? 4 : 6;

        if (!rows.length) {
            tbody.innerHTML = `
                <tr class="opp-empty-row">
                    <td colspan="${colSpan}">No entries yet, submit the form to add the first row.</td>
                </tr>`;
            return;
        }

        tbody.innerHTML = rows
            .map((entry) => {
                const sizeClass = this.sizeBadgeClass[entry.company_size] || 'opp-badge--unknown';
                const isNew = highlightName && entry.name === highlightName;
                const statusCell = `<span class="opp-status opp-status--${this.escapeHtml(entry.status || 'pending')}">${this.escapeHtml(entry.status || 'pending')}</span>`;

                if (compact) {
                    return `
                    <tr class="${isNew ? 'opp-row--new' : ''}">
                        <td data-label="When">${this.escapeHtml(this.formatDate(entry.submitted_at))}</td>
                        <td data-label="Name">${this.escapeHtml(entry.name)}</td>
                        <td data-label="Company">${this.escapeHtml(entry.company || ', ')}</td>
                        <td data-label="Status">${statusCell}</td>
                    </tr>`;
                }

                return `
                    <tr class="${isNew ? 'opp-row--new' : ''}">
                        <td data-label="When">${this.escapeHtml(this.formatDate(entry.submitted_at))}</td>
                        <td data-label="Name">${this.escapeHtml(entry.name)}</td>
                        <td data-label="Company">${this.escapeHtml(entry.company || ', ')}</td>
                        <td data-label="Size"><span class="opp-badge ${sizeClass}">${this.escapeHtml(entry.company_size || 'Unknown')}</span></td>
                        <td data-label="Industry">${this.escapeHtml(entry.industry || ', ')}</td>
                        <td data-label="Status">${statusCell}</td>
                    </tr>`;
            })
            .join('');
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
                && entries.some((e) => e.name === instance.highlightName);

            let status = `Latest ${Math.min(entries.length, instance.limit)} · ${data.sourceLabel()}`;
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
            const found = entries.some((e) => e.name === name);

            if (found || ticks >= maxTicks) {
                this.clearBurst(id);
                if (found) {
                    this.setStatus(instance, `Latest ${Math.min(entries.length, instance.limit)} · your row appeared`, false);
                }
            }
        }, 2000);
    }
};

window.OpportunityData = {
    freeDomains: new Set([
        'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com'
    ]),

    isSupabaseConfigured() {
        const cfg = window.OPPORTUNITY_SUPABASE || {};
        return Boolean((cfg.url || '').trim() && (cfg.anonKey || '').trim());
    },

    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!local || !domain) return email;
        const visible = local.length === 1 ? local : `${local[0]}***`;
        return `${visible}@${domain}`;
    },

    domainFromEmail(email) {
        return email.split('@')[1]?.trim().toLowerCase() || '';
    },

    companyFromDomain(domain) {
        const label = domain.split('.')[0] || domain;
        return label.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    },

    buildRow(name, email, source) {
        const domain = this.domainFromEmail(email);
        const isFree = this.freeDomains.has(domain);
        return {
            name: name.trim(),
            email_masked: this.maskEmail(email),
            company: isFree ? 'Personal inbox' : this.companyFromDomain(domain),
            domain,
            company_size: 'Unknown',
            industry: isFree ? 'Personal email' : 'Unknown',
            status: 'pending',
            source_note: 'Submitted via website form',
            source: source || 'yuzu.solutions'
        };
    },

    async submitOpportunity(name, email, source) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase not configured');
        }

        const cfg = window.OPPORTUNITY_SUPABASE;
        const table = (cfg.table || 'opportunities').trim();
        const base = cfg.url.replace(/\/$/, '');
        const row = this.buildRow(name, email, source);

        const response = await fetch(`${base}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                apikey: cfg.anonKey,
                Authorization: `Bearer ${cfg.anonKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal'
            },
            body: JSON.stringify(row)
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(detail || `Supabase insert HTTP ${response.status}`);
        }

        return row;
    },

    async fetchEntries(limit) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase not configured');
        }
        return this.fetchFromSupabase(limit);
    },

    async fetchFromSupabase(limit) {
        const cfg = window.OPPORTUNITY_SUPABASE;
        const table = (cfg.table || 'opportunities').trim();
        const base = cfg.url.replace(/\/$/, '');
        const params = new URLSearchParams({
            select: 'id,submitted_at,name,email_masked,company,domain,company_size,industry,status,source_note,source',
            order: 'submitted_at.desc'
        });
        if (limit) {
            params.set('limit', String(limit));
        }
        const response = await fetch(`${base}/rest/v1/${table}?${params}`, {
            headers: {
                apikey: cfg.anonKey,
                Authorization: `Bearer ${cfg.anonKey}`
            },
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Supabase HTTP ${response.status}`);
        }
        return response.json();
    },

    sourceLabel() {
        return 'Supabase';
    }
};

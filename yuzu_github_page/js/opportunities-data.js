window.OpportunityData = {
    fieldLimits: {
        name: 120,
        email: 254
    },

    freeDomains: new Set([
        'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
        'live.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com'
    ]),

    isSupabaseConfigured() {
        const cfg = window.OPPORTUNITY_SUPABASE || {};
        return Boolean((cfg.url || '').trim() && (cfg.anonKey || '').trim());
    },

    isTurnstileConfigured() {
        const cfg = window.OPPORTUNITY_TURNSTILE || {};
        return Boolean((cfg.siteKey || '').trim());
    },

    maskEmail(email) {
        const [local, domain] = email.split('@');
        if (!local || !domain) return email;
        const visible = local.length === 1 ? local : `${local[0]}***`;
        return `${visible}@${domain}`;
    },

    maskNamePart(part) {
        if (!part) return part;
        if (part.length === 1) return part;
        return part.charAt(0) + '*'.repeat(part.length - 1);
    },

    maskName(name) {
        return this.formatName(name)
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.split('-').map((part) => this.maskNamePart(part)).join('-'))
            .join(' ');
    },

    domainFromEmail(email) {
        return email.split('@')[1]?.trim().toLowerCase() || '';
    },

    companyFromDomain(domain) {
        const label = domain.split('.')[0] || domain;
        return label.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    },

    titleCaseWord(word) {
        return word
            .split(/(['-])/)
            .map((part) => {
                if (part === "'" || part === '-') return part;
                if (!part) return part;
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join('');
    },

    formatName(name) {
        return String(name || '')
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((word) => this.titleCaseWord(word))
            .join(' ');
    },

    buildRow(name, email, source) {
        const domain = this.domainFromEmail(email);
        const isFree = this.freeDomains.has(domain);
        return {
            name: this.maskName(name),
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

    intakeFunctionName() {
        const cfg = window.OPPORTUNITY_SUPABASE || {};
        return (cfg.intakeFunction || '').trim();
    },

    async submitViaEdgeFunction(name, email, source, options = {}) {
        const cfg = window.OPPORTUNITY_SUPABASE;
        const fn = this.intakeFunctionName();
        if (!fn) return null;

        const base = cfg.url.replace(/\/$/, '');
        const response = await fetch(`${base}/functions/v1/${fn}`, {
            method: 'POST',
            headers: {
                apikey: cfg.anonKey,
                Authorization: `Bearer ${cfg.anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                source,
                consent: Boolean(options.consent),
                captchaToken: options.captchaToken || ''
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || `Edge function HTTP ${response.status}`);
        }

        return {
            row: payload.row || this.buildRow(name, email, source),
            emailSent: Boolean(payload.emailSent),
            emailError: payload.emailError || null
        };
    },

    async submitOpportunity(name, email, source, options = {}) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase not configured');
        }

        const fn = this.intakeFunctionName();
        if (!fn) {
            throw new Error('Intake function not configured');
        }

        const formattedName = this.formatName(name);
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const consent = Boolean(options.consent);
        const captchaToken = String(options.captchaToken || '').trim();

        if (formattedName.length > this.fieldLimits.name) {
            throw new Error(`Name must be ${this.fieldLimits.name} characters or fewer`);
        }

        if (normalizedEmail.length > this.fieldLimits.email) {
            throw new Error(`Email must be ${this.fieldLimits.email} characters or fewer`);
        }

        if (!consent) {
            throw new Error('Consent is required');
        }

        if (this.isTurnstileConfigured() && !captchaToken) {
            throw new Error('Captcha verification is required');
        }

        return this.submitViaEdgeFunction(
            formattedName,
            normalizedEmail,
            source,
            { consent, captchaToken }
        );
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

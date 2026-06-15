window.ContractRouterData = {
    config() {
        return window.CONTRACT_ROUTER_CONFIG || {};
    },

    fieldLimits() {
        return this.config().fieldLimits || { name: 120, email: 254 };
    },

    isConfigured() {
        const { url, anonKey, intakeFunction } = this.config().supabase || {};
        return Boolean((url || '').trim() && (anonKey || '').trim() && (intakeFunction || '').trim());
    },

    isTurnstileConfigured() {
        return Boolean((this.config().turnstile?.siteKey || '').trim());
    },

    formatName(name) {
        const titleCaseWord = (word) => word
            .split(/(['-])/)
            .map((part) => {
                if (part === "'" || part === '-') return part;
                if (!part) return part;
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join('');

        return String(name || '')
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(titleCaseWord)
            .join(' ');
    },

    async submit(name, email, source, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('Contract router not configured');
        }

        const limits = this.fieldLimits();
        const formattedName = this.formatName(name);
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const consent = Boolean(options.consent);
        const captchaToken = String(options.captchaToken || '').trim();
        const { url, anonKey, intakeFunction } = this.config().supabase;

        if (formattedName.length > limits.name) {
            throw new Error(`Name must be ${limits.name} characters or fewer`);
        }

        if (normalizedEmail.length > limits.email) {
            throw new Error(`Email must be ${limits.email} characters or fewer`);
        }

        if (!consent) {
            throw new Error('Consent is required');
        }

        if (this.isTurnstileConfigured() && !captchaToken) {
            throw new Error('Captcha verification is required');
        }

        const base = url.replace(/\/$/, '');
        const response = await fetch(`${base}/functions/v1/${intakeFunction}`, {
            method: 'POST',
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: formattedName,
                email: normalizedEmail,
                source,
                consent,
                captchaToken
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || `Submission failed (${response.status})`);
        }

        return {
            row: payload.row,
            emailSent: Boolean(payload.emailSent)
        };
    },

    async fetchEntries(limit) {
        if (!this.isConfigured()) {
            throw new Error('Contract router not configured');
        }

        const { url, anonKey, table } = this.config().supabase;
        const base = url.replace(/\/$/, '');
        const params = new URLSearchParams({
            select: 'submitted_at,name,company,destination,status',
            order: 'submitted_at.desc'
        });

        if (limit) {
            params.set('limit', String(limit));
        }

        const response = await fetch(`${base}/rest/v1/${table}?${params}`, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Could not load submissions (${response.status})`);
        }

        return response.json();
    }
};

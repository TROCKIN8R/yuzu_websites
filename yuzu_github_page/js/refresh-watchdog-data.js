window.RefreshWatchdogData = {
  config() {
    return window.REFRESH_WATCHDOG_CONFIG || {};
  },

  isConfigured() {
    const { url, anonKey, functionName } = this.config().supabase || {};
    return Boolean((url || '').trim() && (anonKey || '').trim() && (functionName || '').trim());
  },

  isTurnstileConfigured() {
    return Boolean((this.config().turnstile?.siteKey || '').trim());
  },

  pipelineLabel(id) {
    const match = (this.config().pipelines || []).find((item) => item.id === id);
    return match?.label || id;
  },

  async submit(pipeline, scenario, slaMinutes, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Refresh Watchdog not configured');
    }

    const captchaToken = String(options.captchaToken || '').trim();
    if (this.isTurnstileConfigured() && !captchaToken) {
      throw new Error('Captcha verification is required');
    }

    const { url, anonKey, functionName } = this.config().supabase;
    const base = url.replace(/\/$/, '');

    const response = await fetch(`${base}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pipeline,
        scenario,
        slaMinutes,
        captchaToken,
        source: options.source || 'yuzu.solutions/home-automation-demo'
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Submission failed (${response.status})`);
    }

    return {
      row: payload.row,
      alertSent: Boolean(payload.alertSent)
    };
  },

  async fetchRuns(limit) {
    if (!this.isConfigured()) {
      throw new Error('Refresh Watchdog not configured');
    }

    const { url, anonKey, table } = this.config().supabase;
    const base = url.replace(/\/$/, '');
    const params = new URLSearchParams({
      select: 'id,started_at,completed_at,pipeline,duration_seconds,sla_minutes,status,scenario',
      order: 'started_at.desc'
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
      throw new Error(`Could not load refresh runs (${response.status})`);
    }

    return response.json();
  }
};

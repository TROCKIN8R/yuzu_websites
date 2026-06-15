(function initRefreshWatchdogDemo() {
    const root = document.getElementById('automationLab');
    const data = window.RefreshWatchdogData;
    const table = window.RefreshWatchdogTable;
    if (!root || !data || !table) return;

    const tableId = 'home-refresh-preview';
    const form = document.getElementById('homeRefreshForm');
    const formStatus = document.getElementById('homeRefreshFormStatus');
    const submitBtn = document.getElementById('home-refresh-submit');
    const breachBtn = document.getElementById('home-refresh-breach');
    const turnstileMount = document.getElementById('home-refresh-turnstile');
    const refreshPanel = document.getElementById('automation-panel-refresh');
    const pipelineSelect = document.getElementById('home-refresh-pipeline');
    const slaInput = document.getElementById('home-refresh-sla');
    const progressWrap = document.getElementById('homeRefreshProgress');
    const progressFill = document.getElementById('homeRefreshProgressFill');
    const progressTimer = document.getElementById('homeRefreshProgressTimer');
    const progressLabel = document.getElementById('homeRefreshProgressLabel');
    const captchaRequired = data.isTurnstileConfigured();
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let running = false;

    table.init({
        id: tableId,
        tbodyId: 'homeRefreshTableBody',
        statusId: 'homeRefreshTableStatus',
        limit: 5,
        idleMs: 30000
    });

    function setFormMessage(message, type) {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = `opp-form-status opp-form-status--${type}`;
        formStatus.hidden = !message;
    }

    function updateSubmitState(captchaReady) {
        if (typeof captchaReady === 'boolean') {
            captchaPassed = captchaReady;
        }
        const enabled = !running && (!captchaRequired || captchaPassed);

        [submitBtn, breachBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !enabled;
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
            btn.classList.toggle('opp-submit--locked', captchaRequired && !captchaPassed && !running);
        });

        const title = !running && captchaRequired && !captchaPassed
            ? 'Complete the security check first'
            : '';
        if (submitBtn) submitBtn.title = title;
        if (breachBtn) breachBtn.title = title;
    }

    function isRefreshPanelVisible() {
        return Boolean(refreshPanel && !refreshPanel.hidden);
    }

    function destroyTurnstile() {
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.remove(turnstileWidgetId);
        }
        turnstileWidgetId = null;
        if (turnstileMount) turnstileMount.innerHTML = '';
        captchaPassed = false;
        updateSubmitState(false);
    }

    function loadTurnstileScript() {
        return new Promise((resolve, reject) => {
            if (window.turnstile) {
                resolve();
                return;
            }

            const existing = document.getElementById('cf-turnstile-script');
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error('Captcha script failed to load')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = 'cf-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Captcha script failed to load'));
            document.head.appendChild(script);
        });
    }

    function renderTurnstile() {
        const siteKey = (data.config().turnstile?.siteKey || '').trim();
        if (!siteKey || !turnstileMount || !isRefreshPanelVisible()) return;

        destroyTurnstile();

        loadTurnstileScript()
            .then(() => {
                if (!window.turnstile || !isRefreshPanelVisible()) return;
                turnstileWidgetId = window.turnstile.render(turnstileMount, {
                    sitekey: siteKey,
                    theme: 'light',
                    callback: () => updateSubmitState(true),
                    'expired-callback': () => {
                        updateSubmitState(false);
                        setFormMessage('Security check expired. Please verify again.', 'warn');
                    },
                    'error-callback': () => {
                        updateSubmitState(false);
                        setFormMessage('Security check failed. Refresh and try again.', 'error');
                    }
                });
            })
            .catch(() => {
                updateSubmitState(false);
                setFormMessage('Captcha could not load. Refresh and try again.', 'error');
            });
    }

    function getCaptchaToken() {
        if (!captchaRequired || !window.turnstile || turnstileWidgetId === null) return '';
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }

    function resetCaptcha() {
        if (!window.turnstile || turnstileWidgetId === null) {
            updateSubmitState(false);
            return;
        }
        window.turnstile.reset(turnstileWidgetId);
        updateSubmitState(false);
    }

    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${String(secs).padStart(2, '0')}s`;
    }

    function syncSlaDefault() {
        if (!pipelineSelect || !slaInput) return;
        const selected = (data.config().pipelines || []).find((item) => item.id === pipelineSelect.value);
        if (selected?.slaDefault) {
            slaInput.value = String(selected.slaDefault);
        }
    }

    function animateProgress(scenario, targetSeconds) {
        const animationMs = scenario === 'breach' ? 6000 : 4000;
        const start = performance.now();

        if (progressWrap) progressWrap.hidden = false;
        if (progressLabel) {
            progressLabel.textContent = scenario === 'breach'
                ? 'Simulating slow refresh…'
                : 'Running pipeline refresh…';
        }

        return new Promise((resolve) => {
            function frame(now) {
                const elapsed = now - start;
                const ratio = Math.min(elapsed / animationMs, 1);
                const currentSeconds = Math.round(targetSeconds * ratio);

                if (progressFill) {
                    progressFill.style.width = `${Math.round(ratio * 100)}%`;
                }
                if (progressTimer) {
                    progressTimer.textContent = formatDuration(currentSeconds);
                }

                if (ratio < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }

            requestAnimationFrame(frame);
        });
    }

    function hideProgress() {
        if (progressWrap) progressWrap.hidden = true;
        if (progressFill) progressFill.style.width = '0%';
        if (progressTimer) progressTimer.textContent = '0m 00s';
    }

    async function handleRun(scenario) {
        if (!form || running) return;

        if (captchaRequired && !captchaPassed) {
            setFormMessage('Please complete the security check.', 'error');
            return;
        }

        const pipeline = String(pipelineSelect?.value || '').trim();
        const slaMinutes = Math.min(60, Math.max(1, Number(slaInput?.value) || data.config().defaultSlaMinutes || 8));
        const captchaToken = getCaptchaToken();

        if (!pipeline) {
            setFormMessage('Please choose a pipeline.', 'error');
            return;
        }

        if (captchaRequired && !captchaToken) {
            updateSubmitState(false);
            setFormMessage('Please complete the security check.', 'error');
            return;
        }

        running = true;
        updateSubmitState(false);
        setFormMessage('', 'info');
        hideProgress();

        const targetSeconds = scenario === 'breach' ? 720 : 240;
        const animation = animateProgress(scenario, targetSeconds);

        try {
            const [result] = await Promise.all([
                data.submit(pipeline, scenario, slaMinutes, { captchaToken }),
                animation
            ]);

            const duration = table.formatDuration(result.row.duration_seconds);
            const isAlert = result.row.status === 'alert';

            setFormMessage(
                isAlert
                    ? `SLA breach simulated (${duration}). Alert sent to inbox (Slack stand-in).`
                    : `Refresh completed in ${duration}. Within the ${slaMinutes} min SLA.`,
                isAlert ? 'warn' : 'success'
            );

            table.afterSubmit(tableId, result.row.id);
            resetCaptcha();
        } catch (error) {
            hideProgress();
            resetCaptcha();
            const detail = String(error?.message || error);

            if (detail.toLowerCase().includes('forbidden')) {
                setFormMessage('Demo not allowed from this site.', 'error');
            } else if (detail.toLowerCase().includes('rate limit') || detail.toLowerCase().includes('too many')) {
                setFormMessage(detail, 'error');
            } else if (detail.toLowerCase().includes('not configured')) {
                setFormMessage('Captcha passed, but the server secret is missing. Redeploy refresh-watchdog.', 'error');
            } else if (detail.toLowerCase().includes('captcha')) {
                setFormMessage(detail, 'error');
            } else {
                setFormMessage('Something went wrong. Try again or email adrienyvin@gmail.com.', 'error');
            }
        } finally {
            running = false;
            hideProgress();
            updateSubmitState(captchaPassed && Boolean(getCaptchaToken()));
        }
    }

    submitBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        handleRun('healthy');
    });

    breachBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        handleRun('breach');
    });

    pipelineSelect?.addEventListener('change', syncSlaDefault);

    document.addEventListener('automation-panel-open', (event) => {
        if (event.detail?.tabId === 'refresh' && captchaRequired) {
            window.requestAnimationFrame(() => renderTurnstile());
        }
    });

    document.addEventListener('automation-panel-close', () => {
        if (captchaRequired) destroyTurnstile();
    });

    syncSlaDefault();

    if (captchaRequired) {
        updateSubmitState(false);
        if (isRefreshPanelVisible()) {
            renderTurnstile();
        }
    } else {
        updateSubmitState(true);
    }
})();

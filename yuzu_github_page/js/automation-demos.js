(function initAutomationDemos() {
    const root = document.getElementById('automationLab');
    const data = window.OpportunityData;
    const table = window.OpportunityTable;
    if (!root || !data || !table) return;

    const tableId = 'home-opportunities-preview';
    const tabs = root.querySelectorAll('[data-automation-tab]');
    const panels = root.querySelectorAll('[data-automation-panel]');
    const form = document.getElementById('homeOpportunityForm');
    const formStatus = document.getElementById('homeOpportunityFormStatus');
    const submitBtn = document.getElementById('home-opp-submit');
    const turnstileMount = document.getElementById('home-opp-turnstile');
    const captchaRequired = data.isTurnstileConfigured();
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;

    table.init({
        id: tableId,
        tbodyId: 'homeOpportunityTableBody',
        statusId: 'homeOpportunityTableStatus',
        limit: 5,
        compact: true,
        idleMs: 30000
    });

    function activateTab(tabId) {
        tabs.forEach((tab) => {
            const isActive = tab.dataset.automationTab === tabId;
            tab.classList.toggle('automation-lab-tab--active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        panels.forEach((panel) => {
            const isActive = panel.dataset.automationPanel === tabId;
            panel.hidden = !isActive;
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            if (tab.disabled || tab.getAttribute('aria-disabled') === 'true') return;
            activateTab(tab.dataset.automationTab);
        });
    });

    function setFormMessage(message, type) {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = `opp-form-status opp-form-status--${type}`;
        formStatus.hidden = !message;
    }

    function setSubmitReady(ready) {
        captchaPassed = Boolean(ready);
        if (!submitBtn) return;

        const enabled = !submitting && (!captchaRequired || captchaPassed);
        submitBtn.disabled = !enabled;
        submitBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        submitBtn.classList.toggle('opp-submit--locked', captchaRequired && !captchaPassed && !submitting);

        if (captchaRequired && !captchaPassed && !submitting) {
            submitBtn.title = 'Complete the security check first';
        } else {
            submitBtn.removeAttribute('title');
        }
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
        const siteKey = (window.OPPORTUNITY_TURNSTILE?.siteKey || '').trim();
        if (!siteKey || !turnstileMount) return;

        setSubmitReady(false);

        loadTurnstileScript()
            .then(() => {
                if (!window.turnstile) return;
                if (turnstileWidgetId !== null) {
                    window.turnstile.remove(turnstileWidgetId);
                    turnstileWidgetId = null;
                }
                turnstileWidgetId = window.turnstile.render(turnstileMount, {
                    sitekey: siteKey,
                    theme: 'light',
                    callback: () => setSubmitReady(true),
                    'expired-callback': () => {
                        setSubmitReady(false);
                        setFormMessage('Security check expired. Please verify again.', 'warn');
                    },
                    'error-callback': () => {
                        setSubmitReady(false);
                        setFormMessage('Security check failed. Refresh and try again.', 'error');
                    }
                });
            })
            .catch(() => {
                setSubmitReady(false);
                setFormMessage('Captcha could not load. Refresh and try again.', 'error');
            });
    }

    function getCaptchaToken() {
        if (!captchaRequired) return '';
        if (!window.turnstile || turnstileWidgetId === null) return '';
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }

    function resetCaptcha() {
        if (!window.turnstile || turnstileWidgetId === null) {
            setSubmitReady(false);
            return;
        }
        window.turnstile.reset(turnstileWidgetId);
        setSubmitReady(false);
    }

    async function submitOpportunity(event) {
        event.preventDefault();
        if (!form || !submitBtn) return;

        if (captchaRequired && !captchaPassed) {
            setFormMessage('Please complete the security check.', 'error');
            return;
        }

        const formData = new FormData(form);
        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const consent = formData.get('consent') === 'yes';
        const captchaToken = getCaptchaToken();
        const source = 'yuzu.solutions/home-automation-demo';

        if (!name || !email) {
            setFormMessage('Please enter your name and work email.', 'error');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormMessage('Please enter a valid email address.', 'error');
            return;
        }

        if (!consent) {
            setFormMessage('Please agree to receive the one-time follow-up email.', 'error');
            return;
        }

        if (captchaRequired && !captchaToken) {
            setSubmitReady(false);
            setFormMessage('Please complete the security check.', 'error');
            return;
        }

        submitting = true;
        setSubmitReady(false);
        setFormMessage('Sending…', 'info');

        try {
            if (!data.isSupabaseConfigured()) {
                setFormMessage('Supabase not configured yet.', 'warn');
                form.reset();
                resetCaptcha();
                return;
            }

            const result = await data.submitOpportunity(name, email, source, {
                consent,
                captchaToken
            });
            if (result.emailSent) {
                setFormMessage('Submitted. Check your inbox for a follow-up with a Calendly link.', 'success');
            } else if (data.intakeFunctionName()) {
                setFormMessage('Submitted. Your row should appear below (confirmation email pending setup).', 'success');
            } else {
                setFormMessage('Submitted, your row should appear in the table below.', 'success');
            }
            form.reset();
            resetCaptcha();
            table.afterSubmit(tableId, result.row.name);
        } catch (error) {
            const detail = String(error?.message || error);
            resetCaptcha();
            if (detail.includes('row-level security') || detail.includes('42501')) {
                setFormMessage('Submission blocked. Try again in a moment.', 'error');
            } else if (detail.toLowerCase().includes('forbidden')) {
                setFormMessage('Submission not allowed from this site.', 'error');
            } else if (detail.toLowerCase().includes('rate limit') || detail.toLowerCase().includes('too many')) {
                setFormMessage(detail, 'error');
            } else if (detail.toLowerCase().includes('captcha') || detail.toLowerCase().includes('consent')) {
                setFormMessage(detail, 'error');
            } else {
                setFormMessage('Something went wrong. Try again or email adrienyvin@gmail.com.', 'error');
            }
        } finally {
            submitting = false;
            setSubmitReady(captchaPassed && Boolean(getCaptchaToken()));
        }
    }

    form?.addEventListener('submit', submitOpportunity);

    if (captchaRequired) {
        setSubmitReady(false);
        renderTurnstile();
    } else if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.setAttribute('aria-disabled', 'false');
    }
})();

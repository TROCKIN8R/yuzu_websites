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
    const turnstileMount = document.getElementById('home-opp-turnstile');
    let turnstileWidgetId = null;

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

        loadTurnstileScript()
            .then(() => {
                if (!window.turnstile) return;
                if (turnstileWidgetId !== null) {
                    window.turnstile.remove(turnstileWidgetId);
                    turnstileWidgetId = null;
                }
                turnstileWidgetId = window.turnstile.render(turnstileMount, {
                    sitekey: siteKey,
                    theme: 'light'
                });
            })
            .catch(() => {
                setFormMessage('Captcha could not load. Refresh and try again.', 'error');
            });
    }

    function getCaptchaToken() {
        if (!data.isTurnstileConfigured()) return '';
        if (!window.turnstile || turnstileWidgetId === null) return '';
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }

    function resetCaptcha() {
        if (!window.turnstile || turnstileWidgetId === null) return;
        window.turnstile.reset(turnstileWidgetId);
    }

    async function submitOpportunity(event) {
        event.preventDefault();
        if (!form) return;

        const submitBtn = form.querySelector('[type="submit"]');
        const formData = new FormData(form);
        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const consent = formData.get('consent') === 'yes';
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

        if (data.isTurnstileConfigured() && !getCaptchaToken()) {
            setFormMessage('Please complete the security check.', 'error');
            return;
        }

        submitBtn.disabled = true;
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
                captchaToken: getCaptchaToken()
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
                setFormMessage('Insert blocked, run supabase_anon_insert_policy.sql in SQL Editor.', 'error');
            } else if (detail.toLowerCase().includes('captcha') || detail.toLowerCase().includes('consent')) {
                setFormMessage(detail, 'error');
            } else {
                setFormMessage('Something went wrong. Try again or email adrienyvin@gmail.com.', 'error');
            }
        } finally {
            submitBtn.disabled = false;
        }
    }

    form?.addEventListener('submit', submitOpportunity);
    renderTurnstile();
})();

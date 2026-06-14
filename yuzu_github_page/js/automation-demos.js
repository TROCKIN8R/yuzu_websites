(function initOpportunityDemo() {
    const root = document.getElementById('automationLab');
    const data = window.OpportunityData;
    const table = window.OpportunityTable;
    if (!root || !data || !table) return;

    const tableId = 'home-opportunities-preview';
    const form = document.getElementById('homeOpportunityForm');
    const formStatus = document.getElementById('homeOpportunityFormStatus');
    const submitBtn = document.getElementById('home-opp-submit');
    const turnstileMount = document.getElementById('home-opp-turnstile');
    const nameInput = document.getElementById('home-opp-name');
    const emailInput = document.getElementById('home-opp-email');
    const limits = data.fieldLimits();
    const captchaRequired = data.isTurnstileConfigured();
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;

    if (nameInput) nameInput.maxLength = limits.name;
    if (emailInput) emailInput.maxLength = limits.email;

    table.init({
        id: tableId,
        tbodyId: 'homeOpportunityTableBody',
        statusId: 'homeOpportunityTableStatus',
        limit: 5,
        idleMs: 30000
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
        submitBtn.title = captchaRequired && !captchaPassed && !submitting
            ? 'Complete the security check first'
            : '';
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
        if (!captchaRequired || !window.turnstile || turnstileWidgetId === null) return '';
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

    async function handleSubmit(event) {
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

        if (name.length > limits.name) {
            setFormMessage(`Name must be ${limits.name} characters or fewer.`, 'error');
            return;
        }

        if (email.length > limits.email) {
            setFormMessage(`Email must be ${limits.email} characters or fewer.`, 'error');
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
            const result = await data.submit(name, email, source, { consent, captchaToken });
            setFormMessage(
                result.emailSent
                    ? 'Submitted. Check your inbox for a follow-up with a Calendly link.'
                    : 'Submitted. Your row should appear below shortly.',
                'success'
            );
            form.reset();
            resetCaptcha();
            table.afterSubmit(tableId, result.row.name);
        } catch (error) {
            const detail = String(error?.message || error);
            resetCaptcha();

            if (detail.toLowerCase().includes('forbidden')) {
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

    form.addEventListener('submit', handleSubmit);

    if (captchaRequired) {
        setSubmitReady(false);
        renderTurnstile();
    } else if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.setAttribute('aria-disabled', 'false');
    }
})();

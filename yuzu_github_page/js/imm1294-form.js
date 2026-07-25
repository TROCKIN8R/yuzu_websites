(function initImm1294Form() {
    const form = document.getElementById('imm1294Form');
    const statusEl = document.getElementById('imm1294FormStatus');
    const submitBtn = document.getElementById('imm1294Submit');
    const downloadBtn = document.getElementById('imm1294Download');
    const turnstileMount = document.getElementById('imm1294Turnstile');
    const consentInput = document.getElementById('imm1294Consent');
    const config = window.IMM1294_CONFIG || {};
    const captchaRequired = Boolean((config.turnstile?.siteKey || '').trim());
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;

    if (!form || !submitBtn) return;

    const actionButtons = [submitBtn, downloadBtn].filter(Boolean);

    function setMessage(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `opp-form-status opp-form-status--${type}`;
        statusEl.hidden = !message;
    }

    function updateSubmitState(captchaReady) {
        if (typeof captchaReady === 'boolean') captchaPassed = captchaReady;
        const captchaOk = !captchaRequired || captchaPassed;
        const consentOk = Boolean(consentInput?.checked);
        const enabled = !submitting && captchaOk && consentOk;
        for (const btn of actionButtons) {
            btn.disabled = !enabled;
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
            btn.classList.toggle('opp-submit--locked', !enabled && !submitting);
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
                existing.addEventListener('error', () => reject(new Error('Captcha script failed')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.id = 'cf-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Captcha script failed'));
            document.head.appendChild(script);
        });
    }

    function renderTurnstile() {
        const siteKey = (config.turnstile?.siteKey || '').trim();
        if (!siteKey || !turnstileMount) return;
        loadTurnstileScript()
            .then(() => {
                if (!window.turnstile) return;
                turnstileWidgetId = window.turnstile.render(turnstileMount, {
                    sitekey: siteKey,
                    theme: 'light',
                    callback: () => updateSubmitState(true),
                    'expired-callback': () => {
                        updateSubmitState(false);
                        setMessage('Security check expired. Please verify again.', 'warn');
                    },
                    'error-callback': () => {
                        updateSubmitState(false);
                        setMessage('Security check failed. Refresh and try again.', 'error');
                    }
                });
            })
            .catch(() => setMessage('Captcha could not load. Refresh and try again.', 'error'));
    }

    function getCaptchaToken() {
        if (!captchaRequired || !window.turnstile || turnstileWidgetId === null) return '';
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }

    function resetCaptcha() {
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
        }
        updateSubmitState(false);
    }

    function splitDate(value) {
        const [y = '', m = '', d = ''] = String(value || '').split('-');
        return { year: y, month: m, day: d };
    }

    function collectPayload(delivery) {
        const data = new FormData(form);
        const dob = splitDate(data.get('dob'));
        const passportExpiry = splitDate(data.get('passportExpiry'));
        const studyFrom = splitDate(data.get('studyFrom'));
        const studyTo = splitDate(data.get('studyTo'));

        return {
            delivery,
            email: String(data.get('email') || '').trim().toLowerCase(),
            familyName: String(data.get('familyName') || '').trim(),
            givenName: String(data.get('givenName') || '').trim(),
            sex: String(data.get('sex') || '').trim(),
            dobYear: dob.year,
            dobMonth: dob.month,
            dobDay: dob.day,
            placeBirthCity: String(data.get('placeBirthCity') || '').trim(),
            placeBirthCountry: String(data.get('placeBirthCountry') || '').trim(),
            citizenship: String(data.get('citizenship') || '').trim(),
            maritalStatus: String(data.get('maritalStatus') || '').trim(),
            currentCountry: String(data.get('currentCountry') || '').trim(),
            currentStatus: String(data.get('currentStatus') || '').trim(),
            passportNumber: String(data.get('passportNumber') || '').trim(),
            passportCountry: String(data.get('passportCountry') || '').trim(),
            passportExpiryYear: passportExpiry.year,
            passportExpiryMonth: passportExpiry.month,
            passportExpiryDay: passportExpiry.day,
            nativeLang: String(data.get('nativeLang') || '').trim(),
            ableToCommunicate: String(data.get('ableToCommunicate') || '').trim(),
            streetNum: String(data.get('streetNum') || '').trim(),
            streetName: String(data.get('streetName') || '').trim(),
            city: String(data.get('city') || '').trim(),
            country: String(data.get('country') || '').trim(),
            provinceState: String(data.get('provinceState') || '').trim(),
            postalCode: String(data.get('postalCode') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
            schoolName: String(data.get('schoolName') || '').trim(),
            program: String(data.get('program') || '').trim(),
            schoolProvince: String(data.get('schoolProvince') || '').trim(),
            schoolCity: String(data.get('schoolCity') || '').trim(),
            schoolAddress: String(data.get('schoolAddress') || '').trim(),
            dli: String(data.get('dli') || '').trim(),
            studyFromYear: studyFrom.year,
            studyFromMonth: studyFrom.month,
            studyFromDay: studyFrom.day,
            studyToYear: studyTo.year,
            studyToMonth: studyTo.month,
            studyToDay: studyTo.day,
            tuitionAmount: String(data.get('tuitionAmount') || '').trim(),
            availableFunds: String(data.get('availableFunds') || data.get('tuitionAmount') || '').trim(),
            funds: String(data.get('funds') || '').trim(),
            serviceIn: String(data.get('serviceIn') || 'English').trim(),
            consent: data.get('consent') === 'yes',
            captchaToken: getCaptchaToken()
        };
    }

    function clientValidate(payload, delivery) {
        if (!form.checkValidity()) {
            form.reportValidity();
            return 'Please correct the highlighted fields.';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
            return 'Enter a valid email address.';
        }
        if (!payload.consent) {
            return delivery === 'download'
                ? 'Confirm the demo consent to download the PDF.'
                : 'Confirm the demo consent to email the PDF.';
        }
        if (captchaRequired && !payload.captchaToken) return 'Complete the security check.';
        return '';
    }

    function filenameFromDisposition(header, fallback) {
        if (!header) return fallback;
        const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
        if (utf?.[1]) {
            try {
                return decodeURIComponent(utf[1].trim());
            } catch {
                /* keep fallback */
            }
        }
        const plain = /filename="?([^";]+)"?/i.exec(header);
        return plain?.[1]?.trim() || fallback;
    }

    function triggerBrowserDownload(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    }

    async function handleFill(delivery) {
        const payload = collectPayload(delivery);
        const clientError = clientValidate(payload, delivery);
        if (clientError) {
            setMessage(clientError, 'error');
            return;
        }

        const { url, anonKey, fillFunction } = config.supabase || {};
        if (!url || !anonKey || !fillFunction) {
            setMessage('Demo is not configured.', 'error');
            return;
        }

        submitting = true;
        updateSubmitState();
        setMessage(
            delivery === 'download'
                ? 'Validating answers and preparing your download…'
                : 'Validating answers and filling IMM 1294…',
            'info'
        );

        try {
            const base = url.replace(/\/$/, '');
            const response = await fetch(`${base}/functions/v1/${fillFunction}`, {
                method: 'POST',
                headers: {
                    apikey: anonKey,
                    Authorization: `Bearer ${anonKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const contentType = (response.headers.get('content-type') || '').toLowerCase();

            if (delivery === 'download') {
                if (!response.ok) {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.error || `Request failed (${response.status})`);
                }
                if (!contentType.includes('application/pdf')) {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.error || 'Server did not return a PDF.');
                }
                const blob = await response.blob();
                const fallbackName = `IMM1294_${payload.familyName}_${payload.givenName}.pdf`
                    .replace(/[^\w.\-]+/g, '_');
                const filename = filenameFromDisposition(
                    response.headers.get('content-disposition'),
                    fallbackName
                );
                triggerBrowserDownload(blob, filename);
                setMessage(
                    'Download started. Open the PDF in Adobe Acrobat/Reader to review and Validate.',
                    'success'
                );
                resetCaptcha();
                return;
            }

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.error || `Request failed (${response.status})`);
            }

            setMessage(
                `Done. The filled IMM 1294 PDF was sent to ${payload.email}. Check your inbox (and spam).`,
                'success'
            );
            form.reset();
            resetCaptcha();
        } catch (error) {
            const detail = String(error?.message || error);
            resetCaptcha();
            if (detail.toLowerCase().includes('forbidden')) {
                setMessage('Submission not allowed from this site.', 'error');
            } else if (detail.toLowerCase().includes('rate') || detail.toLowerCase().includes('recently')) {
                setMessage(detail, 'error');
            } else if (detail.toLowerCase().includes('captcha') || detail.toLowerCase().includes('not configured')) {
                setMessage(detail, 'error');
            } else {
                setMessage(detail || 'Something went wrong. Try again.', 'error');
            }
        } finally {
            submitting = false;
            updateSubmitState(Boolean(getCaptchaToken()));
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleFill('email');
    });
    downloadBtn?.addEventListener('click', () => handleFill('download'));
    consentInput?.addEventListener('change', () => updateSubmitState());

    if (captchaRequired) {
        updateSubmitState(false);
        renderTurnstile();
    } else {
        updateSubmitState(true);
    }
})();

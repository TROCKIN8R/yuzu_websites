(function initStudyPermitKit() {
    const form = document.getElementById('spkForm');
    const statusEl = document.getElementById('spkFormStatus');
    const submitBtn = document.getElementById('spkSubmit');
    const downloadBtn = document.getElementById('spkDownload');
    const nextBtn = document.getElementById('spkNext');
    const backBtn = document.getElementById('spkBack');
    const consentInput = document.getElementById('spkConsent');
    const turnstileMount = document.getElementById('spkTurnstile');
    const formList = document.getElementById('spkFormList');
    const formListFinal = document.getElementById('spkFormListFinal');
    const reviewEl = document.getElementById('spkReview');
    const stepsNav = document.getElementById('spkSteps');
    const config = window.STUDY_PERMIT_KIT_CONFIG || {};
    const formMeta = config.forms || {};
    const captchaRequired = Boolean((config.turnstile?.siteKey || '').trim());

    let step = 0;
    const STEP_COUNT = 7;
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;

    if (!form || !nextBtn) return;

    const actionButtons = [submitBtn, downloadBtn].filter(Boolean);

    function g(data, name) {
        return String(data.get(name) || '').trim();
    }

    function yn(value) {
        const v = String(value || 'N').toUpperCase();
        return v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1';
    }

    function splitDate(raw) {
        const s = String(raw || '');
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (!m) return { year: '', month: '', day: '' };
        return { year: m[1], month: m[2], day: m[3] };
    }

    function selectFormsLocal() {
        const data = new FormData(form);
        const forms = ['imm1294', 'imm5646', 'imm5483'];
        if (yn(g(data, 'hasRepresentative'))) forms.push('imm5476');
        if (yn(g(data, 'hasDesignee'))) forms.push('imm5475');
        if (yn(g(data, 'isCommonLaw'))) forms.push('imm5409');
        if (yn(g(data, 'includeImm5707'))) forms.push('imm5707');
        return forms;
    }

    function renderFormList(target, forms) {
        if (!target) return;
        target.innerHTML = '';
        for (const code of forms) {
            const meta = formMeta[code] || { title: code.toUpperCase(), required: false };
            const item = document.createElement('div');
            item.className = 'spk-form-item is-on';
            item.innerHTML =
                `<span class="spk-code">${code.toUpperCase()}</span>` +
                `<div><strong>${meta.title || code}</strong>` +
                `<p>${meta.required ? 'Always included' : 'Included from your answers'}</p></div>`;
            target.appendChild(item);
        }
    }

    function syncExtras() {
        const forms = new Set(selectFormsLocal());
        let any = false;
        form.querySelectorAll('[data-spk-extra]').forEach((el) => {
            const code = el.getAttribute('data-spk-extra');
            const show = forms.has(code);
            el.hidden = !show;
            if (show) any = true;
            el.querySelectorAll('input, select').forEach((input) => {
                if (show && (code === 'imm5476' && input.name === 'repFamilyName'
                    || code === 'imm5475' && input.name === 'designeeFamilyName'
                    || code === 'imm5409' && input.name === 'partnerFamilyName')) {
                    input.required = true;
                } else if (input.name.startsWith('rep') || input.name.startsWith('designee') || input.name.startsWith('partner') || input.name.startsWith('commonLaw') || input.name === 'yearsTogether') {
                    input.required = false;
                }
            });
        });
        const empty = document.getElementById('spkExtrasEmpty');
        if (empty) empty.hidden = any;
    }

    function fillSelectOptions(select, rows, { selected = '', placeholder = 'Select…' } = {}) {
        if (!(select instanceof HTMLSelectElement)) return;
        const keep = selected || select.dataset.immDefault || select.value || '';
        select.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = placeholder;
        ph.disabled = true;
        select.appendChild(ph);
        for (const row of rows) {
            const opt = document.createElement('option');
            opt.value = row.value;
            opt.textContent = row.label;
            select.appendChild(opt);
        }
        if (keep && [...select.options].some((o) => o.value === keep)) {
            select.value = keep;
        }
    }

    function populateLov() {
        const data = window.IMM1294_LOV || {};
        const countries = Array.isArray(data.countries) ? data.countries : [];
        const languages = Array.isArray(data.languages) ? data.languages : [];
        form.querySelectorAll('select[data-imm-lov="country"]').forEach((select) => {
            fillSelectOptions(select, countries, {
                placeholder: 'Select country…',
                selected: select.dataset.immDefault || select.value,
            });
        });
        form.querySelectorAll('select[data-imm-lov="language"]').forEach((select) => {
            fillSelectOptions(select, languages, {
                placeholder: 'Select language…',
                selected: select.dataset.immDefault || select.value,
            });
        });
    }

    function showStatus(message, isError) {
        if (!statusEl) return;
        statusEl.hidden = !message;
        statusEl.textContent = message || '';
        statusEl.classList.toggle('opp-form-status--error', Boolean(isError));
    }

    function updateActionButtons() {
        const consentOk = Boolean(consentInput?.checked);
        const captchaOk = !captchaRequired || captchaPassed;
        const enabled = !submitting && consentOk && captchaOk && step === STEP_COUNT - 1;
        for (const btn of actionButtons) {
            btn.disabled = !enabled;
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
            btn.classList.toggle('opp-submit--locked', !enabled && !submitting);
        }
    }

    function loadTurnstile() {
        return new Promise((resolve) => {
            if (window.turnstile) {
                resolve();
                return;
            }
            const existing = document.getElementById('cf-turnstile-script');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                return;
            }
            const script = document.createElement('script');
            script.id = 'cf-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = () => resolve();
            document.head.appendChild(script);
        });
    }

    async function mountTurnstile() {
        const siteKey = (config.turnstile?.siteKey || '').trim();
        if (!siteKey || !turnstileMount) return;
        await loadTurnstile();
        if (!window.turnstile || turnstileWidgetId !== null) return;
        turnstileWidgetId = window.turnstile.render(turnstileMount, {
            sitekey: siteKey,
            callback: () => {
                captchaPassed = true;
                updateActionButtons();
            },
            'expired-callback': () => {
                captchaPassed = false;
                updateActionButtons();
            },
            'error-callback': () => {
                captchaPassed = false;
                updateActionButtons();
            },
        });
    }

    function getCaptchaToken() {
        if (!captchaRequired || !window.turnstile || turnstileWidgetId === null) return '';
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }

    function resetCaptcha() {
        captchaPassed = false;
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
        }
        updateActionButtons();
    }

    function validateCurrentStep() {
        const panel = form.querySelector(`[data-spk-step="${step}"]`);
        if (!panel) return true;
        const fields = [...panel.querySelectorAll('input, select, textarea')].filter((el) => {
            if (el.disabled || el.hidden) return false;
            if (el.closest('[hidden]')) return false;
            return el.required || el.willValidate;
        });
        for (const el of fields) {
            if (!el.checkValidity()) {
                el.reportValidity();
                return false;
            }
        }
        return true;
    }

    function renderReview() {
        const data = new FormData(form);
        const forms = selectFormsLocal();
        if (!reviewEl) return;
        const rows = [
            ['Applicant', `${g(data, 'givenName')} ${g(data, 'familyName')}`],
            ['Email', g(data, 'email')],
            ['Language', g(data, 'formLanguage') === 'f' ? 'French' : 'English'],
            ['School', g(data, 'schoolName')],
            ['DLI', g(data, 'dli')],
            ['Forms', forms.map((c) => c.toUpperCase()).join(', ')],
        ];
        reviewEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v || '—'}</dd>`).join('');
        renderFormList(formListFinal, forms);
    }

    function goToStep(next) {
        step = Math.max(0, Math.min(STEP_COUNT - 1, next));
        form.querySelectorAll('.spk-step-panel').forEach((panel) => {
            const n = Number(panel.getAttribute('data-spk-step'));
            panel.hidden = n !== step;
        });
        if (stepsNav) {
            stepsNav.querySelectorAll('li').forEach((li) => {
                const n = Number(li.getAttribute('data-step'));
                li.toggleAttribute('aria-current', n === step);
                li.classList.toggle('is-done', n < step);
            });
        }
        if (backBtn) backBtn.hidden = step === 0;
        if (nextBtn) nextBtn.hidden = step === STEP_COUNT - 1;
        if (step === 5) syncExtras();
        if (step === STEP_COUNT - 1) {
            renderReview();
            mountTurnstile();
        }
        updateActionButtons();
        window.scrollTo({ top: form.offsetTop - 80, behavior: 'smooth' });
    }

    function collectPayload(delivery) {
        const data = new FormData(form);
        const dob = splitDate(g(data, 'dob'));
        const passportIssue = splitDate(g(data, 'passportIssue'));
        const passportExpiry = splitDate(g(data, 'passportExpiry'));
        const studyFrom = splitDate(g(data, 'studyFrom'));
        const studyTo = splitDate(g(data, 'studyTo'));
        const forms = selectFormsLocal();

        return {
            delivery,
            consent: data.get('consent') === 'yes',
            captchaToken: getCaptchaToken(),
            email: g(data, 'email').toLowerCase(),
            formLanguage: g(data, 'formLanguage') || 'e',
            forms,
            hasRepresentative: yn(g(data, 'hasRepresentative')),
            hasDesignee: yn(g(data, 'hasDesignee')),
            isCommonLaw: yn(g(data, 'isCommonLaw')),
            includeImm5707: yn(g(data, 'includeImm5707')),
            familyName: g(data, 'familyName'),
            givenName: g(data, 'givenName'),
            sex: g(data, 'sex'),
            dobYear: dob.year,
            dobMonth: dob.month,
            dobDay: dob.day,
            placeBirthCity: g(data, 'placeBirthCity'),
            placeBirthCountry: g(data, 'placeBirthCountry'),
            citizenship: g(data, 'citizenship'),
            maritalStatus: g(data, 'maritalStatus'),
            nativeLang: g(data, 'nativeLang'),
            ableToCommunicate: g(data, 'ableToCommunicate'),
            currentCountry: g(data, 'currentCountry'),
            currentStatus: g(data, 'currentStatus'),
            parent1FamilyName: g(data, 'parent1FamilyName'),
            parent1GivenName: g(data, 'parent1GivenName'),
            streetNum: g(data, 'streetNum'),
            streetName: g(data, 'streetName'),
            city: g(data, 'city'),
            provinceState: g(data, 'provinceState'),
            country: g(data, 'country'),
            postalCode: g(data, 'postalCode'),
            phone: g(data, 'phone'),
            phoneCountryCode: g(data, 'phoneCountryCode'),
            schoolName: g(data, 'schoolName'),
            dli: g(data, 'dli'),
            studyLevel: g(data, 'studyLevel'),
            fieldOfStudy: g(data, 'fieldOfStudy'),
            schoolProvince: g(data, 'schoolProvince'),
            schoolCity: g(data, 'schoolCity'),
            schoolAddress: g(data, 'schoolAddress'),
            studyFromYear: studyFrom.year,
            studyFromMonth: studyFrom.month,
            studyFromDay: studyFrom.day,
            studyToYear: studyTo.year,
            studyToMonth: studyTo.month,
            studyToDay: studyTo.day,
            tuitionAmount: g(data, 'tuitionAmount'),
            availableFunds: g(data, 'availableFunds'),
            funds: g(data, 'funds'),
            passportNumber: g(data, 'passportNumber'),
            passportCountry: g(data, 'passportCountry'),
            passportIssueYear: passportIssue.year,
            passportIssueMonth: passportIssue.month,
            passportIssueDay: passportIssue.day,
            passportExpiryYear: passportExpiry.year,
            passportExpiryMonth: passportExpiry.month,
            passportExpiryDay: passportExpiry.day,
            repFamilyName: g(data, 'repFamilyName'),
            repGivenName: g(data, 'repGivenName'),
            repOrganization: g(data, 'repOrganization'),
            repEmail: g(data, 'repEmail'),
            repPhone: g(data, 'repPhone'),
            repCity: g(data, 'repCity'),
            repCountry: g(data, 'repCountry'),
            designeeFamilyName: g(data, 'designeeFamilyName'),
            designeeGivenName: g(data, 'designeeGivenName'),
            designeeRelationship: g(data, 'designeeRelationship'),
            partnerFamilyName: g(data, 'partnerFamilyName'),
            partnerGivenName: g(data, 'partnerGivenName'),
            yearsTogether: g(data, 'yearsTogether'),
            commonLawCity: g(data, 'commonLawCity'),
            commonLawCountry: g(data, 'commonLawCountry'),
        };
    }

    async function handleFill(delivery) {
        const payload = collectPayload(delivery);
        if (!payload.consent) {
            showStatus('Please confirm the consent checkbox.', true);
            return;
        }
        if (captchaRequired && !payload.captchaToken) {
            showStatus('Complete the security check first.', true);
            return;
        }

        const base = (config.supabase?.url || '').replace(/\/$/, '');
        const anonKey = config.supabase?.anonKey || '';
        const kitFunction = config.supabase?.kitFunction || 'study-permit-kit';
        if (!base || !anonKey) {
            showStatus('Demo config is missing.', true);
            return;
        }

        submitting = true;
        updateActionButtons();
        showStatus(delivery === 'download' ? 'Filling kit… preparing ZIP…' : 'Filling kit… sending email…', false);

        try {
            const response = await fetch(`${base}/functions/v1/${kitFunction}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: anonKey,
                    Authorization: `Bearer ${anonKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (delivery === 'download') {
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || `Request failed (${response.status})`);
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `study-permit-kit_${payload.familyName}_${payload.givenName}.zip`.replace(/[^\w.\-]+/g, '_');
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showStatus(`Downloaded ZIP with ${payload.forms.length} forms.`, false);
            } else {
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
                showStatus(`Kit emailed to ${result.email || payload.email}.`, false);
            }
        } catch (error) {
            showStatus(error instanceof Error ? error.message : String(error), true);
            resetCaptcha();
        } finally {
            submitting = false;
            updateActionButtons();
        }
    }

    function refreshSelection() {
        const forms = selectFormsLocal();
        renderFormList(formList, forms);
        if (g(new FormData(form), 'isCommonLaw') && form.elements.maritalStatus) {
            // soft hint only when common-law selected and still on single
            const ms = form.elements.maritalStatus;
            if (yn(g(new FormData(form), 'isCommonLaw')) && ms.value === '02') {
                ms.value = '03';
            }
        }
        syncExtras();
    }

    ['hasRepresentative', 'hasDesignee', 'isCommonLaw', 'includeImm5707'].forEach((name) => {
        form.elements[name]?.addEventListener('change', refreshSelection);
    });

    nextBtn.addEventListener('click', () => {
        if (!validateCurrentStep()) return;
        goToStep(step + 1);
    });
    backBtn?.addEventListener('click', () => goToStep(step - 1));

    consentInput?.addEventListener('change', updateActionButtons);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleFill('email');
    });
    downloadBtn?.addEventListener('click', () => handleFill('download'));

    populateLov();
    refreshSelection();
    goToStep(0);
})();

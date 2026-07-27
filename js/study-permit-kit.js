(function initStudyPermitKit() {
    const form = document.getElementById('spkForm');
    const statusEl = document.getElementById('spkFormStatus');
    const submitBtn = document.getElementById('spkSubmit');
    const downloadBtn = document.getElementById('spkDownload');
    const nextBtn = document.getElementById('spkNext');
    const backBtn = document.getElementById('spkBack');
    const saveBtn = document.getElementById('spkSave');
    const resumeBtn = document.getElementById('spkResumeBtn');
    const saveStatusEl = document.getElementById('spkSaveStatus');
    const resumeStatusEl = document.getElementById('spkResumeStatus');
    const saveBanner = document.getElementById('spkSaveBanner');
    const saveCodeEl = document.getElementById('spkSaveCode');
    const saveMetaEl = document.getElementById('spkSaveMeta');
    const copyCodeBtn = document.getElementById('spkCopyCode');
    const consentInput = document.getElementById('spkConsent');
    const formsConfirmInput = document.getElementById('spkFormsConfirm');
    const turnstileMount = document.getElementById('spkTurnstile');
    const formList = document.getElementById('spkFormList');
    const formListFinal = document.getElementById('spkFormListFinal');
    const confirmNote = document.getElementById('spkConfirmNote');
    const reviewEl = document.getElementById('spkReview');
    const stepsNav = document.getElementById('spkSteps');
    const landingEl = document.getElementById('spkLanding');
    const wizardEl = document.getElementById('spkWizard');
    const startBtn = document.getElementById('spkStartBtn');
    const railMeter = document.getElementById('spkRailMeter');
    const railPct = document.getElementById('spkRailPct');
    const mobileStepLabel = document.getElementById('spkMobileStepLabel');
    const mobileStepCount = document.getElementById('spkMobileStepCount');
    const mobileFill = document.getElementById('spkMobileFill');
    const config = window.STUDY_PERMIT_KIT_CONFIG || {};
    const formMeta = config.forms || {};
    const captchaRequired = Boolean((config.turnstile?.siteKey || '').trim());

    let step = 0;
    let maxReachedStep = 0;
    let wizardOpen = false;
    const STEP_COUNT = 10;
    const STEP_CONFIRM = 1;
    const STEP_ABOUT = 2;
    const STEP_EXTRAS = 8;
    const STEP_LABELS = [
        'Situation',
        'Confirm forms',
        'About you',
        'Contact',
        'Study',
        'Passport',
        'Work history',
        'Background',
        'Extras',
        'Review & deliver',
    ];
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;
    let draftBusy = false;

    if (!form || !nextBtn) return;

    const actionButtons = [submitBtn, downloadBtn].filter(Boolean);

    function populateLovSelects(root = form) {
        const data = window.IMM1294_LOV || {};
        const countries = Array.isArray(data.countries) ? data.countries : [];
        const languages = Array.isArray(data.languages) ? data.languages : [];
        root.querySelectorAll('select[data-imm-lov="country"]').forEach((select) => {
            fillSelectOptions(select, countries, {
                placeholder: 'Select country…',
                selected: select.dataset.immDefault || select.value,
            });
        });
        root.querySelectorAll('select[data-imm-lov="language"]').forEach((select) => {
            fillSelectOptions(select, languages, {
                placeholder: 'Select language…',
                selected: select.dataset.immDefault || select.value,
            });
        });
    }

    const dyn = (window.ImmDynamicFields && typeof window.ImmDynamicFields.init === 'function')
        ? window.ImmDynamicFields.init({
            form,
            jobListId: 'spk-job-list',
            jobTemplateId: 'spk-job-template',
            addJobBtnId: 'spk-add-job',
            pcorListId: 'spk-pcor-list',
            pcorTemplateId: 'spk-pcor-template',
            addPcorBtnId: 'spk-add-pcor',
            phoneCountryCodeId: 'spk-phoneCountryCode',
            preferredLangId: 'spk-preferredLang',
            populateLovSelects,
        })
        : null;

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
        const forms = ['imm1294', 'imm5707', 'imm5483'];
        if (yn(g(data, 'hasRepresentative'))) forms.push('imm5476');
        if (yn(g(data, 'hasDesignee'))) forms.push('imm5475');
        if (yn(g(data, 'isCommonLaw'))) forms.push('imm5409');
        if (yn(g(data, 'needsCustodian'))) forms.push('imm5646');
        return forms;
    }

    function renderFormList(target, forms) {
        if (!target) return;
        target.innerHTML = '';
        for (const code of forms) {
            const meta = formMeta[code] || { title: code.toUpperCase(), required: false };
            const reason = meta.why
                || (meta.required ? 'Always included for this kit.' : 'Included from your situation answers.');
            const item = document.createElement('div');
            item.className = 'spk-form-item is-on';
            item.innerHTML =
                `<span class="spk-code">${code.toUpperCase()}</span>` +
                `<div><strong>${meta.title || code}</strong>` +
                `<p>${reason}</p></div>`;
            target.appendChild(item);
        }
    }

    function refreshConfirmStep() {
        const forms = selectFormsLocal();
        renderFormList(formList, forms);
        if (confirmNote) {
            const optional = forms.filter((code) => !(formMeta[code] || {}).required);
            confirmNote.textContent = optional.length
                ? `Core kit (3 forms) plus ${optional.length} situation-specific form${optional.length === 1 ? '' : 's'}.`
                : 'Core kit only — no optional forms from your answers.';
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
            el.querySelectorAll('input, select, textarea').forEach((input) => {
                const name = input.name || '';
                const must = show && (
                    (code === 'imm5476' && ['repFamilyName', 'repGivenName', 'repEmail'].includes(name))
                    || (code === 'imm5475' && ['designeeFamilyName', 'designeeGivenName', 'designeeRelationship'].includes(name))
                    || (code === 'imm5409' && ['partnerFamilyName', 'partnerGivenName', 'yearsTogether', 'commonLawCity', 'commonLawCountry'].includes(name))
                    || (code === 'imm5646' && ['custodianFamilyName', 'custodianGivenName', 'custodianAddress'].includes(name))
                );
                if (must) input.required = true;
                else if (
                    name.startsWith('rep')
                    || name.startsWith('designee')
                    || name.startsWith('partner')
                    || name.startsWith('commonLaw')
                    || name.startsWith('custodian')
                    || name === 'yearsTogether'
                ) {
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
        populateLovSelects(form);
    }

    function showStatus(message, isError) {
        if (!statusEl) return;
        statusEl.hidden = !message;
        statusEl.textContent = message || '';
        statusEl.classList.toggle('opp-form-status--error', Boolean(isError));
    }

    function showSideStatus(el, message, isError) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || '';
        el.classList.toggle('opp-form-status--error', Boolean(isError));
    }

    function apiBase() {
        const base = (config.supabase?.url || '').replace(/\/$/, '');
        const anonKey = config.supabase?.anonKey || '';
        const kitFunction = config.supabase?.kitFunction || 'study-permit-kit';
        return { base, anonKey, kitFunction };
    }

    function joinDate(year, month, day) {
        const y = String(year || '').padStart(4, '0');
        const m = String(month || '').padStart(2, '0');
        const d = String(day || '').padStart(2, '0');
        if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return '';
        return `${y}-${m}-${d}`;
    }

    function setFieldValue(name, value) {
        const el = form.elements[name];
        if (!el) return;
        if (el instanceof RadioNodeList) {
            // not used
            return;
        }
        if (el.type === 'checkbox') {
            el.checked = value === true || value === 'yes' || value === 'Y' || value === 'true';
            return;
        }
        if (typeof value === 'boolean') {
            el.value = value ? 'Y' : 'N';
            return;
        }
        el.value = value == null ? '' : String(value);
    }

    function applyDraftPayload(draft, resumeStep) {
        if (!draft || typeof draft !== 'object') return;

        const ynKeys = [
            'hasRepresentative', 'hasDesignee', 'isCommonLaw', 'needsCustodian',
            'hasAlias', 'previousCor', 'sameAsCor', 'previouslyMarried', 'sameAsMailing',
            'educationIndicator', 'hasNatId', 'hasUsCard', 'langTest',
            'bgTb', 'bgDisorder', 'bgOverstay', 'bgRefused', 'bgClaimAsylum',
            'bgCrime', 'bgMilitary', 'bgViolence', 'bgWitness', 'cicContactConsent',
        ];
        for (const key of ynKeys) {
            if (draft[key] !== undefined) {
                setFieldValue(key, yn(draft[key]) ? 'Y' : 'N');
            }
        }

        const textKeys = [
            'email', 'formLanguage', 'familyName', 'givenName', 'sex',
            'aliasFamilyName', 'aliasGivenName',
            'placeBirthCity', 'placeBirthCountry', 'citizenship', 'maritalStatus',
            'spouseFamilyName', 'spouseGivenName',
            'nativeLang', 'ableToCommunicate', 'preferredLang', 'currentCountry', 'currentStatus',
            'corOther', 'cwaCountry', 'cwaStatus', 'cwaOther',
            'prevSpouseFamilyName', 'prevSpouseGivenName', 'prevSpouseRelationship',
            'parent1FamilyName', 'parent1GivenName', 'parent1Dob', 'parent1Cob',
            'parent1Occupation', 'parent1Address', 'parent1Telephone',
            'parent2FamilyName', 'parent2GivenName', 'parent2Dob', 'parent2Cob',
            'parent2Occupation', 'parent2Address', 'parent2Telephone',
            'streetNum', 'streetName', 'city', 'provinceState', 'country', 'postalCode',
            'resStreetNum', 'resStreetName', 'resAptUnit', 'resCity', 'resCountry',
            'resProvinceState', 'resPostalCode',
            'phone', 'phoneType', 'phoneCountryCode',
            'schoolName', 'dli', 'studyLevel', 'fieldOfStudy',
            'schoolProvince', 'schoolCity', 'schoolAddress', 'tuitionAmount', 'availableFunds',
            'funds', 'fundsOtherPerson', 'caqNumber', 'palNumber',
            'eduField', 'eduSchool', 'eduCity', 'eduCountry', 'eduProvince',
            'natIdNumber', 'natIdCountry', 'usCardNumber',
            'passportNumber', 'passportCountry',
            'bgMedicalDetails', 'bgRefusedDetails', 'bgCrimeDetails', 'bgMilitaryDetails',
            'serviceIn',
            'repFamilyName', 'repGivenName', 'repOrganization', 'repEmail', 'repPhone',
            'repPhoneCountryCode', 'repMembershipId', 'repStreetNum', 'repStreetName',
            'repCity', 'repProvince', 'repCountry', 'repPostalCode',
            'designeeFamilyName', 'designeeGivenName', 'designeeRelationship',
            'partnerFamilyName', 'partnerGivenName', 'yearsTogether',
            'commonLawCity', 'commonLawProvince', 'commonLawCountry', 'commonLawStart',
            'custodianFamilyName', 'custodianGivenName', 'custodianDob', 'custodianStatus',
            'custodianAddress', 'custodianTelephone',
        ];
        for (const key of textKeys) {
            if (draft[key] !== undefined && draft[key] !== null) {
                setFieldValue(key, draft[key]);
            }
        }

        const datePairs = [
            ['dob', 'dobYear', 'dobMonth', 'dobDay'],
            ['marriageDate', 'marriageYear', 'marriageMonth', 'marriageDay'],
            ['corFrom', 'corFromYear', 'corFromMonth', 'corFromDay'],
            ['corTo', 'corToYear', 'corToMonth', 'corToDay'],
            ['cwaFrom', 'cwaFromYear', 'cwaFromMonth', 'cwaFromDay'],
            ['cwaTo', 'cwaToYear', 'cwaToMonth', 'cwaToDay'],
            ['prevSpouseDob', 'prevSpouseDobYear', 'prevSpouseDobMonth', 'prevSpouseDobDay'],
            ['prevSpouseFrom', 'prevSpouseFromYear', 'prevSpouseFromMonth', 'prevSpouseFromDay'],
            ['prevSpouseTo', 'prevSpouseToYear', 'prevSpouseToMonth', 'prevSpouseToDay'],
            ['passportIssue', 'passportIssueYear', 'passportIssueMonth', 'passportIssueDay'],
            ['passportExpiry', 'passportExpiryYear', 'passportExpiryMonth', 'passportExpiryDay'],
            ['natIdIssue', 'natIdIssueYear', 'natIdIssueMonth', 'natIdIssueDay'],
            ['natIdExpiry', 'natIdExpiryYear', 'natIdExpiryMonth', 'natIdExpiryDay'],
            ['usCardExpiry', 'usCardExpiryYear', 'usCardExpiryMonth', 'usCardExpiryDay'],
            ['studyFrom', 'studyFromYear', 'studyFromMonth', 'studyFromDay'],
            ['studyTo', 'studyToYear', 'studyToMonth', 'studyToDay'],
            ['caqExpiry', 'caqExpiryYear', 'caqExpiryMonth', 'caqExpiryDay'],
            ['palExpiry', 'palExpiryYear', 'palExpiryMonth', 'palExpiryDay'],
        ];
        for (const [name, y, m, d] of datePairs) {
            const joined = joinDate(draft[y], draft[m], draft[d]);
            if (joined) setFieldValue(name, joined);
        }

        const eduFrom = draft.eduFromYear && draft.eduFromMonth
            ? `${draft.eduFromYear}-${String(draft.eduFromMonth).padStart(2, '0')}`
            : '';
        const eduTo = draft.eduToYear && draft.eduToMonth
            ? `${draft.eduToYear}-${String(draft.eduToMonth).padStart(2, '0')}`
            : '';
        if (eduFrom) setFieldValue('eduFrom', eduFrom);
        if (eduTo) setFieldValue('eduTo', eduTo);

        if (dyn && Array.isArray(draft.jobs)) {
            dyn.clearJobs();
            for (const job of draft.jobs.slice(0, dyn.MAX_JOBS)) {
                const from = job.fromYear && job.fromMonth
                    ? `${job.fromYear}-${String(job.fromMonth).padStart(2, '0')}`
                    : '';
                const to = job.toYear && job.toMonth
                    ? `${job.toYear}-${String(job.toMonth).padStart(2, '0')}`
                    : '';
                dyn.addJob({
                    occupation: job.occupation || '',
                    employer: job.employer || '',
                    city: job.city || '',
                    country: job.country || '022',
                    provinceState: job.provinceState || '',
                    from,
                    to,
                });
            }
            if (!draft.jobs.length) {
                dyn.addJob({
                    occupation: 'Student',
                    employer: 'Universite Lyon',
                    city: 'Lyon',
                    country: '022',
                    from: '2022-09',
                });
            }
        }

        if (dyn && Array.isArray(draft.previousCorRows) && draft.previousCorRows.length) {
            dyn.clearPcor();
            for (const row of draft.previousCorRows.slice(0, dyn.MAX_PCOR || 2)) {
                dyn.addPcor({
                    country: row.country || '',
                    status: row.status || '',
                    other: row.other || '',
                    from: joinDate(row.fromYear, row.fromMonth, row.fromDay),
                    to: joinDate(row.toYear, row.toMonth, row.toDay),
                });
            }
        } else if (draft.pcor1Country && dyn) {
            dyn.clearPcor();
            dyn.addPcor({
                country: draft.pcor1Country,
                status: draft.pcor1Status,
                other: draft.pcor1Other,
                from: joinDate(draft.pcor1FromYear, draft.pcor1FromMonth, draft.pcor1FromDay),
                to: joinDate(draft.pcor1ToYear, draft.pcor1ToMonth, draft.pcor1ToDay),
            });
            if (draft.pcor2Country) {
                dyn.addPcor({
                    country: draft.pcor2Country,
                    status: draft.pcor2Status,
                    other: draft.pcor2Other,
                    from: joinDate(draft.pcor2FromYear, draft.pcor2FromMonth, draft.pcor2FromDay),
                    to: joinDate(draft.pcor2ToYear, draft.pcor2ToMonth, draft.pcor2ToDay),
                });
            }
        }

        if (formsConfirmInput) {
            formsConfirmInput.checked = draft.formsConfirmed !== false;
        }

        populateLov();
        applySituationSideEffects();
        syncExtras();
        refreshConfirmStep();
        dyn?.syncBranches();

        const target = Number.isFinite(Number(resumeStep))
            ? Math.max(0, Math.min(STEP_COUNT - 1, Number(resumeStep)))
            : step;
        maxReachedStep = Math.max(maxReachedStep, target);
        openWizard(target);
    }

    async function postKitAction(body) {
        const { base, anonKey, kitFunction } = apiBase();
        if (!base || !anonKey) throw new Error('Configuration is missing. Please refresh and try again.');
        const response = await fetch(`${base}/functions/v1/${kitFunction}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }
        return result;
    }

    async function handleSaveDraft() {
        if (draftBusy) return;
        if (step < STEP_ABOUT) {
            showSideStatus(saveStatusEl, 'Save becomes available on the About you step.', true);
            return;
        }
        const payload = collectPayload('download');
        const familyName = String(payload.familyName || '').trim();
        if (!familyName) {
            goToStep(STEP_ABOUT);
            showSideStatus(saveStatusEl, 'Enter your family name (last name) before saving — it’s needed to resume later.', true);
            const familyInput = document.getElementById('spk-familyName');
            familyInput?.focus();
            return;
        }

        draftBusy = true;
        if (saveBtn) saveBtn.disabled = true;
        showSideStatus(saveStatusEl, 'Saving progress…', false);
        try {
            const result = await postKitAction({
                action: 'save-draft',
                step,
                draft: payload,
            });
            if (saveBanner && saveCodeEl) {
                saveBanner.hidden = false;
                saveCodeEl.textContent = result.code || '';
                if (saveMetaEl) {
                    const expires = result.expiresAt
                        ? new Date(result.expiresAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                        })
                        : '30 days from now';
                    saveMetaEl.textContent = `Expires ${expires}. Resume with this code + your family name (last name).`;
                }
                saveBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            try {
                sessionStorage.setItem('spkResumeCode', result.code || '');
            } catch {
                // ignore
            }
            showSideStatus(saveStatusEl, 'Saved. Copy your resume code below.', false);
        } catch (error) {
            showSideStatus(saveStatusEl, error instanceof Error ? error.message : String(error), true);
        } finally {
            draftBusy = false;
            updateSaveButton();
        }
    }

    async function handleResumeDraft() {
        if (draftBusy) return;
        const code = document.getElementById('spk-resume-code')?.value?.trim() || '';
        const familyName = document.getElementById('spk-resume-familyName')?.value?.trim() || '';
        if (!code || !familyName) {
            showSideStatus(resumeStatusEl, 'Enter resume code and family name (last name).', true);
            return;
        }

        draftBusy = true;
        if (resumeBtn) resumeBtn.disabled = true;
        showSideStatus(resumeStatusEl, 'Looking up your draft…', false);
        try {
            const result = await postKitAction({
                action: 'load-draft',
                code,
                familyName,
            });
            applyDraftPayload(result.draft || {}, result.step);
            showSideStatus(saveStatusEl, 'Draft restored. Continue where you left off.', false);
            if (saveBanner) saveBanner.hidden = true;
        } catch (error) {
            showSideStatus(resumeStatusEl, error instanceof Error ? error.message : String(error), true);
        } finally {
            draftBusy = false;
            if (resumeBtn) resumeBtn.disabled = false;
        }
    }

    function updateSaveButton() {
        if (!saveBtn) return;
        const available = wizardOpen && step >= STEP_ABOUT && !draftBusy;
        saveBtn.hidden = !available;
        saveBtn.disabled = draftBusy || !available;
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
        dyn?.syncBranches();
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

    function applySituationSideEffects() {
        const data = new FormData(form);
        const ms = form.elements.maritalStatus;
        if (ms && yn(g(data, 'isCommonLaw'))) {
            if (ms.value === '02' || !ms.value) ms.value = '03';
        }
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

    function progressPct() {
        // Count completed steps (left behind) toward 100% on the final step.
        if (STEP_COUNT <= 1) return 100;
        return Math.round((step / (STEP_COUNT - 1)) * 100);
    }

    function renderStepsNav() {
        if (!stepsNav) return;
        stepsNav.innerHTML = '';
        STEP_LABELS.forEach((label, index) => {
            const li = document.createElement('li');
            li.setAttribute('data-step', String(index));
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerHTML = `<span class="spk-rail__num" aria-hidden="true">${index + 1}</span><span>${label}</span>`;
            btn.addEventListener('click', () => {
                if (index === step) return;
                if (index > maxReachedStep) return;
                // Jumping back to a completed / already-reached step
                goToStep(index);
            });
            li.appendChild(btn);
            stepsNav.appendChild(li);
        });
        updateStepsNav();
    }

    function updateStepsNav() {
        if (!stepsNav) return;
        stepsNav.querySelectorAll('li').forEach((li) => {
            const n = Number(li.getAttribute('data-step'));
            const isCurrent = n === step;
            const isDone = n < step;
            const isReachable = n <= maxReachedStep;
            li.classList.toggle('is-current', isCurrent);
            li.classList.toggle('is-done', isDone);
            li.classList.toggle('is-reachable', isReachable && !isCurrent);
            li.classList.toggle('is-locked', !isReachable);
            if (isCurrent) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
            const btn = li.querySelector('button');
            if (btn) {
                btn.disabled = !isReachable || isCurrent;
                btn.setAttribute('aria-label', `${STEP_LABELS[n]}${isDone ? ' (completed)' : isCurrent ? ' (current)' : ''}`);
            }
        });

        const pct = progressPct();
        if (railMeter) railMeter.style.width = `${pct}%`;
        if (railPct) railPct.textContent = `${pct}% complete`;
        if (mobileStepLabel) mobileStepLabel.textContent = STEP_LABELS[step] || '';
        if (mobileStepCount) mobileStepCount.textContent = `Step ${step + 1} of ${STEP_COUNT}`;
        if (mobileFill) mobileFill.style.width = `${pct}%`;
    }

    function openWizard(targetStep = 0) {
        wizardOpen = true;
        if (landingEl) landingEl.hidden = true;
        if (wizardEl) wizardEl.hidden = false;
        goToStep(targetStep);
        const focusRoot = wizardEl || form;
        focusRoot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function syncProgressVisibility() {
        // Sticky progress appears from Confirm forms onward (not on Situation).
        const showProgress = wizardOpen && step >= STEP_CONFIRM;
        wizardEl?.classList.toggle('spk-wizard--with-progress', showProgress);
    }

    function goToStep(next) {
        step = Math.max(0, Math.min(STEP_COUNT - 1, next));
        maxReachedStep = Math.max(maxReachedStep, step);
        form.querySelectorAll('.spk-step-panel').forEach((panel) => {
            const n = Number(panel.getAttribute('data-spk-step'));
            panel.hidden = n !== step;
        });
        syncProgressVisibility();
        updateStepsNav();
        if (backBtn) backBtn.hidden = step === 0;
        if (nextBtn) {
            nextBtn.hidden = step === STEP_COUNT - 1;
            nextBtn.textContent = step === STEP_CONFIRM ? 'Confirm & continue' : 'Continue';
        }
        if (step === STEP_CONFIRM) refreshConfirmStep();
        if (step === STEP_EXTRAS) syncExtras();
        if (step === STEP_COUNT - 1) {
            renderReview();
            mountTurnstile();
        }
        dyn?.syncBranches();
        updateActionButtons();
        updateSaveButton();
        if (wizardOpen) {
            const anchor = document.getElementById('spkMobileProgress') || form;
            window.scrollTo({ top: Math.max(0, (anchor?.offsetTop || 0) - 72), behavior: 'smooth' });
        }
    }

    function collectPayload(delivery) {
        dyn?.syncBranches();
        const data = new FormData(form);
        const sd = dyn?.splitDate || splitDate;
        const sm = dyn?.splitMonth || ((v) => {
            const [y = '', m = ''] = String(v || '').split('-');
            return { year: y, month: m };
        });
        const dob = sd(g(data, 'dob'));
        const passportIssue = sd(g(data, 'passportIssue'));
        const passportExpiry = sd(g(data, 'passportExpiry'));
        const studyFrom = sd(g(data, 'studyFrom'));
        const studyTo = sd(g(data, 'studyTo'));
        const marriage = sd(g(data, 'marriageDate'));
        const corFrom = sd(g(data, 'corFrom'));
        const corTo = sd(g(data, 'corTo'));
        const cwaFrom = sd(g(data, 'cwaFrom'));
        const cwaTo = sd(g(data, 'cwaTo'));
        const prevSpouseDob = sd(g(data, 'prevSpouseDob'));
        const prevSpouseFrom = sd(g(data, 'prevSpouseFrom'));
        const prevSpouseTo = sd(g(data, 'prevSpouseTo'));
        const natIdIssue = sd(g(data, 'natIdIssue'));
        const natIdExpiry = sd(g(data, 'natIdExpiry'));
        const usCardExpiry = sd(g(data, 'usCardExpiry'));
        const eduFrom = sm(g(data, 'eduFrom'));
        const eduTo = sm(g(data, 'eduTo'));
        const caqExpiry = sd(g(data, 'caqExpiry'));
        const palExpiry = sd(g(data, 'palExpiry'));
        const forms = selectFormsLocal();
        const jobs = dyn ? dyn.collectJobs() : [];
        const first = jobs[0] || {};
        const pcor = dyn ? dyn.collectPcorRows() : [];
        const pcor1 = pcor[0] || {};
        const pcor2 = pcor[1] || {};
        const provinceActive = dyn?.activeProvinceControl?.(
            form.querySelector('[data-imm-province-wrap][data-imm-name="provinceState"]'),
        );
        const provinceState = provinceActive
            ? String(provinceActive.value || '').trim()
            : g(data, 'provinceState');

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
            needsCustodian: yn(g(data, 'needsCustodian')),
            familyName: g(data, 'familyName'),
            givenName: g(data, 'givenName'),
            hasAlias: g(data, 'hasAlias') || 'N',
            aliasFamilyName: g(data, 'aliasFamilyName'),
            aliasGivenName: g(data, 'aliasGivenName'),
            sex: g(data, 'sex'),
            dobYear: dob.year,
            dobMonth: dob.month,
            dobDay: dob.day,
            placeBirthCity: g(data, 'placeBirthCity'),
            placeBirthCountry: g(data, 'placeBirthCountry'),
            citizenship: g(data, 'citizenship'),
            maritalStatus: g(data, 'maritalStatus'),
            spouseFamilyName: g(data, 'spouseFamilyName'),
            spouseGivenName: g(data, 'spouseGivenName'),
            marriageYear: marriage.year,
            marriageMonth: marriage.month,
            marriageDay: marriage.day,
            nativeLang: g(data, 'nativeLang'),
            ableToCommunicate: g(data, 'ableToCommunicate'),
            preferredLang: g(data, 'preferredLang') || 'English',
            langTest: g(data, 'langTest') || 'N',
            currentCountry: g(data, 'currentCountry'),
            currentStatus: g(data, 'currentStatus'),
            corOther: g(data, 'corOther'),
            corFromYear: corFrom.year,
            corFromMonth: corFrom.month,
            corFromDay: corFrom.day,
            corToYear: corTo.year,
            corToMonth: corTo.month,
            corToDay: corTo.day,
            previousCor: g(data, 'previousCor') || 'N',
            previousCorRows: pcor,
            pcor1Country: pcor1.country || '',
            pcor1Status: pcor1.status || '',
            pcor1Other: pcor1.other || '',
            pcor1FromYear: pcor1.fromYear || '',
            pcor1FromMonth: pcor1.fromMonth || '',
            pcor1FromDay: pcor1.fromDay || '',
            pcor1ToYear: pcor1.toYear || '',
            pcor1ToMonth: pcor1.toMonth || '',
            pcor1ToDay: pcor1.toDay || '',
            pcor2Country: pcor2.country || '',
            pcor2Status: pcor2.status || '',
            pcor2Other: pcor2.other || '',
            pcor2FromYear: pcor2.fromYear || '',
            pcor2FromMonth: pcor2.fromMonth || '',
            pcor2FromDay: pcor2.fromDay || '',
            pcor2ToYear: pcor2.toYear || '',
            pcor2ToMonth: pcor2.toMonth || '',
            pcor2ToDay: pcor2.toDay || '',
            sameAsCor: g(data, 'sameAsCor') || 'Y',
            cwaCountry: g(data, 'cwaCountry'),
            cwaStatus: g(data, 'cwaStatus'),
            cwaOther: g(data, 'cwaOther'),
            cwaFromYear: cwaFrom.year,
            cwaFromMonth: cwaFrom.month,
            cwaFromDay: cwaFrom.day,
            cwaToYear: cwaTo.year,
            cwaToMonth: cwaTo.month,
            cwaToDay: cwaTo.day,
            previouslyMarried: g(data, 'previouslyMarried') || 'N',
            prevSpouseFamilyName: g(data, 'prevSpouseFamilyName'),
            prevSpouseGivenName: g(data, 'prevSpouseGivenName'),
            prevSpouseDobYear: prevSpouseDob.year,
            prevSpouseDobMonth: prevSpouseDob.month,
            prevSpouseDobDay: prevSpouseDob.day,
            prevSpouseRelationship: g(data, 'prevSpouseRelationship'),
            prevSpouseFromYear: prevSpouseFrom.year,
            prevSpouseFromMonth: prevSpouseFrom.month,
            prevSpouseFromDay: prevSpouseFrom.day,
            prevSpouseToYear: prevSpouseTo.year,
            prevSpouseToMonth: prevSpouseTo.month,
            prevSpouseToDay: prevSpouseTo.day,
            parent1FamilyName: g(data, 'parent1FamilyName'),
            parent1GivenName: g(data, 'parent1GivenName'),
            parent1Dob: g(data, 'parent1Dob'),
            parent1Cob: g(data, 'parent1Cob'),
            parent1Occupation: g(data, 'parent1Occupation'),
            parent1Address: g(data, 'parent1Address'),
            parent1Telephone: g(data, 'parent1Telephone'),
            parent2FamilyName: g(data, 'parent2FamilyName'),
            parent2GivenName: g(data, 'parent2GivenName'),
            parent2Dob: g(data, 'parent2Dob'),
            parent2Cob: g(data, 'parent2Cob'),
            parent2Occupation: g(data, 'parent2Occupation'),
            parent2Address: g(data, 'parent2Address'),
            parent2Telephone: g(data, 'parent2Telephone'),
            streetNum: g(data, 'streetNum'),
            streetName: g(data, 'streetName'),
            city: g(data, 'city'),
            provinceState,
            country: g(data, 'country'),
            postalCode: g(data, 'postalCode'),
            sameAsMailing: g(data, 'sameAsMailing') || 'Y',
            resStreetNum: g(data, 'resStreetNum'),
            resStreetName: g(data, 'resStreetName'),
            resAptUnit: g(data, 'resAptUnit'),
            resCity: g(data, 'resCity'),
            resCountry: g(data, 'resCountry'),
            resProvinceState: g(data, 'resProvinceState'),
            resPostalCode: g(data, 'resPostalCode'),
            phone: g(data, 'phone'),
            phoneType: g(data, 'phoneType') || '02',
            phoneCountryCode: g(data, 'phoneCountryCode') || '33',
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
            fundsOtherPerson: g(data, 'fundsOtherPerson'),
            caqNumber: g(data, 'caqNumber'),
            caqExpiryYear: caqExpiry.year,
            caqExpiryMonth: caqExpiry.month,
            caqExpiryDay: caqExpiry.day,
            palNumber: g(data, 'palNumber'),
            palExpiryYear: palExpiry.year,
            palExpiryMonth: palExpiry.month,
            palExpiryDay: palExpiry.day,
            educationIndicator: g(data, 'educationIndicator') || 'N',
            eduFromYear: eduFrom.year,
            eduFromMonth: eduFrom.month,
            eduToYear: eduTo.year,
            eduToMonth: eduTo.month,
            eduField: g(data, 'eduField'),
            eduSchool: g(data, 'eduSchool'),
            eduCity: g(data, 'eduCity'),
            eduCountry: g(data, 'eduCountry'),
            eduProvince: g(data, 'eduProvince'),
            hasNatId: g(data, 'hasNatId') || 'N',
            natIdNumber: g(data, 'natIdNumber'),
            natIdCountry: g(data, 'natIdCountry'),
            natIdIssueYear: natIdIssue.year,
            natIdIssueMonth: natIdIssue.month,
            natIdIssueDay: natIdIssue.day,
            natIdExpiryYear: natIdExpiry.year,
            natIdExpiryMonth: natIdExpiry.month,
            natIdExpiryDay: natIdExpiry.day,
            hasUsCard: g(data, 'hasUsCard') || 'N',
            usCardNumber: g(data, 'usCardNumber'),
            usCardExpiryYear: usCardExpiry.year,
            usCardExpiryMonth: usCardExpiry.month,
            usCardExpiryDay: usCardExpiry.day,
            passportNumber: g(data, 'passportNumber'),
            passportCountry: g(data, 'passportCountry'),
            passportIssueYear: passportIssue.year,
            passportIssueMonth: passportIssue.month,
            passportIssueDay: passportIssue.day,
            passportExpiryYear: passportExpiry.year,
            passportExpiryMonth: passportExpiry.month,
            passportExpiryDay: passportExpiry.day,
            occupation: first.occupation || '',
            employer: first.employer || '',
            occupationCity: first.city || '',
            occupationCountry: first.country || '',
            occupationProvince: first.provinceState || '',
            occupationFromYear: first.fromYear || '',
            occupationFromMonth: first.fromMonth || '',
            jobs,
            bgTb: g(data, 'bgTb') || 'N',
            bgDisorder: g(data, 'bgDisorder') || 'N',
            bgMedicalDetails: g(data, 'bgMedicalDetails'),
            bgOverstay: g(data, 'bgOverstay') || 'N',
            bgRefused: g(data, 'bgRefused') || 'N',
            bgClaimAsylum: g(data, 'bgClaimAsylum') || 'N',
            bgRefusedDetails: g(data, 'bgRefusedDetails'),
            bgCrime: g(data, 'bgCrime') || 'N',
            bgCrimeDetails: g(data, 'bgCrimeDetails'),
            bgMilitary: g(data, 'bgMilitary') || 'N',
            bgMilitaryDetails: g(data, 'bgMilitaryDetails'),
            bgViolence: g(data, 'bgViolence') || 'N',
            bgWitness: g(data, 'bgWitness') || 'N',
            cicContactConsent: g(data, 'cicContactConsent') || 'N',
            serviceIn: g(data, 'serviceIn') || (g(data, 'formLanguage') === 'f' ? 'French' : 'English'),
            repFamilyName: g(data, 'repFamilyName'),
            repGivenName: g(data, 'repGivenName'),
            repOrganization: g(data, 'repOrganization'),
            repEmail: g(data, 'repEmail'),
            repPhone: g(data, 'repPhone'),
            repPhoneCountryCode: g(data, 'repPhoneCountryCode'),
            repMembershipId: g(data, 'repMembershipId'),
            repStreetNum: g(data, 'repStreetNum'),
            repStreetName: g(data, 'repStreetName'),
            repCity: g(data, 'repCity'),
            repProvince: g(data, 'repProvince'),
            repCountry: g(data, 'repCountry'),
            repPostalCode: g(data, 'repPostalCode'),
            designeeFamilyName: g(data, 'designeeFamilyName'),
            designeeGivenName: g(data, 'designeeGivenName'),
            designeeRelationship: g(data, 'designeeRelationship'),
            partnerFamilyName: g(data, 'partnerFamilyName'),
            partnerGivenName: g(data, 'partnerGivenName'),
            yearsTogether: g(data, 'yearsTogether'),
            commonLawCity: g(data, 'commonLawCity'),
            commonLawProvince: g(data, 'commonLawProvince'),
            commonLawCountry: g(data, 'commonLawCountry'),
            commonLawStart: g(data, 'commonLawStart'),
            custodianFamilyName: g(data, 'custodianFamilyName'),
            custodianGivenName: g(data, 'custodianGivenName'),
            custodianDob: g(data, 'custodianDob'),
            custodianStatus: g(data, 'custodianStatus'),
            custodianAddress: g(data, 'custodianAddress'),
            custodianTelephone: g(data, 'custodianTelephone'),
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
            showStatus('Configuration is missing. Please refresh and try again.', true);
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

    function onSituationChange() {
        // Situation changed — require re-confirm on the next step.
        if (formsConfirmInput) formsConfirmInput.checked = false;
        applySituationSideEffects();
        if (step === STEP_CONFIRM) refreshConfirmStep();
        syncExtras();
    }

    ['hasRepresentative', 'hasDesignee', 'isCommonLaw', 'needsCustodian'].forEach((name) => {
        form.elements[name]?.addEventListener('change', onSituationChange);
    });

    startBtn?.addEventListener('click', () => {
        maxReachedStep = 0;
        openWizard(0);
    });
    nextBtn.addEventListener('click', () => {
        if (!validateCurrentStep()) return;
        if (step === 0) applySituationSideEffects();
        goToStep(step + 1);
    });
    backBtn?.addEventListener('click', () => goToStep(step - 1));
    saveBtn?.addEventListener('click', () => handleSaveDraft());
    resumeBtn?.addEventListener('click', () => handleResumeDraft());
    copyCodeBtn?.addEventListener('click', async () => {
        const code = saveCodeEl?.textContent?.trim() || '';
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            showSideStatus(saveStatusEl, 'Code copied to clipboard.', false);
        } catch {
            showSideStatus(saveStatusEl, 'Could not copy automatically — select the code and copy it.', true);
        }
    });

    consentInput?.addEventListener('change', updateActionButtons);
    form.addEventListener('change', () => dyn?.syncBranches());
    form.addEventListener('input', () => dyn?.syncBranches());
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleFill('email');
    });
    downloadBtn?.addEventListener('click', () => handleFill('download'));

    populateLov();
    dyn?.populateDialCodes();
    if (dyn) {
        dyn.clearJobs();
        dyn.addJob({
            occupation: 'Student',
            employer: 'Universite Lyon',
            city: 'Lyon',
            country: '022',
            from: '2022-09',
        });
        if (form.querySelector('[name="previousCor"]')?.value === 'Y') {
            dyn.clearPcor();
            dyn.addPcor({
                country: '012',
                status: '03',
                from: '2021-01-15',
                to: '2021-08-30',
            });
        }
    }
    applySituationSideEffects();
    syncExtras();
    dyn?.syncBranches();
    renderStepsNav();
    // Stay on landing until Start or Resume. Keep panels ready at step 0.
    form.querySelectorAll('.spk-step-panel').forEach((panel) => {
        const n = Number(panel.getAttribute('data-spk-step'));
        panel.hidden = n !== 0;
    });
    if (backBtn) backBtn.hidden = true;
    updateActionButtons();
    updateSaveButton();

    try {
        const remembered = sessionStorage.getItem('spkResumeCode');
        const resumeCodeInput = document.getElementById('spk-resume-code');
        if (remembered && resumeCodeInput && !resumeCodeInput.value) {
            resumeCodeInput.value = remembered;
        }
    } catch {
        // ignore
    }
})();

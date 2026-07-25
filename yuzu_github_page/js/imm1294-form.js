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
    let jobRowsVisible = 1;

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
        return new Promise((promiseResolve, promiseReject) => {
            if (window.turnstile) {
                promiseResolve();
                return;
            }
            const existing = document.getElementById('cf-turnstile-script');
            if (existing) {
                existing.addEventListener('load', () => promiseResolve(), { once: true });
                existing.addEventListener('error', () => promiseReject(new Error('Captcha script failed')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.id = 'cf-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => promiseResolve();
            script.onerror = () => promiseReject(new Error('Captcha script failed'));
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

    function fieldValue(name) {
        const el = form.elements.namedItem(name);
        if (!el) return '';
        if (el instanceof RadioNodeList) return String(el.value || '').trim();
        return String(el.value || '').trim();
    }

    function matchShowRule(rule) {
        // "field=A|B" or "field!=A"
        const m = /^([A-Za-z0-9_]+)(!?=)(.+)$/.exec(rule.trim());
        if (!m) return false;
        const [, name, op, raw] = m;
        const actual = fieldValue(name);
        const expected = raw.split('|').map((v) => v.trim());
        const hit = expected.includes(actual);
        return op === '!=' ? !hit : hit;
    }

    function setBranchVisible(panel, visible) {
        panel.hidden = !visible;
        panel.classList.toggle('imm-branch--visible', visible);
        panel.querySelectorAll('input, select, textarea').forEach((input) => {
            if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement ||
                input instanceof HTMLTextAreaElement)) return;
            if (!input.dataset.immReqBase) {
                input.dataset.immReqBase = input.required ? '1' : '0';
            }
            const wantsRequired = input.dataset.immReqBase === '1' ||
                input.hasAttribute('data-imm-required');
            if (!visible) {
                input.required = false;
                input.disabled = true;
            } else {
                input.disabled = false;
                input.required = wantsRequired || input.hasAttribute('data-imm-required');
            }
        });
    }

    function syncBranches() {
        form.querySelectorAll('[data-imm-show]').forEach((panel) => {
            if (!(panel instanceof HTMLElement)) return;
            const rules = (panel.getAttribute('data-imm-show') || '')
                .split(',')
                .map((r) => r.trim())
                .filter(Boolean);
            const mode = panel.getAttribute('data-imm-show-mode') || 'all';
            const ok = mode === 'any'
                ? rules.some(matchShowRule)
                : rules.every(matchShowRule);
            setBranchVisible(panel, ok);
        });

        // Job rows 2–3 driven by counter, not Yes/No
        for (let n = 2; n <= 3; n += 1) {
            const panel = form.querySelector(`[data-imm-job-row="${n}"]`);
            if (panel instanceof HTMLElement) {
                setBranchVisible(panel, jobRowsVisible >= n);
            }
        }

        const addJobBtn = document.getElementById('imm-add-job');
        if (addJobBtn instanceof HTMLButtonElement) {
            addJobBtn.hidden = jobRowsVisible >= 3;
        }
        const removeJobBtn = document.getElementById('imm-remove-job');
        if (removeJobBtn instanceof HTMLButtonElement) {
            removeJobBtn.hidden = jobRowsVisible <= 1;
        }

        const preferred = form.querySelector('#imm-preferredLang');
        if (preferred instanceof HTMLSelectElement) {
            const both = fieldValue('ableToCommunicate') === 'Both';
            preferred.closest('.opp-field')?.toggleAttribute('hidden', !both);
            preferred.required = both;
            preferred.disabled = !both;
        }
    }

    function splitDate(value) {
        const [y = '', m = '', d = ''] = String(value || '').split('-');
        return { year: y, month: m, day: d };
    }

    function splitMonth(value) {
        const [y = '', m = ''] = String(value || '').split('-');
        return { year: y, month: m };
    }

    function g(data, key) {
        return String(data.get(key) || '').trim();
    }

    function collectPayload(delivery) {
        const data = new FormData(form);
        const dob = splitDate(data.get('dob'));
        const passportIssue = splitDate(data.get('passportIssue'));
        const passportExpiry = splitDate(data.get('passportExpiry'));
        const studyFrom = splitDate(data.get('studyFrom'));
        const studyTo = splitDate(data.get('studyTo'));
        const occupationFrom = splitMonth(data.get('occupationFrom'));
        const occupationTo = splitMonth(data.get('occupationTo'));
        const marriage = splitDate(data.get('marriageDate'));
        const corFrom = splitDate(data.get('corFrom'));
        const corTo = splitDate(data.get('corTo'));
        const pcor1From = splitDate(data.get('pcor1From'));
        const pcor1To = splitDate(data.get('pcor1To'));
        const pcor2From = splitDate(data.get('pcor2From'));
        const pcor2To = splitDate(data.get('pcor2To'));
        const cwaFrom = splitDate(data.get('cwaFrom'));
        const cwaTo = splitDate(data.get('cwaTo'));
        const prevSpouseDob = splitDate(data.get('prevSpouseDob'));
        const prevSpouseFrom = splitDate(data.get('prevSpouseFrom'));
        const prevSpouseTo = splitDate(data.get('prevSpouseTo'));
        const natIdIssue = splitDate(data.get('natIdIssue'));
        const natIdExpiry = splitDate(data.get('natIdExpiry'));
        const usCardExpiry = splitDate(data.get('usCardExpiry'));
        const eduFrom = splitMonth(data.get('eduFrom'));
        const eduTo = splitMonth(data.get('eduTo'));
        const caqExpiry = splitDate(data.get('caqExpiry'));
        const palExpiry = splitDate(data.get('palExpiry'));
        const job2From = splitMonth(data.get('job2From'));
        const job2To = splitMonth(data.get('job2To'));
        const job3From = splitMonth(data.get('job3From'));
        const job3To = splitMonth(data.get('job3To'));

        return {
            delivery,
            email: g(data, 'email').toLowerCase(),
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
            pcor1Country: g(data, 'pcor1Country'),
            pcor1Status: g(data, 'pcor1Status'),
            pcor1Other: g(data, 'pcor1Other'),
            pcor1FromYear: pcor1From.year,
            pcor1FromMonth: pcor1From.month,
            pcor1FromDay: pcor1From.day,
            pcor1ToYear: pcor1To.year,
            pcor1ToMonth: pcor1To.month,
            pcor1ToDay: pcor1To.day,
            pcor2Country: g(data, 'pcor2Country'),
            pcor2Status: g(data, 'pcor2Status'),
            pcor2Other: g(data, 'pcor2Other'),
            pcor2FromYear: pcor2From.year,
            pcor2FromMonth: pcor2From.month,
            pcor2FromDay: pcor2From.day,
            pcor2ToYear: pcor2To.year,
            pcor2ToMonth: pcor2To.month,
            pcor2ToDay: pcor2To.day,
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
            nativeLang: g(data, 'nativeLang'),
            ableToCommunicate: g(data, 'ableToCommunicate'),
            preferredLang: g(data, 'preferredLang') || 'English',
            langTest: g(data, 'langTest') || 'N',
            streetNum: g(data, 'streetNum'),
            streetName: g(data, 'streetName'),
            city: g(data, 'city'),
            country: g(data, 'country'),
            provinceState: g(data, 'provinceState'),
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
            studyLevel: g(data, 'studyLevel'),
            fieldOfStudy: g(data, 'fieldOfStudy'),
            schoolProvince: g(data, 'schoolProvince'),
            schoolCity: g(data, 'schoolCity'),
            schoolAddress: g(data, 'schoolAddress'),
            dli: g(data, 'dli'),
            studyFromYear: studyFrom.year,
            studyFromMonth: studyFrom.month,
            studyFromDay: studyFrom.day,
            studyToYear: studyTo.year,
            studyToMonth: studyTo.month,
            studyToDay: studyTo.day,
            tuitionAmount: g(data, 'tuitionAmount'),
            availableFunds: g(data, 'availableFunds') || g(data, 'tuitionAmount'),
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
            occupation: g(data, 'occupation'),
            employer: g(data, 'employer'),
            occupationCity: g(data, 'occupationCity'),
            occupationCountry: g(data, 'occupationCountry'),
            occupationProvince: g(data, 'occupationProvince'),
            occupationFromYear: occupationFrom.year,
            occupationFromMonth: occupationFrom.month,
            occupationToYear: occupationTo.year,
            occupationToMonth: occupationTo.month,
            job2Occupation: jobRowsVisible >= 2 ? g(data, 'job2Occupation') : '',
            job2Employer: g(data, 'job2Employer'),
            job2City: g(data, 'job2City'),
            job2Country: g(data, 'job2Country'),
            job2Province: g(data, 'job2Province'),
            job2FromYear: job2From.year,
            job2FromMonth: job2From.month,
            job2ToYear: job2To.year,
            job2ToMonth: job2To.month,
            job3Occupation: jobRowsVisible >= 3 ? g(data, 'job3Occupation') : '',
            job3Employer: g(data, 'job3Employer'),
            job3City: g(data, 'job3City'),
            job3Country: g(data, 'job3Country'),
            job3Province: g(data, 'job3Province'),
            job3FromYear: job3From.year,
            job3FromMonth: job3From.month,
            job3ToYear: job3To.year,
            job3ToMonth: job3To.month,
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
            serviceIn: g(data, 'serviceIn') || 'English',
            consent: data.get('consent') === 'yes',
            captchaToken: getCaptchaToken()
        };
    }

    function clientValidate(payload, delivery) {
        syncBranches();
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
            jobRowsVisible = 1;
            syncBranches();
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
    form.addEventListener('change', syncBranches);
    form.addEventListener('input', syncBranches);

    document.getElementById('imm-add-job')?.addEventListener('click', () => {
        jobRowsVisible = Math.min(3, jobRowsVisible + 1);
        syncBranches();
    });
    document.getElementById('imm-remove-job')?.addEventListener('click', () => {
        jobRowsVisible = Math.max(1, jobRowsVisible - 1);
        syncBranches();
    });

    syncBranches();

    if (captchaRequired) {
        updateSubmitState(false);
        renderTurnstile();
    } else {
        updateSubmitState(true);
    }
})();

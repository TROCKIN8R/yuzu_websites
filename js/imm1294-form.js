(function initImm1294Form() {
    const form = document.getElementById('imm1294Form');
    const statusEl = document.getElementById('imm1294FormStatus');
    const submitBtn = document.getElementById('imm1294Submit');
    const downloadBtn = document.getElementById('imm1294Download');
    const turnstileMount = document.getElementById('imm1294Turnstile');
    const consentInput = document.getElementById('imm1294Consent');
    const jobList = document.getElementById('imm-job-list');
    const jobTemplate = document.getElementById('imm-job-template');
    const pcorList = document.getElementById('imm-pcor-list');
    const config = window.IMM1294_CONFIG || {};
    const captchaRequired = Boolean((config.turnstile?.siteKey || '').trim());
    const MAX_JOBS = 3;
    let turnstileWidgetId = null;
    let captchaPassed = false;
    let submitting = false;
    let dragItem = null;

    if (!form || !submitBtn) return;

    const actionButtons = [submitBtn, downloadBtn].filter(Boolean);

    function lov() {
        return window.IMM1294_LOV || {};
    }

    function fillSelectOptions(select, rows, {
        placeholder = 'Select…',
        selected = '',
        allowEmpty = false,
        emptyLabel = 'Select…',
    } = {}) {
        if (!(select instanceof HTMLSelectElement)) return;
        const keep = selected || select.dataset.immDefault || select.value || '';
        select.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = allowEmpty ? emptyLabel : placeholder;
        if (!allowEmpty) ph.disabled = true;
        select.appendChild(ph);
        for (const row of rows) {
            const opt = document.createElement('option');
            opt.value = row.value;
            opt.textContent = row.label;
            select.appendChild(opt);
        }
        if (keep && [...select.options].some((o) => o.value === keep)) {
            select.value = keep;
        } else if (!allowEmpty && keep) {
            select.selectedIndex = 0;
        }
    }

    function languageRows() {
        const data = lov();
        const all = Array.isArray(data.languages) ? data.languages : [];
        const preferred = new Set(data.preferredLanguageCodes || []);
        const top = all.filter((r) => preferred.has(r.value));
        const rest = all.filter((r) => !preferred.has(r.value));
        // Keep preferred order from preferredLanguageCodes
        const order = [...preferred];
        top.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
        return [...top, ...rest];
    }

    function populateLovSelects(root = form) {
        const data = lov();
        const countries = Array.isArray(data.countries) ? data.countries : [];
        root.querySelectorAll('select[data-imm-lov="country"]').forEach((select) => {
            fillSelectOptions(select, countries, {
                placeholder: 'Select country…',
                allowEmpty: !select.required && !select.hasAttribute('data-imm-required'),
                emptyLabel: 'Select country…',
                selected: select.dataset.immDefault || select.value,
            });
        });
        const langs = languageRows();
        root.querySelectorAll('select[data-imm-lov="language"]').forEach((select) => {
            fillSelectOptions(select, langs, {
                placeholder: 'Select language…',
                selected: select.dataset.immDefault || select.value,
            });
        });
    }

    function provinceOptionsForCountry(countryCode) {
        const data = lov();
        if (countryCode === data.canadaCode) return data.caProvinces || [];
        if (countryCode === data.usaCode) return data.usStates || [];
        return null;
    }

    function activeProvinceControl(wrap) {
        if (!(wrap instanceof HTMLElement)) return null;
        const lovEl = wrap.querySelector('[data-imm-province-mode="lov"]');
        const textEl = wrap.querySelector('[data-imm-province-mode="text"]');
        if (lovEl instanceof HTMLSelectElement && !lovEl.disabled && !lovEl.hidden) return lovEl;
        if (textEl instanceof HTMLInputElement && !textEl.disabled && !textEl.hidden) return textEl;
        return textEl || lovEl;
    }

    function syncProvinceWrap(wrap) {
        if (!(wrap instanceof HTMLElement)) return;
        const name = wrap.dataset.immName || '';
        const lovEl = wrap.querySelector('[data-imm-province-mode="lov"]');
        const textEl = wrap.querySelector('[data-imm-province-mode="text"]');
        if (!(lovEl instanceof HTMLSelectElement) || !(textEl instanceof HTMLInputElement)) return;

        const branchHidden = wrap.closest('[data-imm-show][hidden]');
        let countryCode = '';
        if (wrap.dataset.immCountryRef) {
            countryCode = document.getElementById(wrap.dataset.immCountryRef)?.value || '';
        } else if (wrap.dataset.immProvinceForJob) {
            const card = wrap.closest('.imm-job-card');
            countryCode = card?.querySelector(`[data-job="${wrap.dataset.immProvinceForJob}"]`)?.value || '';
        }

        const options = provinceOptionsForCountry(countryCode);
        const useLov = Array.isArray(options);
        const prev = (!lovEl.disabled && !lovEl.hidden ? lovEl.value : '') ||
            (!textEl.disabled && !textEl.hidden ? textEl.value : '') ||
            textEl.value ||
            lovEl.value ||
            '';

        if (name) {
            lovEl.removeAttribute('name');
            textEl.removeAttribute('name');
            if (wrap.dataset.immProvinceForJob) {
                // job fields use data-job, not name
            }
        }

        if (branchHidden) {
            lovEl.hidden = true;
            lovEl.disabled = true;
            textEl.hidden = true;
            textEl.disabled = true;
            return;
        }

        if (useLov) {
            fillSelectOptions(lovEl, options, {
                placeholder: 'Select…',
                allowEmpty: true,
                emptyLabel: 'Select…',
                selected: prev,
            });
            lovEl.hidden = false;
            lovEl.disabled = false;
            textEl.hidden = true;
            textEl.disabled = true;
            textEl.value = '';
            if (name) lovEl.name = name;
            if (prev && [...lovEl.options].some((o) => o.value === prev)) lovEl.value = prev;
        } else {
            lovEl.hidden = true;
            lovEl.disabled = true;
            lovEl.value = '';
            textEl.hidden = false;
            textEl.disabled = false;
            if (name) textEl.name = name;
            if (prev && !options) textEl.value = prev;
        }
    }

    function syncProvinces() {
        form.querySelectorAll('[data-imm-province-wrap]').forEach(syncProvinceWrap);
    }

    function populateDialCodes() {
        const select = document.getElementById('imm-phoneCountryCode');
        if (!(select instanceof HTMLSelectElement)) return;
        const codes = Array.isArray(window.IMM1294_DIAL_CODES) ? window.IMM1294_DIAL_CODES : [];
        const current = select.value || '33';
        select.innerHTML = '';
        for (const row of codes) {
            const opt = document.createElement('option');
            opt.value = row.code;
            opt.textContent = `+${row.code} · ${row.label.replace(/\s*\(\+\d+\)\s*$/, '')}`;
            select.appendChild(opt);
        }
        if (![...select.options].some((o) => o.value === current)) {
            const opt = document.createElement('option');
            opt.value = current;
            opt.textContent = `+${current}`;
            select.appendChild(opt);
        }
        select.value = current;
    }

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
            // Province LOV/text pair is owned by syncProvinces()
            if (input.hasAttribute('data-imm-province-mode')) return;
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

        const preferred = form.querySelector('#imm-preferredLang');
        if (preferred instanceof HTMLSelectElement) {
            const both = fieldValue('ableToCommunicate') === 'Both';
            preferred.closest('.opp-field')?.toggleAttribute('hidden', !both);
            preferred.required = both;
            preferred.disabled = !both;
        }

        syncJobChrome();
        syncPcorChrome();
        syncProvinces();
    }

    function jobCards() {
        return jobList ? [...jobList.querySelectorAll('.imm-job-card')] : [];
    }

    function pcorCards() {
        return pcorList ? [...pcorList.querySelectorAll('[data-pcor-slot]')] : [];
    }

    function syncPcorChrome() {
        pcorCards().forEach((card, index) => {
            const label = card.querySelector('.imm-sortable-item__label');
            if (label) {
                label.textContent = String(index + 1);
                label.title = index === 0 ? 'Required when Yes' : 'Optional';
            }
            const status = card.querySelector('[data-pcor="status"]');
            const otherWrap = card.querySelector('.imm-pcor-other');
            const otherInput = card.querySelector('[data-pcor="other"]');
            const showOther = status instanceof HTMLSelectElement && status.value === '06';
            if (otherWrap instanceof HTMLElement) otherWrap.hidden = !showOther;
            if (otherInput instanceof HTMLInputElement) {
                otherInput.required = showOther && fieldValue('previousCor') === 'Y';
                otherInput.disabled = !showOther;
            }
            const requiredAttrs = index === 0 && fieldValue('previousCor') === 'Y';
            card.querySelectorAll('[data-pcor="country"], [data-pcor="status"], [data-pcor="from"], [data-pcor="to"]').forEach((el) => {
                if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
                    if (index === 0) el.required = requiredAttrs;
                }
            });
        });
    }

    function enableSortable(listEl, itemSelector) {
        if (!listEl) return;
        listEl.querySelectorAll(itemSelector).forEach((card) => {
            if (!(card instanceof HTMLElement) || card.dataset.sortBound === '1') return;
            card.dataset.sortBound = '1';
            card.addEventListener('dragstart', (event) => {
                listEl._immDrag = card;
                dragItem = card;
                card.classList.add('imm-sortable-item--dragging');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', 'sort');
                }
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('imm-sortable-item--dragging');
                listEl.querySelectorAll('.imm-sortable-item--over').forEach((el) => {
                    el.classList.remove('imm-sortable-item--over');
                });
                listEl._immDrag = null;
                dragItem = null;
                syncBranches();
            });
            card.addEventListener('dragover', (event) => {
                event.preventDefault();
                const active = listEl._immDrag;
                if (!(active instanceof HTMLElement) || active === card) return;
                card.classList.add('imm-sortable-item--over');
                const items = [...listEl.querySelectorAll(itemSelector)];
                const dragIndex = items.indexOf(active);
                const overIndex = items.indexOf(card);
                if (dragIndex < 0 || overIndex < 0) return;
                if (dragIndex < overIndex) card.after(active);
                else card.before(active);
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('imm-sortable-item--over');
            });
            card.addEventListener('drop', (event) => {
                event.preventDefault();
                card.classList.remove('imm-sortable-item--over');
                syncBranches();
            });
            card.querySelectorAll('input, select, textarea, button:not(.imm-drag-handle)').forEach((el) => {
                el.addEventListener('mousedown', () => {
                    card.draggable = false;
                });
                el.addEventListener('mouseup', () => {
                    card.draggable = true;
                });
            });
            card.querySelector('.imm-drag-handle')?.addEventListener('mousedown', () => {
                card.draggable = true;
            });
        });
    }

    function collectPcorRows() {
        return pcorCards().map((card) => {
            const val = (key) => {
                const el = card.querySelector(`[data-pcor="${key}"]`);
                if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
                    return el.value.trim();
                }
                return '';
            };
            const from = splitDate(val('from'));
            const to = splitDate(val('to'));
            return {
                country: val('country'),
                status: val('status'),
                other: val('other'),
                fromYear: from.year,
                fromMonth: from.month,
                fromDay: from.day,
                toYear: to.year,
                toMonth: to.month,
                toDay: to.day,
            };
        });
    }

    function syncJobChrome() {
        const cards = jobCards();
        cards.forEach((card, index) => {
            const label = card.querySelector('.imm-sortable-item__label');
            if (label) {
                label.textContent = String(index + 1);
                label.title = index === 0 ? 'Most recent on PDF' : `Job ${index + 1}`;
            }
            const removeBtn = card.querySelector('.imm-remove-job');
            if (removeBtn instanceof HTMLButtonElement) {
                removeBtn.hidden = cards.length <= 1;
            }
        });
        const addBtn = document.getElementById('imm-add-job');
        if (addBtn instanceof HTMLButtonElement) {
            addBtn.hidden = cards.length >= MAX_JOBS;
        }
    }

    function addJob(defaults = {}) {
        if (!jobList || !jobTemplate || jobCards().length >= MAX_JOBS) return;
        const node = jobTemplate.content.firstElementChild.cloneNode(true);
        if (!(node instanceof HTMLElement)) return;

        const set = (key, value) => {
            if (value == null) return;
            if (key === 'provinceState') {
                const wrap = node.querySelector('[data-imm-province-wrap]');
                const text = wrap?.querySelector('[data-imm-province-mode="text"]');
                const lovEl = wrap?.querySelector('[data-imm-province-mode="lov"]');
                if (text instanceof HTMLInputElement) text.value = value;
                if (lovEl instanceof HTMLSelectElement) lovEl.dataset.immDefault = value;
                return;
            }
            const input = node.querySelector(`[data-job="${key}"]`);
            if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
                if (input instanceof HTMLSelectElement && input.hasAttribute('data-imm-lov')) {
                    input.dataset.immDefault = value;
                }
                input.value = value;
            }
        };
        const countrySelect = node.querySelector('[data-job="country"]');
        if (countrySelect instanceof HTMLSelectElement) {
            countrySelect.dataset.immDefault = defaults.country ?? '022';
        }
        populateLovSelects(node);
        set('occupation', defaults.occupation ?? '');
        set('employer', defaults.employer ?? '');
        set('city', defaults.city ?? '');
        set('provinceState', defaults.provinceState ?? '');
        set('from', defaults.from ?? '');
        set('to', defaults.to ?? '');
        if (countrySelect instanceof HTMLSelectElement) {
            countrySelect.value = defaults.country ?? '022';
        }

        bindJobCard(node);
        jobList.appendChild(node);
        syncJobChrome();
        syncProvinceWrap(node.querySelector('[data-imm-province-wrap]'));
    }

    function bindJobCard(card) {
        card.querySelector('.imm-remove-job')?.addEventListener('click', () => {
            if (jobCards().length <= 1) return;
            card.remove();
            syncJobChrome();
        });
        enableSortable(jobList, '.imm-job-card');
    }

    function collectJobs() {
        return jobCards().map((card) => {
            const val = (key) => {
                if (key === 'provinceState') {
                    const active = activeProvinceControl(card.querySelector('[data-imm-province-wrap]'));
                    return active ? String(active.value || '').trim() : '';
                }
                const input = card.querySelector(`[data-job="${key}"]`);
                if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
                    return input.value.trim();
                }
                return '';
            };
            const from = splitMonth(val('from'));
            const to = splitMonth(val('to'));
            return {
                occupation: val('occupation'),
                employer: val('employer'),
                city: val('city'),
                country: val('country'),
                provinceState: val('provinceState'),
                fromYear: from.year,
                fromMonth: from.month,
                // Omit empty end dates entirely — never send "00"
                ...(to.year && to.month
                    ? { toYear: to.year, toMonth: to.month }
                    : {}),
            };
        });
    }

    function splitDate(value) {
        const [y = '', m = '', d = ''] = String(value || '').split('-');
        return { year: y, month: m, day: d };
    }

    function splitMonth(value) {
        const raw = String(value || '').trim();
        if (!raw) return { year: '', month: '' };
        const [y = '', m = ''] = raw.split('-');
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
        const marriage = splitDate(data.get('marriageDate'));
        const corFrom = splitDate(data.get('corFrom'));
        const corTo = splitDate(data.get('corTo'));
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
        const jobs = collectJobs();
        const first = jobs[0] || {};
        const pcor = collectPcorRows();
        const pcor1 = pcor[0] || {};
        const pcor2 = pcor[1] || {};

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
            // Flat first-job fields kept for server fallback + required[] checks
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
        if (!payload.jobs?.length) return 'Add at least one employment / activity row.';
        for (let i = 0; i < payload.jobs.length; i += 1) {
            const job = payload.jobs[i];
            if (!job.occupation || !job.employer || !job.fromYear || !job.fromMonth) {
                return `Job ${i + 1}: fill occupation, employer, and start date.`;
            }
            if ((job.toYear && !job.toMonth) || (!job.toYear && job.toMonth)) {
                return `Job ${i + 1}: enter both end year and month, or leave To blank if current.`;
            }
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
            if (jobList) {
                jobList.innerHTML = '';
                addJob({
                    occupation: 'Student',
                    employer: 'Universite Lyon',
                    city: 'Lyon',
                    country: '022',
                    from: '2022-09',
                });
            }
            populateLovSelects();
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
        addJob({
            city: fieldValue('city') || 'Paris',
            country: fieldValue('currentCountry') || '022',
        });
    });

    populateDialCodes();
    populateLovSelects();

    // Seed sample job (current activity — no end date)
    addJob({
        occupation: 'Student',
        employer: 'Universite Lyon',
        city: 'Lyon',
        country: '022',
        from: '2022-09',
    });
    enableSortable(pcorList, '[data-pcor-slot]');

    syncBranches();

    if (captchaRequired) {
        updateSubmitState(false);
        renderTurnstile();
    } else {
        updateSubmitState(true);
    }
})();

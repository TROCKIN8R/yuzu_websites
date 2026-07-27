/**
 * Shared IMM form dynamics: show/hide branches, province LOV/text,
 * dial codes, employment rows, previous countries of residence.
 *
 * Usage:
 *   const dyn = ImmDynamicFields.init({
 *     form: document.getElementById('spkForm'),
 *     jobListId: 'spk-job-list',
 *     jobTemplateId: 'spk-job-template',
 *     addJobBtnId: 'spk-add-job',
 *     pcorListId: 'spk-pcor-list',
 *     pcorTemplateId: 'spk-pcor-template',
 *     addPcorBtnId: 'spk-add-pcor',
 *     phoneCountryCodeId: 'spk-phoneCountryCode',
 *     preferredLangId: 'spk-preferredLang',
 *     populateLovSelects: (root) => { ... },
 *   });
 *   dyn.syncBranches();
 *   form.addEventListener('change', dyn.syncBranches);
 */
(function initImmDynamicFields(global) {
    const MAX_JOBS = 3;
    const MAX_PCOR = 2;

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

    function init(options = {}) {
        const form = options.form;
        if (!(form instanceof HTMLFormElement)) {
            throw new Error('ImmDynamicFields.init requires options.form');
        }

        const jobList = document.getElementById(options.jobListId || 'imm-job-list');
        const jobTemplate = document.getElementById(options.jobTemplateId || 'imm-job-template');
        const pcorList = document.getElementById(options.pcorListId || 'imm-pcor-list');
        const pcorTemplate = document.getElementById(options.pcorTemplateId || 'imm-pcor-template');
        const preferredLangId = options.preferredLangId || 'imm-preferredLang';
        const phoneCountryCodeId = options.phoneCountryCodeId || 'imm-phoneCountryCode';
        const addJobBtnId = options.addJobBtnId || 'imm-add-job';
        const addPcorBtnId = options.addPcorBtnId || 'imm-add-pcor';
        const populateLovSelects = typeof options.populateLovSelects === 'function'
            ? options.populateLovSelects
            : () => {};

        let dragItem = null;

        function lov() {
            return global.IMM1294_LOV || {};
        }

        function fillSelectOptions(select, rows, {
            selected = '',
            placeholder = 'Select…',
            allowEmpty = false,
            emptyLabel = placeholder,
        } = {}) {
            if (!(select instanceof HTMLSelectElement)) return;
            const keep = selected || select.dataset.immDefault || select.value || '';
            select.innerHTML = '';
            if (allowEmpty || placeholder) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = emptyLabel || placeholder;
                if (!keep) opt.selected = true;
                if (!allowEmpty) opt.disabled = true;
                select.appendChild(opt);
            }
            for (const row of rows || []) {
                const opt = document.createElement('option');
                const code = row.value ?? row.code ?? '';
                opt.value = code;
                opt.textContent = row.label || code;
                select.appendChild(opt);
            }
            if (keep && [...select.options].some((o) => o.value === keep)) {
                select.value = keep;
            }
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
            const select = document.getElementById(phoneCountryCodeId);
            if (!(select instanceof HTMLSelectElement)) return;
            const codes = Array.isArray(global.IMM1294_DIAL_CODES) ? global.IMM1294_DIAL_CODES : [];
            const current = select.value || select.dataset.immDefault || '33';
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

        function jobCards() {
            return jobList ? [...jobList.querySelectorAll('.imm-job-card')] : [];
        }

        function pcorCards() {
            return pcorList ? [...pcorList.querySelectorAll('[data-pcor-slot]')] : [];
        }

        function syncPcorChrome() {
            if (fieldValue('previousCor') === 'Y' && pcorCards().length === 0) {
                addPcor();
                return;
            }
            const cards = pcorCards();
            cards.forEach((card, index) => {
                const label = card.querySelector('.imm-sortable-item__label');
                if (label) {
                    label.textContent = String(index + 1);
                    label.title = index === 0 ? 'First on PDF' : `Country ${index + 1}`;
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
                const requiredAttrs = fieldValue('previousCor') === 'Y';
                card.querySelectorAll('[data-pcor="country"], [data-pcor="status"], [data-pcor="from"], [data-pcor="to"]').forEach((el) => {
                    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
                        el.required = requiredAttrs;
                    }
                });
                const removeBtn = card.querySelector('.imm-remove-pcor');
                if (removeBtn instanceof HTMLButtonElement) {
                    removeBtn.hidden = cards.length <= 1;
                }
            });
            const addBtn = document.getElementById(addPcorBtnId);
            if (addBtn instanceof HTMLButtonElement) {
                addBtn.hidden = fieldValue('previousCor') !== 'Y' || cards.length >= MAX_PCOR;
            }
        }

        function bindPcorCard(card) {
            card.querySelector('.imm-remove-pcor')?.addEventListener('click', () => {
                if (pcorCards().length <= 1) return;
                card.remove();
                syncPcorChrome();
            });
            enableSortable(pcorList, '[data-pcor-slot]');
        }

        function addPcor(defaults = {}) {
            if (!pcorList || !pcorTemplate || pcorCards().length >= MAX_PCOR) return;
            const node = pcorTemplate.content.firstElementChild.cloneNode(true);
            if (!(node instanceof HTMLElement)) return;

            const set = (key, value) => {
                if (value == null || value === '') return;
                const input = node.querySelector(`[data-pcor="${key}"]`);
                if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
                    if (input instanceof HTMLSelectElement && input.hasAttribute('data-imm-lov')) {
                        input.dataset.immDefault = value;
                    }
                    input.value = value;
                }
            };

            const countrySelect = node.querySelector('[data-pcor="country"]');
            if (countrySelect instanceof HTMLSelectElement && defaults.country) {
                countrySelect.dataset.immDefault = defaults.country;
            }
            populateLovSelects(node);
            set('country', defaults.country ?? '');
            set('status', defaults.status ?? '');
            set('other', defaults.other ?? '');
            set('from', defaults.from ?? '');
            set('to', defaults.to ?? '');
            if (countrySelect instanceof HTMLSelectElement && defaults.country) {
                countrySelect.value = defaults.country;
            }

            bindPcorCard(node);
            pcorList.appendChild(node);
            syncPcorChrome();
        }

        function clearPcor() {
            if (pcorList) pcorList.innerHTML = '';
            const addBtn = document.getElementById(addPcorBtnId);
            if (addBtn instanceof HTMLButtonElement) {
                addBtn.hidden = fieldValue('previousCor') !== 'Y';
            }
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
            const addBtn = document.getElementById(addJobBtnId);
            if (addBtn instanceof HTMLButtonElement) {
                addBtn.hidden = cards.length >= MAX_JOBS;
            }
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

        function bindJobCard(card) {
            card.querySelector('.imm-remove-job')?.addEventListener('click', () => {
                if (jobCards().length <= 1) return;
                card.remove();
                syncJobChrome();
            });
            enableSortable(jobList, '.imm-job-card');
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
                    ...(to.year && to.month
                        ? { toYear: to.year, toMonth: to.month }
                        : {}),
                };
            });
        }

        function clearJobs() {
            if (jobList) jobList.innerHTML = '';
            syncJobChrome();
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

            const preferredEl = form.elements.namedItem('preferredLang');
            if (preferredEl) {
                const both = fieldValue('ableToCommunicate') === 'Both';
                const wrap = (preferredEl instanceof RadioNodeList
                    ? preferredEl[0]
                    : preferredEl)?.closest?.('.opp-field');
                wrap?.toggleAttribute('hidden', !both);
                const radios = preferredEl instanceof RadioNodeList
                    ? [...preferredEl]
                    : [preferredEl];
                radios.forEach((radio) => {
                    if (!(radio instanceof HTMLInputElement)) return;
                    radio.required = both;
                    radio.disabled = !both;
                });
                if (preferredEl instanceof HTMLSelectElement) {
                    preferredEl.required = both;
                    preferredEl.disabled = !both;
                }
            }

            syncJobChrome();
            syncPcorChrome();
            syncProvinces();
        }

        document.getElementById(addJobBtnId)?.addEventListener('click', () => {
            addJob({
                city: fieldValue('city') || 'Paris',
                country: fieldValue('currentCountry') || fieldValue('country') || '022',
            });
            syncBranches();
        });

        document.getElementById(addPcorBtnId)?.addEventListener('click', () => {
            addPcor();
            syncBranches();
        });

        enableSortable(pcorList, '[data-pcor-slot]');

        return {
            syncBranches,
            syncProvinces,
            populateDialCodes,
            addJob,
            clearJobs,
            collectJobs,
            addPcor,
            clearPcor,
            collectPcorRows,
            fieldValue,
            activeProvinceControl,
            splitDate,
            splitMonth,
            MAX_JOBS,
            MAX_PCOR,
        };
    }

    global.ImmDynamicFields = { init, splitDate, splitMonth };
})(typeof window !== 'undefined' ? window : globalThis);

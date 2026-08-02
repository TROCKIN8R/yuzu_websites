/**
 * UI locale for permit kits / immigration hub (EN / FR / ES).
 * IRCC PDF language (e/f) is a separate form control — do not conflate.
 *
 * Locale comes from <html lang> (fr / fr-CA → fr, es → es, else en).
 * Path /fr/… or /es/… should set lang on the page.
 *
 * Language switcher changes locale in-place (no navigation) so wizard state
 * is preserved. English source strings are remembered for re-apply.
 */
(function initPermitKitI18n(global) {
    const FR = global.__PERMIT_KIT_I18N_FR__ || null;
    const ES = global.__PERMIT_KIT_I18N_ES__ || null;
    const textOriginals = new WeakMap();
    let titleOriginal = null;

    function normalizeLocale(raw) {
        const v = String(raw || '').toLowerCase();
        if (v.startsWith('fr')) return 'fr';
        if (v.startsWith('es')) return 'es';
        return 'en';
    }

    function detectLocale() {
        const htmlLang = document.documentElement && document.documentElement.lang;
        if (htmlLang) return normalizeLocale(htmlLang);
        const path = String(location.pathname || '');
        if (path.includes('/fr/')) return 'fr';
        if (path.includes('/es/')) return 'es';
        return 'en';
    }

    function isUiKey(key) {
        if (!key) return false;
        if (FR && Object.prototype.hasOwnProperty.call(FR, key)) return true;
        if (ES && Object.prototype.hasOwnProperty.call(ES, key)) return true;
        return false;
    }

    let locale = 'en';
    let dict = {};

    function setLocale(next) {
        locale = normalizeLocale(next);
        dict = locale === 'fr' ? (FR || {}) : locale === 'es' ? (ES || {}) : {};
        return locale;
    }

    function t(key, vars) {
        const source = String(key ?? '');
        let out = (locale !== 'en' && dict && dict[source]) || source;
        if (vars && typeof vars === 'object') {
            out = out.replace(/\{(\w+)\}/g, (_, name) =>
                vars[name] != null ? String(vars[name]) : `{${name}}`
            );
        }
        return out;
    }

    function translated(key) {
        if (locale === 'en') return key;
        return (dict && dict[key]) || key;
    }

    function translateOption(el) {
        let key = el.getAttribute('data-i18n-src');
        if (!key) {
            key = el.textContent.replace(/\s+/g, ' ').trim();
            if (!key || !isUiKey(key)) return;
            el.setAttribute('data-i18n-src', key);
            if (el.getAttribute('value') === null) {
                el.setAttribute('value', key);
                el.value = key;
            }
        }
        el.textContent = translated(key);
    }

    function translateTextNode(node) {
        const raw = node.nodeValue;
        if (!raw) return;
        let key = textOriginals.get(node);
        if (key == null) {
            const trimmed = raw.replace(/\s+/g, ' ').trim();
            if (!trimmed || !isUiKey(trimmed)) return;
            textOriginals.set(node, trimmed);
            key = trimmed;
        }
        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        node.nodeValue = leading + translated(key) + trailing;
    }

    function walk(node) {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node);
            return;
        }
        // Document / DocumentFragment: recurse into children (apply(document) is common).
        if (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            const children = Array.from(node.childNodes);
            for (const child of children) walk(child);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'TEXTAREA' || tag === 'CODE') {
            return;
        }
        if (node.hasAttribute('data-i18n-skip')) return;

        if (tag === 'OPTION') {
            translateOption(node);
            return;
        }

        for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
            if (!node.hasAttribute(attr)) continue;
            const srcAttr = `data-i18n-${attr}`;
            let key = node.getAttribute(srcAttr);
            if (!key) {
                const v = node.getAttribute(attr);
                if (!v || !isUiKey(v)) continue;
                node.setAttribute(srcAttr, v);
                key = v;
            }
            node.setAttribute(attr, translated(key));
        }

        const children = Array.from(node.childNodes);
        for (const child of children) walk(child);
    }

    function applyTitle() {
        if (!document.title) return;
        if (!titleOriginal) {
            titleOriginal = document.title;
            if (!isUiKey(titleOriginal)) {
                for (const d of [FR, ES]) {
                    if (!d) continue;
                    for (const [en, tr] of Object.entries(d)) {
                        if (tr === titleOriginal) {
                            titleOriginal = en;
                            break;
                        }
                    }
                }
            }
        }
        document.title = translated(titleOriginal);
    }

    function apply(root = document.body) {
        walk(root || document.body);
        applyTitle();
    }

    function lovLabel(row) {
        if (!row) return '';
        if (locale === 'fr' && row.fr) return row.fr;
        return row.label || row.fr || '';
    }

    /** Build sibling EN/FR/ES URLs for the current demo page. */
    function localeUrls() {
        const path = location.pathname;
        const file = path.split('/').pop() || 'canadian-immigration.html';
        // /demos/x.html | /fr/demos/x.html | /es/demos/x.html
        const base = path.includes('/fr/') || path.includes('/es/')
            ? path.replace(/\/(fr|es)\/demos\/[^/]+$/, '')
            : path.replace(/\/demos\/[^/]+$/, '');
        const root = base || '';
        return {
            en: `${root}/demos/${file}`,
            fr: `${root}/fr/demos/${file}`,
            es: `${root}/es/demos/${file}`,
        };
    }

    function syncUrlForLocale(code) {
        const urls = localeUrls();
        const path = urls[code];
        if (!path) return;
        const next = path + location.search + location.hash;
        const current = location.pathname + location.search + location.hash;
        if (current !== next) {
            history.replaceState(null, '', next);
        }
    }

    function updateLangSwitchUi() {
        document.querySelectorAll('.lang-switch').forEach((nav) => {
            nav.setAttribute('aria-label', t('Language'));
            nav.querySelectorAll('a[hreflang], a[lang]').forEach((a) => {
                const code = normalizeLocale(a.getAttribute('hreflang') || a.getAttribute('lang'));
                a.classList.toggle('active', code === locale);
            });
        });
    }

    function switchLocale(next, opts = {}) {
        const code = normalizeLocale(next);
        if (code === locale && opts.force !== true) {
            updateLangSwitchUi();
            return locale;
        }
        setLocale(code);
        if (document.documentElement) {
            document.documentElement.lang = code === 'fr' ? 'fr-CA' : code;
        }
        apply(document);
        updateLangSwitchUi();
        if (opts.syncUrl !== false) syncUrlForLocale(code);
        document.dispatchEvent(new CustomEvent('permitkit:localechange', { detail: { locale: code } }));
        return locale;
    }

    function bindLangSwitch(root = document) {
        const scopes = root.querySelectorAll ? root.querySelectorAll('.lang-switch') : [];
        const list = scopes.length ? scopes : [];
        list.forEach((nav) => {
            if (nav.dataset.i18nBound === '1') return;
            nav.dataset.i18nBound = '1';
            nav.addEventListener('click', (event) => {
                const a = event.target.closest('a[hreflang], a[lang]');
                if (!a || !nav.contains(a)) return;
                event.preventDefault();
                const code = normalizeLocale(a.getAttribute('hreflang') || a.getAttribute('lang'));
                switchLocale(code);
            });
        });
    }

    function mountLangSwitch(container) {
        if (!container) return;
        const urls = localeUrls();
        const active = locale;
        const wrap = document.createElement('div');
        wrap.className = 'lang-switch hidden sm:flex';
        wrap.setAttribute('role', 'navigation');
        wrap.setAttribute('aria-label', t('Language'));
        wrap.innerHTML = [
            ['en', 'EN', urls.en],
            ['fr', 'FR', urls.fr],
            ['es', 'ES', urls.es],
        ].map(([code, label, href]) => {
            const cls = code === active ? 'lang-switch-btn active' : 'lang-switch-btn';
            const hreflang = code === 'fr' ? 'fr-CA' : code;
            return `<a href="${href}" class="${cls}" hreflang="${hreflang}" lang="${hreflang}">${label}</a>`;
        }).join('');
        container.prepend(wrap);
        bindLangSwitch(container);
    }

    setLocale(detectLocale());
    bindLangSwitch(document);

    global.PermitKitI18n = {
        t,
        apply,
        setLocale,
        switchLocale,
        detectLocale,
        getLocale: () => locale,
        lovLabel,
        localeUrls,
        mountLangSwitch,
        bindLangSwitch,
    };
})(window);

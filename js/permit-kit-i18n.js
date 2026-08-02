/**
 * UI locale for permit kits / immigration hub (EN / FR / ES).
 * IRCC PDF language (e/f) is a separate form control — do not conflate.
 *
 * Locale comes from <html lang> (fr / fr-CA → fr, es → es, else en).
 * Path /fr/… or /es/… should set lang on the page.
 */
(function initPermitKitI18n(global) {
    const FR = global.__PERMIT_KIT_I18N_FR__ || null;
    const ES = global.__PERMIT_KIT_I18N_ES__ || null;

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

    let locale = 'en';
    let dict = {};

    function setLocale(next) {
        locale = normalizeLocale(next);
        dict = locale === 'fr' ? (FR || {}) : locale === 'es' ? (ES || {}) : {};
        return locale;
    }

    function t(key, vars) {
        const source = String(key ?? '');
        let out = (dict && dict[source]) || source;
        if (vars && typeof vars === 'object') {
            out = out.replace(/\{(\w+)\}/g, (_, name) =>
                vars[name] != null ? String(vars[name]) : `{${name}}`
            );
        }
        return out;
    }

    function translateOption(el) {
        const key = el.textContent.replace(/\s+/g, ' ').trim();
        if (!key || !dict[key]) return;
        const explicit = el.getAttribute('value');
        const preserved = explicit !== null ? explicit : key;
        el.textContent = dict[key];
        el.setAttribute('value', preserved);
        el.value = preserved;
    }

    function translateTextNode(node) {
        const raw = node.nodeValue;
        if (!raw) return;
        const trimmed = raw.replace(/\s+/g, ' ').trim();
        if (!trimmed || !dict[trimmed]) return;
        // Preserve surrounding whitespace from the original node value.
        const leading = raw.match(/^\s*/)?.[0] || '';
        const trailing = raw.match(/\s*$/)?.[0] || '';
        node.nodeValue = leading + dict[trimmed] + trailing;
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
            const v = node.getAttribute(attr);
            if (v && dict[v]) node.setAttribute(attr, dict[v]);
        }

        const children = Array.from(node.childNodes);
        for (const child of children) walk(child);
    }

    function apply(root = document.body) {
        if (!dict || !Object.keys(dict).length) return;
        walk(root || document.body);
        if (document.title && dict[document.title]) {
            document.title = dict[document.title];
        }
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
        // On GitHub pages project site, base may include /yuzu_websites
        const root = base || '';
        return {
            en: `${root}/demos/${file}`,
            fr: `${root}/fr/demos/${file}`,
            es: `${root}/es/demos/${file}`,
        };
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
    }

    setLocale(detectLocale());

    global.PermitKitI18n = {
        t,
        apply,
        setLocale,
        detectLocale,
        getLocale: () => locale,
        lovLabel,
        localeUrls,
        mountLangSwitch,
    };
})(window);

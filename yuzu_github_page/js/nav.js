(function initMegaMenu() {
    const wrap = document.getElementById('servicesNavWrap');
    const btn = document.getElementById('servicesNavBtn');
    const menu = document.getElementById('servicesMegaMenu');
    if (!wrap || !btn || !menu) return;

    const keepServicesActive = document.body.classList.contains('nav-on-services');

    function open() {
        btn.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        menu.classList.add('open');
    }
    function close() {
        if (!keepServicesActive) btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
        menu.classList.remove('open');
    }

    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', close);
    wrap.addEventListener('focusin', open);
    wrap.addEventListener('focusout', (e) => {
        if (!wrap.contains(e.relatedTarget)) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
})();

(function syncNavLayout() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const root = document.documentElement;

    const update = () => {
        const styles = getComputedStyle(nav);
        const stickyTop = parseFloat(styles.top) || 0;
        const marginTop = parseFloat(styles.marginTop) || 0;
        const height = nav.offsetHeight;
        root.style.setProperty('--nav-h-sticky', Math.round(height + stickyTop) + 'px');
        root.style.setProperty('--nav-h', Math.round(height + marginTop) + 'px');
    };

    update();
    window.addEventListener('load', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    if (window.ResizeObserver) new ResizeObserver(update).observe(nav);
})();

(function initMobileNav() {
    const hamburger = document.getElementById('navHamburger');
    const panel = document.getElementById('mobileNavPanel');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const servicesToggle = document.getElementById('mobileServicesToggle');
    const servicesSub = document.getElementById('mobileServicesSub');
    if (!hamburger || !panel) return;

    function open() {
        hamburger.classList.add('open');
        hamburger.setAttribute('aria-expanded', 'true');
        hamburger.setAttribute('aria-label', 'Close menu');
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
        panel.classList.contains('open') ? close() : open();
    });

    backdrop?.addEventListener('click', close);

    panel.querySelectorAll('a[href]').forEach((link) => {
        link.addEventListener('click', close);
    });

    servicesToggle?.addEventListener('click', () => {
        const expanded = servicesToggle.getAttribute('aria-expanded') === 'true';
        servicesToggle.setAttribute('aria-expanded', String(!expanded));
        servicesSub?.classList.toggle('open', !expanded);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) close();
    });
})();

(function initNavAnchorScroll() {
    const ANCHOR_KEY = 'yuzu:anchor';
    const menuSelector = '#mainNav a[href*="#"], #mobileNavPanel a[href*="#"]';

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function getScrollOffset() {
        const styles = getComputedStyle(document.documentElement);
        const sticky = parseFloat(styles.getPropertyValue('--nav-h-sticky'));
        const fallback = parseFloat(styles.getPropertyValue('--nav-h')) || 96;
        const gap = parseFloat(styles.getPropertyValue('--nav-scroll-gap')) || 8;
        const navOffset = Number.isFinite(sticky) && sticky > 0 ? sticky : fallback;
        return navOffset + gap;
    }

    function scrollToAnchor(target, { updateHash = true } = {}) {
        if (!target) return;
        const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
        const top = target.getBoundingClientRect().top + window.scrollY - getScrollOffset();
        window.scrollTo({ top: Math.max(0, top), behavior });
        if (updateHash && target.id) {
            history.pushState(null, '', `#${target.id}`);
        }
    }

    function closeMobileNavIfOpen() {
        const panel = document.getElementById('mobileNavPanel');
        const hamburger = document.getElementById('navHamburger');
        if (!panel?.classList.contains('open')) return;
        hamburger?.classList.remove('open');
        hamburger?.setAttribute('aria-expanded', 'false');
        hamburger?.setAttribute('aria-label', 'Open menu');
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function parseAnchorLink(href) {
        if (!href || !href.includes('#')) return null;
        try {
            const url = new URL(href, window.location.href);
            const id = decodeURIComponent(url.hash.slice(1));
            if (!id) return null;
            return { url, id };
        } catch {
            return null;
        }
    }

    function isSamePage(url) {
        return url.pathname === window.location.pathname;
    }

    function handleAnchorClick(event) {
        const href = event.currentTarget.getAttribute('href') || '';
        const parsed = parseAnchorLink(href);
        if (!parsed) return;

        const { url, id } = parsed;

        if (isSamePage(url)) {
            const target = document.getElementById(id);
            if (!target) return;
            event.preventDefault();
            scrollToAnchor(target);
            closeMobileNavIfOpen();
            return;
        }

        event.preventDefault();
        sessionStorage.setItem(ANCHOR_KEY, id);
        window.location.assign(`${url.pathname}${url.search}`);
    }

    function runPendingAnchorScroll() {
        const id = sessionStorage.getItem(ANCHOR_KEY) || (location.hash ? decodeURIComponent(location.hash.slice(1)) : '');
        sessionStorage.removeItem(ANCHOR_KEY);
        if (!id) return;

        const target = document.getElementById(id);
        if (!target) return;

        if (location.hash !== `#${id}`) {
            history.replaceState(null, '', `#${id}`);
        }

        scrollToAnchor(target, { updateHash: false });
    }

    if (location.hash) {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
    }

    document.querySelectorAll(menuSelector).forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (href === '#' || href.endsWith('#')) return;
        link.addEventListener('click', handleAnchorClick);
    });

    window.addEventListener('load', () => {
        requestAnimationFrame(runPendingAnchorScroll);
    });
})();

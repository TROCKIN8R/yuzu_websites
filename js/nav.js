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

(function syncNavHeight() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const setVar = () => {
        const marginTop = parseFloat(getComputedStyle(nav).marginTop) || 0;
        document.documentElement.style.setProperty('--nav-h', Math.round(nav.offsetHeight + marginTop) + 'px');
    };
    setVar();
    window.addEventListener('load', setVar);
    window.addEventListener('resize', setVar);
    window.addEventListener('orientationchange', setVar);
    if (window.ResizeObserver) new ResizeObserver(setVar).observe(nav);
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

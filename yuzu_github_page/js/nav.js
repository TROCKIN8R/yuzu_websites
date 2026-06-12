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

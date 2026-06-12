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
    function toggle() {
        menu.classList.contains('open') ? close() : open();
    }

    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', close);
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
})();

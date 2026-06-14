(function initServicePanelPlacement() {
    const studio = document.querySelector('.services-studio');
    const panel = document.getElementById('serviceDetailView');
    if (!studio || !panel) return;

    const mq = window.matchMedia('(max-width: 899px)');
    let mobileOpenKey = null;

    function isMobile() {
        return mq.matches;
    }

    function hideMobilePanel() {
        mobileOpenKey = null;

        studio.querySelectorAll('.service-card').forEach((card) => {
            card.classList.remove('active');
            card.setAttribute('aria-selected', 'false');
            card.setAttribute('aria-expanded', 'false');
        });

        studio.querySelectorAll('.service-detail-anchor').forEach((slot) => {
            slot.hidden = true;
            slot.setAttribute('aria-hidden', 'true');
        });

        panel.hidden = true;
        panel.setAttribute('aria-hidden', 'true');

        if (panel.parentElement !== studio) studio.appendChild(panel);
    }

    function showMobilePanel(serviceKey) {
        const card = studio.querySelector(`.service-card[data-service="${serviceKey}"]`);
        const anchor = studio.querySelector(`.service-detail-anchor[data-service="${serviceKey}"]`);
        if (!card || !anchor) return;

        mobileOpenKey = serviceKey;

        studio.querySelectorAll('.service-card').forEach((item) => {
            const isActive = item === card;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            item.setAttribute('aria-expanded', String(isActive));
        });

        studio.querySelectorAll('.service-detail-anchor').forEach((slot) => {
            const isActive = slot === anchor;
            slot.hidden = !isActive;
            slot.setAttribute('aria-hidden', String(!isActive));
        });

        panel.hidden = false;
        panel.setAttribute('aria-hidden', 'false');

        if (panel.parentElement !== anchor) anchor.appendChild(panel);

        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showDesktopPanel(serviceKey) {
        mobileOpenKey = null;

        studio.querySelectorAll('.service-detail-anchor').forEach((slot) => {
            slot.hidden = true;
            slot.setAttribute('aria-hidden', 'true');
        });

        panel.hidden = false;
        panel.setAttribute('aria-hidden', 'false');

        if (panel.parentElement !== studio) studio.appendChild(panel);

        const card = studio.querySelector(`.service-card[data-service="${serviceKey}"]`);
        if (!card) return;

        studio.querySelectorAll('.service-card').forEach((item) => {
            const isActive = item === card;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            item.setAttribute('aria-expanded', String(isActive));
        });
    }

    function placePanel(serviceKey) {
        if (isMobile()) showMobilePanel(serviceKey);
        else showDesktopPanel(serviceKey);
    }

    window.placeServicePanel = placePanel;
    window.closeServicePanel = hideMobilePanel;
    window.isServicePanelOpen = () => Boolean(mobileOpenKey);

    function ensureDesktopDefault() {
        let active = studio.querySelector('.service-card.active');
        if (!active) {
            active = studio.querySelector('.service-card[data-service="enablement"]');
            active?.classList.add('active');
            active?.setAttribute('aria-selected', 'true');
            active?.setAttribute('aria-expanded', 'true');
        }
        showDesktopPanel(active.getAttribute('data-service') || 'enablement');
    }

    function syncLayout() {
        if (isMobile()) {
            if (mobileOpenKey) showMobilePanel(mobileOpenKey);
            else hideMobilePanel();
            return;
        }
        ensureDesktopDefault();
    }

    if (isMobile()) hideMobilePanel();
    else ensureDesktopDefault();

    mq.addEventListener('change', syncLayout);
})();

(function initAutomationPanelPlacement() {
    const lab = document.getElementById('automationLab');
    const panelHost = document.getElementById('automationPanelsHost');
    if (!lab || !panelHost) return;

    const mq = window.matchMedia('(max-width: 899px)');
    const DEFAULT_TAB = 'opportunity';
    let mobileOpenKey = null;

    function isMobile() {
        return mq.matches;
    }

    function getTab(tabId) {
        return lab.querySelector(`.automation-lab-tab[data-automation-tab="${tabId}"]`);
    }

    function getAnchor(tabId) {
        return lab.querySelector(`.automation-detail-anchor[data-automation-tab="${tabId}"]`);
    }

    function getPanel(tabId) {
        return lab.querySelector(`[data-automation-panel="${tabId}"]`);
    }

    function setTabState(tab, isActive) {
        if (!tab) return;
        tab.classList.toggle('active', isActive);
        tab.classList.toggle('automation-lab-tab--active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('aria-expanded', String(isActive));
    }

    function hideMobilePanel() {
        mobileOpenKey = null;

        lab.querySelectorAll('.automation-lab-tab').forEach((tab) => {
            setTabState(tab, false);
        });

        lab.querySelectorAll('.automation-detail-anchor').forEach((slot) => {
            slot.hidden = true;
            slot.setAttribute('aria-hidden', 'true');
        });

        lab.querySelectorAll('[data-automation-panel]').forEach((panel) => {
            panel.hidden = true;
            panel.setAttribute('aria-hidden', 'true');
            if (panel.parentElement !== panelHost) {
                panelHost.appendChild(panel);
            }
        });

        panelHost.hidden = true;
        panelHost.setAttribute('aria-hidden', 'true');
    }

    function showMobilePanel(tabId) {
        const tab = getTab(tabId);
        const anchor = getAnchor(tabId);
        const panel = getPanel(tabId);
        if (!tab || !anchor || !panel) return;

        mobileOpenKey = tabId;

        lab.querySelectorAll('.automation-lab-tab').forEach((item) => {
            setTabState(item, item === tab);
        });

        lab.querySelectorAll('.automation-detail-anchor').forEach((slot) => {
            const isActive = slot === anchor;
            slot.hidden = !isActive;
            slot.setAttribute('aria-hidden', String(!isActive));
        });

        lab.querySelectorAll('[data-automation-panel]').forEach((item) => {
            const isActive = item === panel;
            item.hidden = !isActive;
            item.setAttribute('aria-hidden', String(!isActive));
        });

        panelHost.hidden = true;
        panelHost.setAttribute('aria-hidden', 'true');

        if (panel.parentElement !== anchor) {
            anchor.appendChild(panel);
        }

        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showDesktopPanel(tabId) {
        mobileOpenKey = null;

        lab.querySelectorAll('.automation-detail-anchor').forEach((slot) => {
            slot.hidden = true;
            slot.setAttribute('aria-hidden', 'true');
        });

        lab.querySelectorAll('[data-automation-panel]').forEach((panel) => {
            if (panel.parentElement !== panelHost) {
                panelHost.appendChild(panel);
            }
        });

        panelHost.hidden = false;
        panelHost.setAttribute('aria-hidden', 'false');

        const tab = getTab(tabId);
        if (!tab) return;

        lab.querySelectorAll('.automation-lab-tab').forEach((item) => {
            setTabState(item, item === tab);
        });

        lab.querySelectorAll('[data-automation-panel]').forEach((panel) => {
            const isActive = panel.dataset.automationPanel === tabId;
            panel.hidden = !isActive;
            panel.setAttribute('aria-hidden', String(!isActive));
        });
    }

    function placePanel(tabId) {
        if (isMobile()) showMobilePanel(tabId);
        else showDesktopPanel(tabId);
    }

    window.placeAutomationPanel = placePanel;
    window.closeAutomationPanel = hideMobilePanel;
    window.isAutomationPanelOpen = () => Boolean(mobileOpenKey);

    function syncLayout() {
        if (isMobile()) {
            if (mobileOpenKey) showMobilePanel(mobileOpenKey);
            else hideMobilePanel();
            return;
        }
        showDesktopPanel(mobileOpenKey || DEFAULT_TAB);
    }

    lab.querySelectorAll('.automation-lab-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            if (tab.disabled || tab.getAttribute('aria-disabled') === 'true') return;

            const tabId = tab.dataset.automationTab;

            if (isMobile() && tab.classList.contains('active') && mobileOpenKey === tabId) {
                hideMobilePanel();
                return;
            }

            placePanel(tabId);
        });
    });

    if (isMobile()) hideMobilePanel();
    else showDesktopPanel(DEFAULT_TAB);

    mq.addEventListener('change', syncLayout);
})();

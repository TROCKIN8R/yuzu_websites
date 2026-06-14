(function initAutomationDemos() {
    const root = document.getElementById('automationLab');
    const data = window.OpportunityData;
    const table = window.OpportunityTable;
    if (!root || !data || !table) return;

    const tableId = 'home-opportunities-preview';
    const tabs = root.querySelectorAll('[data-automation-tab]');
    const panels = root.querySelectorAll('[data-automation-panel]');
    const form = document.getElementById('homeOpportunityForm');
    const formStatus = document.getElementById('homeOpportunityFormStatus');

    table.init({
        id: tableId,
        tbodyId: 'homeOpportunityTableBody',
        statusId: 'homeOpportunityTableStatus',
        limit: 5,
        compact: true,
        idleMs: 30000
    });

    function activateTab(tabId) {
        tabs.forEach((tab) => {
            const isActive = tab.dataset.automationTab === tabId;
            tab.classList.toggle('automation-lab-tab--active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        panels.forEach((panel) => {
            const isActive = panel.dataset.automationPanel === tabId;
            panel.hidden = !isActive;
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            if (tab.disabled || tab.getAttribute('aria-disabled') === 'true') return;
            activateTab(tab.dataset.automationTab);
        });
    });

    function setFormMessage(message, type) {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = `opp-form-status opp-form-status--${type}`;
        formStatus.hidden = !message;
    }

    async function submitOpportunity(event) {
        event.preventDefault();
        if (!form) return;

        const submitBtn = form.querySelector('[type="submit"]');
        const formData = new FormData(form);
        const name = String(formData.get('name') || '').trim();
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const source = 'yuzu.solutions/home-automation-demo';

        if (!name || !email) {
            setFormMessage('Please enter your name and work email.', 'error');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormMessage('Please enter a valid email address.', 'error');
            return;
        }

        submitBtn.disabled = true;
        setFormMessage('Sending…', 'info');

        try {
            if (!data.isSupabaseConfigured()) {
                setFormMessage('Supabase not configured yet.', 'warn');
                form.reset();
                return;
            }

            await data.submitOpportunity(name, email, source);
            setFormMessage('Submitted, your row should appear in the table below.', 'success');
            form.reset();
            table.afterSubmit(tableId, name);
        } catch (error) {
            const detail = String(error?.message || error);
            if (detail.includes('row-level security') || detail.includes('42501')) {
                setFormMessage('Insert blocked, run supabase_anon_insert_policy.sql in SQL Editor.', 'error');
            } else {
                setFormMessage('Something went wrong. Try again or email adrienyvin@gmail.com.', 'error');
            }
        } finally {
            submitBtn.disabled = false;
        }
    }

    form?.addEventListener('submit', submitOpportunity);
})();

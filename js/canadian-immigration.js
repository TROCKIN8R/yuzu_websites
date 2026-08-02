/**
 * Canadian immigration hub — route to a kit or resume a draft.
 */
(function initCanadianImmigrationHub() {
    const continueBtn = document.getElementById('cimContinueBtn');
    const resumeBtn = document.getElementById('cimResumeBtn');
    const resumeStatusEl = document.getElementById('cimResumeStatus');
    const codeInput = document.getElementById('cim-resume-code');
    const familyInput = document.getElementById('cim-resume-familyName');
    const config = window.STUDY_PERMIT_KIT_CONFIG || {};

    const ROUTES = {
        study: './study-permit-kit.html?new=1',
        work: './work-permit-kit.html',
    };

    function selectedPermit() {
        const checked = document.querySelector('input[name="cim-permit"]:checked');
        return checked?.value || 'study';
    }

    function showStatus(message, isError) {
        if (!resumeStatusEl) return;
        resumeStatusEl.hidden = !message;
        resumeStatusEl.textContent = message || '';
        resumeStatusEl.classList.toggle('opp-form-status--error', Boolean(isError));
    }

    function apiBase() {
        const supabase = config.supabase || {};
        return {
            base: String(supabase.url || '').replace(/\/$/, ''),
            anonKey: String(supabase.anonKey || ''),
            kitFunction: String(supabase.kitFunction || 'study-permit-kit'),
        };
    }

    async function loadStudyDraft(code, familyName) {
        const { base, anonKey, kitFunction } = apiBase();
        if (!base || !anonKey) {
            throw new Error('Configuration is missing. Please refresh and try again.');
        }
        const response = await fetch(`${base}/functions/v1/${kitFunction}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
                action: 'load-draft',
                code,
                familyName,
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }
        return result;
    }

    continueBtn?.addEventListener('click', () => {
        const permit = selectedPermit();
        const href = ROUTES[permit] || ROUTES.study;
        window.location.href = href;
    });

    resumeBtn?.addEventListener('click', async () => {
        const code = codeInput?.value?.trim() || '';
        const familyName = familyInput?.value?.trim() || '';
        if (!code || !familyName) {
            showStatus('Enter resume code and family name (last name).', true);
            return;
        }

        resumeBtn.disabled = true;
        showStatus('Looking up your draft…', false);
        try {
            // Today only study drafts exist. Work resumes will route by kit type later.
            await loadStudyDraft(code, familyName);
            try {
                sessionStorage.setItem('spkResumeCode', code);
                sessionStorage.setItem('spkResumeFamilyName', familyName);
                sessionStorage.setItem('spkAutoResume', '1');
            } catch {
                // ignore storage failures — query params still carry values
            }
            const params = new URLSearchParams({
                resume: '1',
                code,
                family: familyName,
            });
            window.location.href = `./study-permit-kit.html?${params.toString()}`;
        } catch (error) {
            showStatus(error instanceof Error ? error.message : String(error), true);
            resumeBtn.disabled = false;
        }
    });

    try {
        const remembered = sessionStorage.getItem('spkResumeCode');
        if (remembered && codeInput && !codeInput.value) {
            codeInput.value = remembered;
        }
        const rememberedFamily = sessionStorage.getItem('spkResumeFamilyName');
        if (rememberedFamily && familyInput && !familyInput.value) {
            familyInput.value = rememberedFamily;
        }
    } catch {
        // ignore
    }
})();

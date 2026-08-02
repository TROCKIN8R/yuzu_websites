/**
 * Work permit kit — thin wrapper over shared createPermitKit().
 */
(function initWorkPermitKit() {
    if (typeof window.createPermitKit !== 'function') return;

    function applicationLocation(form, g) {
        const v = g(new FormData(form), 'applicationLocation');
        return v === 'inside' ? 'inside' : 'outside';
    }

    window.createPermitKit({
        prefix: 'wpk',
        configKey: 'WORK_PERMIT_KIT_CONFIG',
        kitFunction: 'work-permit-kit',
        zipPrefix: 'work-permit-kit',
        stepLabels: [
            'Situation',
            'Confirm forms',
            'About you',
            'Contact',
            'Work details',
            'Passport',
            'Work history',
            'Background',
            'Extras',
            'Review & deliver',
        ],
        situationFields: [
            'hasRepresentative',
            'hasDesignee',
            'isCommonLaw',
            'applicationLocation',
            'workPermitType',
        ],
        domainTextKeys: [
            'employerName', 'employerAddress', 'workProvince', 'workCity', 'workLocationAddress',
            'jobTitle', 'jobDescription', 'lmiaNumber', 'workPermitType', 'applicationLocation',
            'origEntryDate', 'origEntryPlace', 'recentEntryDate', 'recentEntryPlace', 'prevDocNum',
            'lcpNoPersons', 'caqNumber',
        ],
        draftDatePairs: [
            ['workFrom', 'workFromYear', 'workFromMonth', 'workFromDay'],
            ['workTo', 'workToYear', 'workToMonth', 'workToDay'],
        ],
        selectForms(form, g, yn) {
            const data = new FormData(form);
            const inside = g(data, 'applicationLocation') === 'inside';
            const forms = inside
                ? ['imm5710', 'imm5707', 'imm5556']
                : ['imm1295', 'imm5707', 'imm5488'];
            if (yn(g(data, 'hasRepresentative'))) forms.push('imm5476');
            if (yn(g(data, 'hasDesignee'))) forms.push('imm5475');
            if (yn(g(data, 'isCommonLaw'))) forms.push('imm5409');
            return forms;
        },
        syncBranches(form, g) {
            const data = new FormData(form);
            const loc = g(data, 'applicationLocation') || 'outside';
            const permit = g(data, 'workPermitType');
            form.querySelectorAll('[data-wpk-show]').forEach((el) => {
                const rule = el.getAttribute('data-wpk-show') || '';
                const [key, val] = rule.split('=');
                let show = false;
                if (key === 'applicationLocation') show = loc === val;
                if (key === 'workPermitType') show = permit === val;
                el.hidden = !show;
            });
        },
        emptyConfirmNote(form, g) {
            const loc = applicationLocation(form, g);
            return `Core ${loc === 'inside' ? 'inside-Canada' : 'outside-Canada'} kit only.`;
        },
        reviewExtraRows(data, _forms, g) {
            return [
                ['Employer', g(data, 'employerName')],
                ['Job title', g(data, 'jobTitle')],
                ['Location', `${g(data, 'workCity')}, ${g(data, 'workProvince')}`],
                [
                    'Applying from',
                    g(data, 'applicationLocation') === 'inside'
                        ? 'Inside Canada'
                        : 'Outside Canada',
                ],
            ];
        },
        collectDomain(data, g, _yn, sd) {
            const workFrom = sd(g(data, 'workFrom'));
            const workTo = sd(g(data, 'workTo'));
            return {
                applicationLocation: g(data, 'applicationLocation') || 'outside',
                workPermitType: g(data, 'workPermitType') || 'LMOS',
                applyingRestore: data.get('applyingRestore') === 'Y',
                applyingExtend: data.get('applyingExtend') === 'Y',
                applyingNewEmployer: data.get('applyingNewEmployer') === 'Y',
                applyingTrp: data.get('applyingTrp') === 'Y',
                employerName: g(data, 'employerName'),
                employerAddress: g(data, 'employerAddress'),
                workProvince: g(data, 'workProvince'),
                workCity: g(data, 'workCity'),
                workLocationAddress: g(data, 'workLocationAddress'),
                jobTitle: g(data, 'jobTitle'),
                jobDescription: g(data, 'jobDescription'),
                workFromYear: workFrom.year,
                workFromMonth: workFrom.month,
                workFromDay: workFrom.day,
                workToYear: workTo.year,
                workToMonth: workTo.month,
                workToDay: workTo.day,
                lmiaNumber: g(data, 'lmiaNumber'),
                lcpChildCare: data.get('lcpChildCare') === 'Y',
                lcpDisabled: data.get('lcpDisabled') === 'Y',
                lcpElderly: data.get('lcpElderly') === 'Y',
                lcpOther: data.get('lcpOther') === 'Y',
                lcpNoPersons: g(data, 'lcpNoPersons'),
                origEntryDate: g(data, 'origEntryDate'),
                origEntryPlace: g(data, 'origEntryPlace'),
                recentEntryDate: g(data, 'recentEntryDate'),
                recentEntryPlace: g(data, 'recentEntryPlace'),
                prevDocNum: g(data, 'prevDocNum'),
                palNumber: '',
                palExpiryYear: '',
                palExpiryMonth: '',
                palExpiryDay: '',
            };
        },
    });
})();

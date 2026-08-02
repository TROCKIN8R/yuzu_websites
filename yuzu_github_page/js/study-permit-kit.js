/**
 * Study permit kit — thin wrapper over shared createPermitKit().
 */
(function initStudyPermitKit() {
    if (typeof window.createPermitKit !== 'function') return;

    window.createPermitKit({
        prefix: 'spk',
        configKey: 'STUDY_PERMIT_KIT_CONFIG',
        kitFunction: 'study-permit-kit',
        zipPrefix: 'study-permit-kit',
        stepLabels: [
            'Situation',
            'Confirm forms',
            'About you',
            'Contact',
            'Study',
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
            'needsCustodian',
        ],
        extraRequiredByForm: {
            imm5646: ['custodianFamilyName', 'custodianGivenName', 'custodianAddress'],
        },
        domainTextKeys: [
            'schoolName', 'dli', 'studyLevel', 'fieldOfStudy',
            'schoolProvince', 'schoolCity', 'schoolAddress', 'tuitionAmount', 'availableFunds',
            'funds', 'fundsOtherPerson', 'caqNumber', 'palNumber',
            'custodianFamilyName', 'custodianGivenName', 'custodianDob', 'custodianStatus',
            'custodianAddress', 'custodianTelephone',
        ],
        draftDatePairs: [
            ['studyFrom', 'studyFromYear', 'studyFromMonth', 'studyFromDay'],
            ['studyTo', 'studyToYear', 'studyToMonth', 'studyToDay'],
        ],
        selectForms(form, g, yn) {
            const data = new FormData(form);
            const forms = ['imm1294', 'imm5707', 'imm5483'];
            if (yn(g(data, 'hasRepresentative'))) forms.push('imm5476');
            if (yn(g(data, 'hasDesignee'))) forms.push('imm5475');
            if (yn(g(data, 'isCommonLaw'))) forms.push('imm5409');
            if (yn(g(data, 'needsCustodian'))) forms.push('imm5646');
            return forms;
        },
        emptyConfirmNote() {
            return 'Core kit only — no optional forms from your answers.';
        },
        reviewExtraRows(data, _forms, g) {
            return [
                ['School', g(data, 'schoolName')],
                ['DLI', g(data, 'dli')],
            ];
        },
        collectDomain(data, g, yn, sd) {
            const studyFrom = sd(g(data, 'studyFrom'));
            const studyTo = sd(g(data, 'studyTo'));
            const palExpiry = sd(g(data, 'palExpiry'));
            return {
                needsCustodian: yn(g(data, 'needsCustodian')),
                schoolName: g(data, 'schoolName'),
                dli: g(data, 'dli'),
                studyLevel: g(data, 'studyLevel'),
                fieldOfStudy: g(data, 'fieldOfStudy'),
                schoolProvince: g(data, 'schoolProvince'),
                schoolCity: g(data, 'schoolCity'),
                schoolAddress: g(data, 'schoolAddress'),
                studyFromYear: studyFrom.year,
                studyFromMonth: studyFrom.month,
                studyFromDay: studyFrom.day,
                studyToYear: studyTo.year,
                studyToMonth: studyTo.month,
                studyToDay: studyTo.day,
                tuitionAmount: g(data, 'tuitionAmount'),
                availableFunds: g(data, 'availableFunds'),
                funds: g(data, 'funds'),
                fundsOtherPerson: g(data, 'fundsOtherPerson'),
                palNumber: g(data, 'palNumber'),
                palExpiryYear: palExpiry.year,
                palExpiryMonth: palExpiry.month,
                palExpiryDay: palExpiry.day,
                custodianFamilyName: g(data, 'custodianFamilyName'),
                custodianGivenName: g(data, 'custodianGivenName'),
                custodianDob: g(data, 'custodianDob'),
                custodianStatus: g(data, 'custodianStatus'),
                custodianAddress: g(data, 'custodianAddress'),
                custodianTelephone: g(data, 'custodianTelephone'),
            };
        },
    });
})();

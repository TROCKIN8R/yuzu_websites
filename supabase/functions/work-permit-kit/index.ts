import {
  fillKitForms,
  resolveForms,
  zipFilledForms,
} from "./fill_kit.ts";
import {
  DRAFT_TTL_DAYS,
  loadDraft,
  saveDraft,
} from "./drafts.ts";
import { type KitAnswers, selectForms } from "./patchers.ts";
import { validateWorkAnswers } from "./validate.ts";
import {
  EMAIL_MAX_LENGTH,
  cleanText,
  digits,
  parseBool,
  servePermitKit,
} from "../_shared/permit_kit_http.ts";

function validateKit(raw: Record<string, unknown>): { ok: true; answers: KitAnswers } | { ok: false; error: string } {
  const email = cleanText(raw.email, EMAIL_MAX_LENGTH).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const familyName = cleanText(raw.familyName);
  const givenName = cleanText(raw.givenName);
  if (!familyName || !givenName) {
    return { ok: false, error: "Enter your family name and given name." };
  }

  const dobYear = digits(raw.dobYear, 4);
  const dobMonth = digits(raw.dobMonth, 2).padStart(2, "0");
  const dobDay = digits(raw.dobDay, 2).padStart(2, "0");
  if (dobYear.length !== 4 || Number(dobMonth) < 1 || Number(dobMonth) > 12 || Number(dobDay) < 1 || Number(dobDay) > 31) {
    return { ok: false, error: "Enter a valid date of birth." };
  }

  const formLanguage = cleanText(raw.formLanguage || raw.serviceIn, 20).toLowerCase().startsWith("f")
    ? "f"
    : "e";

  const applicationLocation = cleanText(raw.applicationLocation, 20).toLowerCase() === "inside"
    ? "inside"
    : "outside";

  const hasRepresentative = parseBool(raw.hasRepresentative);
  const hasDesignee = parseBool(raw.hasDesignee);
  const isCommonLaw = parseBool(raw.isCommonLaw);

  let forms = selectForms({ applicationLocation, hasRepresentative, hasDesignee, isCommonLaw });
  if (Array.isArray(raw.forms) && raw.forms.length) {
    forms = resolveForms({
      email,
      formLanguage,
      applicationLocation,
      forms: (raw.forms as unknown[]).map((f) => cleanText(f, 20).toLowerCase()),
      familyName,
      givenName,
      dobYear,
      dobMonth,
      dobDay,
      hasRepresentative,
      hasDesignee,
      isCommonLaw,
    } as KitAnswers);
  }

  if (!cleanText(raw.parent1FamilyName) || !cleanText(raw.parent1GivenName)) {
    return { ok: false, error: "Enter parent / guardian 1 family name and given name (required for IMM 5707)." };
  }
  if (!cleanText(raw.parent2FamilyName) || !cleanText(raw.parent2GivenName)) {
    return { ok: false, error: "Enter parent / guardian 2 family name and given name (required for IMM 5707)." };
  }

  if (hasRepresentative) {
    if (!cleanText(raw.repFamilyName) || !cleanText(raw.repGivenName)) {
      return { ok: false, error: "Enter your representative’s family and given names." };
    }
    if (!cleanText(raw.repEmail, EMAIL_MAX_LENGTH)) {
      return { ok: false, error: "Enter your representative’s email." };
    }
  }
  if (hasDesignee) {
    if (!cleanText(raw.designeeFamilyName) || !cleanText(raw.designeeGivenName)) {
      return { ok: false, error: "Enter the designated individual’s family and given names." };
    }
    if (!cleanText(raw.designeeRelationship)) {
      return { ok: false, error: "Enter the designated individual’s relationship to you." };
    }
  }
  if (isCommonLaw) {
    if (!cleanText(raw.partnerFamilyName) || !cleanText(raw.partnerGivenName)) {
      return { ok: false, error: "Enter your common-law partner’s family and given names." };
    }
    if (!cleanText(raw.yearsTogether, 10)) {
      return { ok: false, error: "Enter how many years you have lived together." };
    }
  }
  const workCheck = validateWorkAnswers({ ...raw, applicationLocation });
  if (!workCheck.ok) return workCheck;

  const primary = (raw.primary && typeof raw.primary === "object")
    ? raw.primary as Record<string, unknown>
    : {};

  // Flatten primary application questionnaire fields into primary bag.
  for (const key of [
    "passportNumber", "passportCountry", "passportIssueYear", "passportIssueMonth", "passportIssueDay",
    "passportExpiryYear", "passportExpiryMonth", "passportExpiryDay",
    "workPermitType", "employerName", "employerAddress", "workProvince", "workCity", "workLocationAddress",
    "jobTitle", "jobDescription", "workFromYear", "workFromMonth", "workFromDay",
    "workToYear", "workToMonth", "workToDay", "lmiaNumber",
    "lcpChildCare", "lcpDisabled", "lcpElderly", "lcpOther", "lcpNoPersons",
    "applyingRestore", "applyingExtend", "applyingNewEmployer", "applyingTrp",
    "origEntryDate", "origEntryPlace", "purposeOfVisit", "recentEntryDate", "recentEntryPlace", "prevDocNum",
    "caqNumber", "caqExpiryYear", "caqExpiryMonth", "caqExpiryDay",
    "nativeLang", "ableToCommunicate", "preferredLang", "langTest",
    "maritalStatus", "spouseFamilyName", "spouseGivenName", "marriageYear", "marriageMonth", "marriageDay",
    "currentCountry", "currentStatus", "corOther",
    "corFromYear", "corFromMonth", "corFromDay", "corToYear", "corToMonth", "corToDay",
    "previousCor", "previousCorRows",
    "pcor1Country", "pcor1Status", "pcor1Other", "pcor1FromYear", "pcor1FromMonth", "pcor1FromDay",
    "pcor1ToYear", "pcor1ToMonth", "pcor1ToDay",
    "pcor2Country", "pcor2Status", "pcor2Other", "pcor2FromYear", "pcor2FromMonth", "pcor2FromDay",
    "pcor2ToYear", "pcor2ToMonth", "pcor2ToDay",
    "sameAsCor", "cwaCountry", "cwaStatus", "cwaOther",
    "cwaFromYear", "cwaFromMonth", "cwaFromDay", "cwaToYear", "cwaToMonth", "cwaToDay",
    "previouslyMarried", "prevSpouseFamilyName", "prevSpouseGivenName", "prevSpouseRelationship",
    "prevSpouseDobYear", "prevSpouseDobMonth", "prevSpouseDobDay",
    "prevSpouseFromYear", "prevSpouseFromMonth", "prevSpouseFromDay",
    "prevSpouseToYear", "prevSpouseToMonth", "prevSpouseToDay",
    "hasAlias", "aliasFamilyName", "aliasGivenName",
    "hasNatId", "natIdNumber", "natIdCountry",
    "natIdIssueYear", "natIdIssueMonth", "natIdIssueDay",
    "natIdExpiryYear", "natIdExpiryMonth", "natIdExpiryDay",
    "hasUsCard", "usCardNumber", "usCardExpiryYear", "usCardExpiryMonth", "usCardExpiryDay",
    "sameAsMailing", "resStreetNum", "resStreetName", "resAptUnit", "resCity", "resCountry",
    "resProvinceState", "resPostalCode",
    "phoneType", "educationIndicator",
    "eduFromYear", "eduFromMonth", "eduToYear", "eduToMonth",
    "eduField", "eduSchool", "eduCity", "eduCountry", "eduProvince",
    "occupation", "employer", "occupationCity", "occupationCountry", "occupationProvince",
    "occupationFromYear", "occupationFromMonth", "jobs",
    "bgTb", "bgDisorder", "bgMedicalDetails", "bgOverstay", "bgRefused", "bgClaimAsylum",
    "bgRefusedDetails", "bgCrime", "bgCrimeDetails", "bgMilitary", "bgMilitaryDetails",
    "bgViolence", "bgWitness", "cicContactConsent", "serviceIn",
  ]) {
    if (raw[key] !== undefined && primary[key] === undefined) {
      primary[key] = raw[key];
    }
  }

  const answers: KitAnswers = {
    email,
    formLanguage,
    applicationLocation,
    forms,
    workPermitType: cleanText(raw.workPermitType, 20) || undefined,
    applyingRestore: parseBool(raw.applyingRestore),
    applyingExtend: parseBool(raw.applyingExtend),
    applyingNewEmployer: parseBool(raw.applyingNewEmployer),
    applyingTrp: parseBool(raw.applyingTrp),
    familyName,
    givenName,
    sex: cleanText(raw.sex, 20) || undefined,
    dobYear,
    dobMonth,
    dobDay,
    citizenship: cleanText(raw.citizenship) || undefined,
    placeBirthCountry: cleanText(raw.placeBirthCountry) || undefined,
    placeBirthCity: cleanText(raw.placeBirthCity) || undefined,
    maritalStatus: cleanText(raw.maritalStatus, 2) || undefined,
    occupation: cleanText(raw.occupation) || undefined,
    emailContact: cleanText(raw.emailContact || email, EMAIL_MAX_LENGTH) || undefined,
    phone: cleanText(raw.phone, 40) || undefined,
    phoneCountryCode: digits(raw.phoneCountryCode, 4) || undefined,
    streetNum: cleanText(raw.streetNum, 20) || undefined,
    streetName: cleanText(raw.streetName) || undefined,
    city: cleanText(raw.city) || undefined,
    provinceState: cleanText(raw.provinceState, 40) || undefined,
    country: cleanText(raw.country) || undefined,
    postalCode: cleanText(raw.postalCode, 20) || undefined,
    employerName: cleanText(raw.employerName) || undefined,
    employerAddress: cleanText(raw.employerAddress, 200) || undefined,
    workProvince: cleanText(raw.workProvince, 40) || undefined,
    workCity: cleanText(raw.workCity) || undefined,
    workLocationAddress: cleanText(raw.workLocationAddress, 200) || undefined,
    jobTitle: cleanText(raw.jobTitle) || undefined,
    jobDescription: cleanText(raw.jobDescription, 500) || undefined,
    workFromYear: digits(raw.workFromYear, 4) || undefined,
    workFromMonth: digits(raw.workFromMonth, 2) || undefined,
    workFromDay: digits(raw.workFromDay, 2) || undefined,
    workToYear: digits(raw.workToYear, 4) || undefined,
    workToMonth: digits(raw.workToMonth, 2) || undefined,
    workToDay: digits(raw.workToDay, 2) || undefined,
    lmiaNumber: cleanText(raw.lmiaNumber, 40) || undefined,
    lcpChildCare: parseBool(raw.lcpChildCare),
    lcpDisabled: parseBool(raw.lcpDisabled),
    lcpElderly: parseBool(raw.lcpElderly),
    lcpOther: parseBool(raw.lcpOther),
    lcpNoPersons: cleanText(raw.lcpNoPersons, 10) || undefined,
    origEntryDate: cleanText(raw.origEntryDate, 20) || undefined,
    origEntryPlace: cleanText(raw.origEntryPlace) || undefined,
    purposeOfVisit: cleanText(raw.purposeOfVisit) || undefined,
    recentEntryDate: cleanText(raw.recentEntryDate, 20) || undefined,
    recentEntryPlace: cleanText(raw.recentEntryPlace) || undefined,
    prevDocNum: cleanText(raw.prevDocNum, 40) || undefined,
    primary,
    parent1FamilyName: cleanText(raw.parent1FamilyName) || undefined,
    parent1GivenName: cleanText(raw.parent1GivenName) || undefined,
    parent1Dob: cleanText(raw.parent1Dob, 20) || undefined,
    parent1Cob: cleanText(raw.parent1Cob) || undefined,
    parent1Address: cleanText(raw.parent1Address, 200) || undefined,
    parent1MaritalStatus: cleanText(raw.parent1MaritalStatus, 2) || undefined,
    parent1Occupation: cleanText(raw.parent1Occupation) || undefined,
    parent1Telephone: cleanText(raw.parent1Telephone, 40) || undefined,
    parent2FamilyName: cleanText(raw.parent2FamilyName) || undefined,
    parent2GivenName: cleanText(raw.parent2GivenName) || undefined,
    parent2Dob: cleanText(raw.parent2Dob, 20) || undefined,
    parent2Cob: cleanText(raw.parent2Cob) || undefined,
    parent2Address: cleanText(raw.parent2Address, 200) || undefined,
    parent2MaritalStatus: cleanText(raw.parent2MaritalStatus, 2) || undefined,
    parent2Occupation: cleanText(raw.parent2Occupation) || undefined,
    parent2Telephone: cleanText(raw.parent2Telephone, 40) || undefined,
    spouseFamilyName: cleanText(raw.spouseFamilyName) || undefined,
    spouseGivenName: cleanText(raw.spouseGivenName) || undefined,
    spouseDob: cleanText(raw.spouseDob, 20) || undefined,
    spouseCob: cleanText(raw.spouseCob) || undefined,
    spouseAddress: cleanText(raw.spouseAddress, 200) || undefined,
    spouseOccupation: cleanText(raw.spouseOccupation) || undefined,
    spouseAccompanying: parseBool(raw.spouseAccompanying),
    hasRepresentative,
    repFamilyName: cleanText(raw.repFamilyName) || undefined,
    repGivenName: cleanText(raw.repGivenName) || undefined,
    repOrganization: cleanText(raw.repOrganization) || undefined,
    repEmail: cleanText(raw.repEmail, EMAIL_MAX_LENGTH) || undefined,
    repPhone: cleanText(raw.repPhone, 40) || undefined,
    repPhoneCountryCode: digits(raw.repPhoneCountryCode, 4) || undefined,
    repMembershipId: cleanText(raw.repMembershipId, 40) || undefined,
    repStreetNum: cleanText(raw.repStreetNum, 20) || undefined,
    repStreetName: cleanText(raw.repStreetName) || undefined,
    repCity: cleanText(raw.repCity) || undefined,
    repProvince: cleanText(raw.repProvince, 40) || undefined,
    repCountry: cleanText(raw.repCountry) || undefined,
    repPostalCode: cleanText(raw.repPostalCode, 20) || undefined,
    hasDesignee,
    designeeFamilyName: cleanText(raw.designeeFamilyName) || undefined,
    designeeGivenName: cleanText(raw.designeeGivenName) || undefined,
    designeeRelationship: cleanText(raw.designeeRelationship) || undefined,
    isCommonLaw,
    partnerGivenName: cleanText(raw.partnerGivenName) || undefined,
    partnerFamilyName: cleanText(raw.partnerFamilyName) || undefined,
    yearsTogether: cleanText(raw.yearsTogether, 10) || undefined,
    commonLawCity: cleanText(raw.commonLawCity) || undefined,
    commonLawProvince: cleanText(raw.commonLawProvince, 40) || undefined,
    commonLawCountry: cleanText(raw.commonLawCountry) || undefined,
    commonLawStart: cleanText(raw.commonLawStart, 20) || undefined,
  };

  return { ok: true, answers };
}

servePermitKit<KitAnswers>({
  rates: { bucketPrefix: "workkit", envPrefix: "WORK_KIT" },
  email: {
    kitLabel: "work permit",
    zipPrefix: "work-permit-kit",
    userSubject: "Your filled work permit kit (Yuzu demo)",
    notifySubjectPrefix: "Work permit kit demo",
    notifyBodyTitle: "Work permit kit filler demo submission",
  },
  drafts: { DRAFT_TTL_DAYS, saveDraft, loadDraft },
  selectFormsFromPayload: (payload) =>
    selectForms({
      applicationLocation: cleanText(payload.applicationLocation, 20).toLowerCase() ===
          "inside"
        ? "inside"
        : "outside",
      hasRepresentative: parseBool(payload.hasRepresentative),
      hasDesignee: parseBool(payload.hasDesignee),
      isCommonLaw: parseBool(payload.isCommonLaw),
    }),
  validateKit,
  fillKitForms,
  zipFilledForms,
});

import {
  setCheckbox,
  setEmptyTag,
} from "./xfa_incremental.ts";

export type KitAnswers = {
  email: string;
  formLanguage: "e" | "f";
  forms: string[];
  familyName: string;
  givenName: string;
  sex?: string;
  dobYear: string;
  dobMonth: string;
  dobDay: string;
  citizenship?: string;
  placeBirthCountry?: string;
  placeBirthCity?: string;
  maritalStatus?: string;
  occupation?: string;
  emailContact?: string;
  phone?: string;
  phoneCountryCode?: string;
  streetNum?: string;
  streetName?: string;
  city?: string;
  provinceState?: string;
  country?: string;
  postalCode?: string;
  schoolName?: string;
  schoolAddress?: string;
  imm1294?: Record<string, unknown>;
  // parents (IMM 5707 / 5646)
  parent1FamilyName?: string;
  parent1GivenName?: string;
  parent1Dob?: string;
  parent1Cob?: string;
  parent1Address?: string;
  parent1MaritalStatus?: string;
  parent1Occupation?: string;
  parent1Telephone?: string;
  parent2FamilyName?: string;
  parent2GivenName?: string;
  parent2Dob?: string;
  parent2Cob?: string;
  parent2Address?: string;
  parent2MaritalStatus?: string;
  parent2Occupation?: string;
  parent2Telephone?: string;
  // spouse (IMM 5707)
  spouseFamilyName?: string;
  spouseGivenName?: string;
  spouseDob?: string;
  spouseCob?: string;
  spouseAddress?: string;
  spouseOccupation?: string;
  spouseAccompanying?: boolean;
  // representative
  hasRepresentative?: boolean;
  repFamilyName?: string;
  repGivenName?: string;
  repOrganization?: string;
  repEmail?: string;
  repPhone?: string;
  repPhoneCountryCode?: string;
  repMembershipId?: string;
  repStreetNum?: string;
  repStreetName?: string;
  repCity?: string;
  repProvince?: string;
  repCountry?: string;
  repPostalCode?: string;
  // designated individual
  hasDesignee?: boolean;
  designeeFamilyName?: string;
  designeeGivenName?: string;
  designeeRelationship?: string;
  // common-law
  isCommonLaw?: boolean;
  partnerGivenName?: string;
  partnerFamilyName?: string;
  yearsTogether?: string;
  commonLawCity?: string;
  commonLawProvince?: string;
  commonLawCountry?: string;
  commonLawStart?: string;
  // custodian (IMM 5646 — minors)
  needsCustodian?: boolean;
  custodianFamilyName?: string;
  custodianGivenName?: string;
  custodianDob?: string;
  custodianStatus?: string;
  custodianAddress?: string;
  custodianTelephone?: string;
};

function ymd(a: KitAnswers): string {
  return `${a.dobYear}-${a.dobMonth.padStart(2, "0")}-${a.dobDay.padStart(2, "0")}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${
    String(d.getDate()).padStart(2, "0")
  }`;
}

function ascii(s: string | undefined, max = 120): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, max);
}

function maritalLabel(code: string | undefined): string {
  const map: Record<string, string> = {
    "01": "Married",
    "02": "Single",
    "03": "Common-law",
    "04": "Divorced",
    "05": "Separated",
    "06": "Widowed",
    "09": "Annulled marriage",
    "00": "Unknown",
  };
  const c = String(code || "").trim();
  return map[c] || c || "Single";
}

function mailingAddress(a: KitAnswers): string {
  return [a.streetNum, a.streetName, a.city, a.provinceState, a.country, a.postalCode]
    .filter(Boolean)
    .join(", ");
}

function bag(a: KitAnswers): Record<string, unknown> {
  return { ...(a as Record<string, unknown>), ...(a.imm1294 || {}) };
}

/** IMM 5707 — Family Information (core kit form for temporary residence). */
export function patchImm5707(xml: string, a: KitAnswers): string {
  let out = xml;
  const b = bag(a);
  const marital = String(b.maritalStatus || a.maritalStatus || "02");
  const occupation = ascii(
    String(b.occupation || a.occupation || ""),
    80,
  ) || "Student";
  const address = ascii(mailingAddress(a), 200);

  // Applicant
  out = setEmptyTag(out, "FamilyName", ascii(a.familyName));
  out = setEmptyTag(out, "GivenNames", ascii(a.givenName));
  out = setEmptyTag(out, "DOB", ymd(a));
  out = setEmptyTag(out, "COB", ascii(a.placeBirthCountry || a.citizenship));
  out = setEmptyTag(out, "MaritalStatus", maritalLabel(marital));
  out = setEmptyTag(out, "Occupation", occupation);

  if (marital === "01" || marital === "03") {
    out = setEmptyTag(out, "yesno", "Y"); // MarriageInPerson / ceremony — default yes when married/CL
  }

  // Spouse block (only when married / common-law)
  if (marital === "01" || marital === "03") {
    const spouseFamily = ascii(a.spouseFamilyName || String(b.spouseFamilyName || ""));
    const spouseGiven = ascii(a.spouseGivenName || String(b.spouseGivenName || ""));
    out = setEmptyTag(out, "yesno", a.spouseAccompanying ? "Y" : "N");
    if (spouseFamily) out = setEmptyTag(out, "FamilyName", spouseFamily);
    if (spouseGiven) out = setEmptyTag(out, "GivenNames", spouseGiven);
    const sDob = ascii(
      a.spouseDob ||
        (b.spouseDobYear && b.spouseDobMonth && b.spouseDobDay
          ? `${b.spouseDobYear}-${String(b.spouseDobMonth).padStart(2, "0")}-${
            String(b.spouseDobDay).padStart(2, "0")
          }`
          : ""),
      20,
    );
    if (sDob) out = setEmptyTag(out, "DOB", sDob);
    out = setEmptyTag(out, "COB", ascii(a.spouseCob || a.citizenship));
    out = setEmptyTag(out, "Address", ascii(a.spouseAddress || address, 200));
    out = setEmptyTag(out, "MaritalStatus", maritalLabel(marital));
    out = setEmptyTag(
      out,
      "Occupation",
      ascii(a.spouseOccupation || "Partner", 80),
    );
  }

  // Parent 1
  if (a.parent1FamilyName) {
    out = setEmptyTag(out, "yesno", "N");
    out = setEmptyTag(out, "FamilyName", ascii(a.parent1FamilyName));
    out = setEmptyTag(out, "GivenNames", ascii(a.parent1GivenName));
    if (a.parent1Dob) out = setEmptyTag(out, "DOB", ascii(a.parent1Dob, 20));
    out = setEmptyTag(out, "COB", ascii(a.parent1Cob || a.placeBirthCountry));
    out = setEmptyTag(out, "Address", ascii(a.parent1Address || address, 200));
    out = setEmptyTag(
      out,
      "MaritalStatus",
      maritalLabel(a.parent1MaritalStatus || "01"),
    );
    out = setEmptyTag(
      out,
      "Occupation",
      ascii(a.parent1Occupation || "Parent", 80),
    );
  }

  // Parent 2
  if (a.parent2FamilyName) {
    out = setEmptyTag(out, "yesno", "N");
    out = setEmptyTag(out, "FamilyName", ascii(a.parent2FamilyName));
    out = setEmptyTag(out, "GivenNames", ascii(a.parent2GivenName));
    if (a.parent2Dob) out = setEmptyTag(out, "DOB", ascii(a.parent2Dob, 20));
    out = setEmptyTag(out, "COB", ascii(a.parent2Cob || a.placeBirthCountry));
    out = setEmptyTag(out, "Address", ascii(a.parent2Address || address, 200));
    out = setEmptyTag(
      out,
      "MaritalStatus",
      maritalLabel(a.parent2MaritalStatus || "01"),
    );
    out = setEmptyTag(
      out,
      "Occupation",
      ascii(a.parent2Occupation || "Parent", 80),
    );
  }

  // No children declared in the wizard — hide empty child rows for a cleaner validate.
  out = out.replace(/<hideChildren\n>0<\/hideChildren\n>/, "<hideChildren\n>1</hideChildren\n>");
  out = setEmptyTag(out, "SectionAdate", todayYmd());
  out = setEmptyTag(out, "SectionBdate", todayYmd());
  return out;
}

/** IMM 5646 — Custodianship declaration (minors only). */
export function patchImm5646(xml: string, a: KitAnswers): string {
  let out = xml;
  const b = bag(a);
  const studentAddr = ascii(mailingAddress(a), 200);
  const schoolAddr = ascii(
    String(b.schoolAddress || a.schoolAddress || a.schoolName || ""),
    200,
  );
  const fillStudentBlock = (x: string) => {
    let o = x;
    o = setEmptyTag(o, "FamilyName", ascii(a.familyName));
    o = setEmptyTag(o, "GivenNames", ascii(a.givenName));
    if (a.citizenship) o = setEmptyTag(o, "Citizenship", ascii(a.citizenship));
    o = setEmptyTag(o, "theDate", ymd(a));
    if (schoolAddr) o = setEmptyTag(o, "schoolAddress", schoolAddr);
    if (a.sex === "Male" || a.sex === "Female") {
      o = setEmptyTag(o, "mfGroup", a.sex === "Male" ? "M" : "F");
    }
    if (studentAddr) o = setEmptyTag(o, "studentAddress", studentAddr);
    return o;
  };

  // Page1 + Page2 each have student/parent/custodian blocks — fill empties in order twice.
  out = fillStudentBlock(out);
  if (a.parent1FamilyName) {
    out = setEmptyTag(out, "parentFamilyName", ascii(a.parent1FamilyName));
    out = setEmptyTag(out, "parentGivenNames", ascii(a.parent1GivenName));
    if (a.parent1Dob) out = setEmptyTag(out, "theDate", ascii(a.parent1Dob, 20));
    out = setEmptyTag(
      out,
      "parentAddress",
      ascii(a.parent1Address || studentAddr, 200),
    );
    if (a.parent1Telephone) {
      out = setEmptyTag(out, "parentTelephone", ascii(a.parent1Telephone, 40));
    }
  }
  if (a.parent2FamilyName) {
    out = setEmptyTag(out, "parentFamilyName", ascii(a.parent2FamilyName));
    out = setEmptyTag(out, "parentGivenNames", ascii(a.parent2GivenName || ""));
    if (a.parent2Dob) out = setEmptyTag(out, "theDate", ascii(a.parent2Dob, 20));
    out = setEmptyTag(
      out,
      "parentAddress",
      ascii(a.parent2Address || studentAddr, 200),
    );
    if (a.parent2Telephone) {
      out = setEmptyTag(out, "parentTelephone", ascii(a.parent2Telephone, 40));
    }
  }

  if (a.custodianFamilyName) {
    out = setEmptyTag(out, "FamilyName", ascii(a.custodianFamilyName));
    out = setEmptyTag(out, "GivenNames", ascii(a.custodianGivenName));
    if (a.custodianStatus) {
      out = setEmptyTag(out, "statusGroup", ascii(a.custodianStatus, 40));
    }
    if (a.custodianDob) out = setEmptyTag(out, "theDate", ascii(a.custodianDob, 20));
    if (a.custodianAddress) {
      out = setEmptyTag(out, "Address", ascii(a.custodianAddress, 200));
    }
    if (a.custodianTelephone) {
      out = setEmptyTag(out, "Telephone", ascii(a.custodianTelephone, 40));
    }
    out = setEmptyTag(
      out,
      "nameCustodian",
      ascii(`${a.custodianGivenName || ""} ${a.custodianFamilyName}`.trim()),
    );
  }
  out = setEmptyTag(
    out,
    "nameStudent",
    ascii(`${a.givenName} ${a.familyName}`.trim()),
  );
  if (a.parent1FamilyName) {
    out = setEmptyTag(
      out,
      "nameParent1",
      ascii(`${a.parent1GivenName || ""} ${a.parent1FamilyName}`.trim()),
    );
  }
  if (a.parent2FamilyName) {
    out = setEmptyTag(
      out,
      "nameParent2",
      ascii(`${a.parent2GivenName || ""} ${a.parent2FamilyName}`.trim()),
    );
  }
  if (a.city) out = setEmptyTag(out, "swornCity", ascii(a.city));
  if (a.provinceState) out = setEmptyTag(out, "swornProv", ascii(a.provinceState, 40));
  if (a.country) out = setEmptyTag(out, "swornCountry", ascii(a.country));
  const now = new Date();
  out = setEmptyTag(out, "swornDay", String(now.getDate()).padStart(2, "0"));
  out = setEmptyTag(out, "swornMonth", String(now.getMonth() + 1).padStart(2, "0"));
  out = setEmptyTag(out, "swornYear", String(now.getFullYear()));

  // Page 2 student block (remaining empties)
  out = fillStudentBlock(out);
  return out;
}

export function patchImm5483(xml: string, a: KitAnswers): string {
  const selected = new Set(a.forms.map((f) => f.toLowerCase()));
  let out = xml.replace(
    /<formsList\n>([\s\S]*?)<\/formsList\n>/,
    (block) => {
      let b = block;
      b = setCheckbox(b, "s1", selected.has("imm1294"));
      b = setCheckbox(b, "s2", selected.has("imm5707") || selected.has("imm5646"));
      b = setCheckbox(b, "s3", selected.has("imm5476"));
      b = setCheckbox(b, "s4", selected.has("imm5475"));
      b = setCheckbox(b, "s5", selected.has("imm5409"));
      b = setCheckbox(b, "s6", selected.has("imm5646"));
      return b;
    },
  );
  out = out.replace(
    /<documentsList\n>([\s\S]*?)<\/documentsList\n>/,
    (block) => {
      let b = block;
      // Typical outside-Canada study kit docs the applicant should prepare.
      for (const key of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]) {
        b = setCheckbox(b, key, true);
      }
      return b;
    },
  );
  return out;
}

function replaceXhtmlFamilyName(xml: string, value: string, occurrence = 0): string {
  let count = 0;
  return xml.replace(
    /<familyName\n><body[\s\S]*?<\/familyName\n>/g,
    (match) => {
      if (count++ !== occurrence) return match;
      return `<familyName\n>${ascii(value)}</familyName\n>`;
    },
  );
}

export function patchImm5476(xml: string, a: KitAnswers): string {
  let out = xml;
  const today = todayYmd();
  out = setEmptyTag(out, "RadioButtonList", "1");
  out = replaceXhtmlFamilyName(out, a.familyName, 0);
  out = setEmptyTag(out, "givenName", ascii(a.givenName));
  out = setEmptyTag(out, "DOB", ymd(a));
  out = setEmptyTag(out, "application", "Study permit");
  if (a.repFamilyName) {
    out = replaceXhtmlFamilyName(out, a.repFamilyName, 1);
    out = setEmptyTag(out, "givenName", ascii(a.repGivenName));
  }
  if (a.repOrganization) out = setEmptyTag(out, "organization", ascii(a.repOrganization));
  if (a.repMembershipId) out = setEmptyTag(out, "membershipID", ascii(a.repMembershipId, 40));
  if (a.repStreetNum) out = setEmptyTag(out, "streetNo", ascii(a.repStreetNum, 20));
  if (a.repStreetName) out = setEmptyTag(out, "streetName", ascii(a.repStreetName));
  if (a.repCity) out = setEmptyTag(out, "city", ascii(a.repCity));
  if (a.repProvince) out = setEmptyTag(out, "province", ascii(a.repProvince, 40));
  if (a.repCountry) out = setEmptyTag(out, "country", ascii(a.repCountry));
  if (a.repPostalCode) out = setEmptyTag(out, "postalcode", ascii(a.repPostalCode, 20));
  if (a.repPhoneCountryCode) {
    out = setEmptyTag(out, "phoneCountryCode", ascii(a.repPhoneCountryCode, 6));
  }
  if (a.repPhone) out = setEmptyTag(out, "phoneNumber", ascii(a.repPhone, 40));
  if (a.repEmail) out = setEmptyTag(out, "email", ascii(a.repEmail, 80));
  out = setEmptyTag(out, "dateSigned", today);
  out = setEmptyTag(out, "dateApplicantSigned", today);
  // Section C/D echo of rep identity for appointment confirmation blocks
  if (a.repFamilyName) {
    out = replaceXhtmlFamilyName(out, a.repFamilyName, 2);
    out = setEmptyTag(out, "givenName", ascii(a.repGivenName));
    if (a.repOrganization) out = setEmptyTag(out, "organization", ascii(a.repOrganization));
  }
  return out;
}

export function patchImm5475(xml: string, a: KitAnswers): string {
  let out = xml;
  const today = todayYmd();
  out = setEmptyTag(out, "RadioButtonList", "1");
  out = setEmptyTag(out, "AppFamily", ascii(a.familyName));
  out = setEmptyTag(out, "AppGiven", ascii(a.givenName));
  out = setEmptyTag(out, "currentDate", ymd(a)); // DOB field nested oddly as currentDate under DOB
  if (a.designeeFamilyName) {
    // First TextField2 blocks are often relationship / purpose — fill relationship early
    if (a.designeeRelationship) {
      out = setEmptyTag(out, "TextField2", ascii(a.designeeRelationship));
    }
    out = setEmptyTag(out, "AppFamily", ascii(a.designeeFamilyName));
    out = setEmptyTag(out, "AppGiven", ascii(a.designeeGivenName || ""));
  }
  if (a.streetNum) out = setEmptyTag(out, "Number", ascii(a.streetNum, 20));
  if (a.streetName) out = setEmptyTag(out, "homeAddress", ascii(a.streetName));
  if (a.city) out = setEmptyTag(out, "city", ascii(a.city));
  if (a.provinceState) out = setEmptyTag(out, "province", ascii(a.provinceState, 40));
  if (a.postalCode) out = setEmptyTag(out, "postalCode", ascii(a.postalCode, 20));
  if (a.phone) out = setEmptyTag(out, "Rphone", ascii(a.phone, 40));
  out = setEmptyTag(out, "currentDate", today);
  return out;
}

export function patchImm5409(xml: string, a: KitAnswers): string {
  let out = xml;
  out = setEmptyTag(out, "Country", ascii(a.commonLawCountry || a.country || "Canada"));
  out = setEmptyTag(out, "Province", ascii(a.commonLawProvince || a.provinceState, 40));
  out = setEmptyTag(out, "FirstName", ascii(a.givenName));
  out = setEmptyTag(out, "SecondName", ascii(a.familyName));
  if (a.commonLawCity) out = setEmptyTag(out, "City", ascii(a.commonLawCity));
  if (a.commonLawProvince) {
    out = setEmptyTag(out, "Province", ascii(a.commonLawProvince, 40));
  }
  if (a.commonLawCountry) {
    out = setEmptyTag(out, "Country", ascii(a.commonLawCountry));
  }
  if (a.yearsTogether) out = setEmptyTag(out, "YearsTogether", ascii(a.yearsTogether, 10));
  if (a.commonLawStart) out = setEmptyTag(out, "startDate", ascii(a.commonLawStart, 20));
  out = setEmptyTag(out, "endDate", "Present");
  // Section1 cohabitation evidence checkboxes — mark first two as yes when we have years
  if (a.yearsTogether) {
    out = setEmptyTag(out, "yesno", "Y");
    out = setEmptyTag(out, "yesno", "Y");
  }
  out = setEmptyTag(out, "NameDecl", `${ascii(a.givenName)} ${ascii(a.familyName)}`);
  if (a.partnerGivenName || a.partnerFamilyName) {
    out = setEmptyTag(
      out,
      "NamePartner",
      `${ascii(a.partnerGivenName)} ${ascii(a.partnerFamilyName)}`.trim(),
    );
  }
  if (a.commonLawCity) out = setEmptyTag(out, "City", ascii(a.commonLawCity));
  return out;
}

export function selectForms(input: {
  hasRepresentative?: boolean;
  hasDesignee?: boolean;
  isCommonLaw?: boolean;
  needsCustodian?: boolean;
  /** @deprecated use needsCustodian; kept for older drafts */
  includeImm5707?: boolean;
}): string[] {
  // Core outside-Canada study kit: application + family info + checklist.
  // IMM 5646 is custodianship (minors), not family information.
  const forms = ["imm1294", "imm5707", "imm5483"];
  if (input.hasRepresentative) forms.push("imm5476");
  if (input.hasDesignee) forms.push("imm5475");
  if (input.isCommonLaw) forms.push("imm5409");
  if (input.needsCustodian) forms.push("imm5646");
  return forms;
}

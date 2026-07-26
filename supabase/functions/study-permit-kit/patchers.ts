import {
  setCheckbox,
  setEmptyTag,
  setNthEmptyTag,
} from "./xfa_incremental.ts";

export type KitAnswers = {
  email: string;
  formLanguage: "e" | "f";
  // routing
  forms: string[]; // e.g. ["imm1294","imm5646","imm5483",...]
  // shared identity
  familyName: string;
  givenName: string;
  sex?: string;
  dobYear: string;
  dobMonth: string;
  dobDay: string;
  citizenship?: string;
  placeBirthCountry?: string;
  placeBirthCity?: string;
  // contact
  emailContact?: string;
  phone?: string;
  phoneCountryCode?: string;
  streetNum?: string;
  streetName?: string;
  city?: string;
  provinceState?: string;
  country?: string;
  postalCode?: string;
  // study / 1294 passthrough extras
  imm1294?: Record<string, unknown>;
  // family / custodian
  parent1FamilyName?: string;
  parent1GivenName?: string;
  parent2FamilyName?: string;
  parent2GivenName?: string;
  // representative
  hasRepresentative?: boolean;
  repFamilyName?: string;
  repGivenName?: string;
  repOrganization?: string;
  repEmail?: string;
  repPhone?: string;
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
  includeImm5707?: boolean;
  partnerGivenName?: string;
  partnerFamilyName?: string;
  yearsTogether?: string;
  commonLawCity?: string;
  commonLawProvince?: string;
  commonLawCountry?: string;
};

function ymd(a: KitAnswers): string {
  return `${a.dobYear}-${a.dobMonth}-${a.dobDay}`;
}

function ascii(s: string | undefined, max = 120): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, max);
}

export function patchImm5646(xml: string, a: KitAnswers): string {
  let out = xml;
  // Page1 student block — first occurrences
  out = setEmptyTag(out, "FamilyName", ascii(a.familyName));
  out = setEmptyTag(out, "GivenNames", ascii(a.givenName));
  if (a.citizenship) out = setEmptyTag(out, "Citizenship", ascii(a.citizenship));
  out = setEmptyTag(out, "theDate", ymd(a));
  const addr = [a.streetNum, a.streetName, a.city, a.provinceState, a.country, a.postalCode]
    .filter(Boolean)
    .join(", ");
  if (addr) out = setEmptyTag(out, "studentAddress", ascii(addr, 200));
  if (a.sex === "Male" || a.sex === "Female") {
    out = setEmptyTag(out, "mfGroup", a.sex === "Male" ? "M" : "F");
  }
  if (a.parent1FamilyName) {
    out = setEmptyTag(out, "parentFamilyName", ascii(a.parent1FamilyName));
    out = setEmptyTag(out, "parentGivenNames", ascii(a.parent1GivenName));
  }
  if (a.parent2FamilyName) {
    // second Parent block
    out = setNthEmptyTag(out, "parentFamilyName", ascii(a.parent2FamilyName), 1);
    out = setNthEmptyTag(out, "parentGivenNames", ascii(a.parent2GivenName || ""), 1);
  }
  return out;
}

export function patchImm5483(xml: string, a: KitAnswers): string {
  const selected = new Set(a.forms.map((f) => f.toLowerCase()));
  let out = xml.replace(
    /<formsList\n>([\s\S]*?)<\/formsList\n>/,
    (block) => {
      let b = block;
      b = setCheckbox(b, "s1", selected.has("imm1294"));
      b = setCheckbox(b, "s2", selected.has("imm5646") || selected.has("imm5707"));
      b = setCheckbox(b, "s3", selected.has("imm5476"));
      b = setCheckbox(b, "s4", selected.has("imm5475"));
      b = setCheckbox(b, "s5", selected.has("imm5409"));
      b = setCheckbox(b, "s6", true);
      return b;
    },
  );
  out = out.replace(
    /<documentsList\n>([\s\S]*?)<\/documentsList\n>/,
    (block) => {
      let b = block;
      // Passport, LOA, proof of funds, photo, biometrics — demo defaults
      for (const key of ["s1", "s2", "s3", "s4", "s5"]) {
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
  out = setEmptyTag(out, "RadioButtonList", "1");
  out = replaceXhtmlFamilyName(out, a.familyName, 0);
  out = setEmptyTag(out, "givenName", ascii(a.givenName));
  out = setEmptyTag(out, "DOB", ymd(a));
  out = setEmptyTag(out, "application", "Study permit");
  if (a.repFamilyName) {
    out = replaceXhtmlFamilyName(out, a.repFamilyName, 1);
    // Next empty givenName is Section B (Section A already filled above).
    out = setEmptyTag(out, "givenName", ascii(a.repGivenName));
  }
  if (a.repOrganization) out = setEmptyTag(out, "organization", ascii(a.repOrganization));
  if (a.repEmail) out = setEmptyTag(out, "email", ascii(a.repEmail, 80));
  if (a.repPhone) out = setEmptyTag(out, "phoneNumber", ascii(a.repPhone, 40));
  if (a.repCity) out = setEmptyTag(out, "city", ascii(a.repCity));
  if (a.repProvince) out = setEmptyTag(out, "province", ascii(a.repProvince, 40));
  if (a.repCountry) out = setEmptyTag(out, "country", ascii(a.repCountry));
  if (a.repPostalCode) out = setEmptyTag(out, "postalcode", ascii(a.repPostalCode, 20));
  return out;
}

export function patchImm5475(xml: string, a: KitAnswers): string {
  let out = xml;
  out = setEmptyTag(out, "RadioButtonList", "1");
  out = setEmptyTag(out, "AppFamily", ascii(a.familyName));
  out = setEmptyTag(out, "AppGiven", ascii(a.givenName));
  out = setEmptyTag(out, "currentDate", ymd(a));
  if (a.designeeFamilyName) {
    out = setNthEmptyTag(out, "AppFamily", ascii(a.designeeFamilyName), 1);
    out = setNthEmptyTag(out, "AppGiven", ascii(a.designeeGivenName || ""), 1);
  }
  if (a.designeeRelationship) {
    out = setEmptyTag(out, "TextField2", ascii(a.designeeRelationship));
  }
  if (a.city) out = setEmptyTag(out, "city", ascii(a.city));
  if (a.provinceState) out = setEmptyTag(out, "province", ascii(a.provinceState, 40));
  if (a.postalCode) out = setEmptyTag(out, "postalCode", ascii(a.postalCode, 20));
  if (a.phone) out = setEmptyTag(out, "Rphone", ascii(a.phone, 40));
  return out;
}

export function patchImm5409(xml: string, a: KitAnswers): string {
  let out = xml;
  out = setEmptyTag(out, "FirstName", ascii(a.givenName));
  out = setEmptyTag(out, "SecondName", ascii(a.familyName));
  if (a.partnerGivenName) {
    // NamePartner later; also put partner in Second section fields where applicable
    out = setEmptyTag(out, "NamePartner", `${ascii(a.partnerGivenName)} ${ascii(a.partnerFamilyName)}`);
  }
  if (a.yearsTogether) out = setEmptyTag(out, "YearsTogether", ascii(a.yearsTogether, 10));
  if (a.commonLawCity) out = setEmptyTag(out, "City", ascii(a.commonLawCity));
  if (a.commonLawProvince) {
    out = setEmptyTag(out, "Province", ascii(a.commonLawProvince, 40));
  }
  if (a.commonLawCountry) {
    out = setEmptyTag(out, "Country", ascii(a.commonLawCountry));
  }
  out = setEmptyTag(out, "NameDecl", `${ascii(a.givenName)} ${ascii(a.familyName)}`);
  return out;
}

export function patchImm5707(xml: string, a: KitAnswers): string {
  let out = xml;
  out = setEmptyTag(out, "FamilyName", ascii(a.familyName));
  out = setEmptyTag(out, "GivenNames", ascii(a.givenName));
  out = setEmptyTag(out, "DOB", ymd(a));
  if (a.placeBirthCountry) out = setEmptyTag(out, "COB", ascii(a.placeBirthCountry));
  return out;
}

export function selectForms(input: {
  hasRepresentative?: boolean;
  hasDesignee?: boolean;
  isCommonLaw?: boolean;
  includeImm5707?: boolean;
}): string[] {
  const forms = ["imm1294", "imm5646", "imm5483"];
  if (input.hasRepresentative) forms.push("imm5476");
  if (input.hasDesignee) forms.push("imm5475");
  if (input.isCommonLaw) forms.push("imm5409");
  if (input.includeImm5707) forms.push("imm5707");
  return forms;
}

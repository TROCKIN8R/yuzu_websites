/**
 * Fill all selected IRCC study-permit kit forms from shared answers.
 */
import JSZip from "npm:jszip@3.10.1";
import { fillImm1294Pdf, type Imm1294Answers } from "../imm1294-filler/fill.ts";
import formMeta from "./form-meta.json" with { type: "json" };
import {
  type KitAnswers,
  patchImm5409,
  patchImm5475,
  patchImm5476,
  patchImm5483,
  patchImm5646,
  patchImm5707,
  selectForms,
} from "./patchers.ts";
import { fillXfaDatasetsIncremental, type FormMeta } from "./xfa_incremental.ts";

const SITE_URL = "https://yuzu.solutions";
const FORM_CODES = [
  "imm1294",
  "imm5646",
  "imm5483",
  "imm5476",
  "imm5475",
  "imm5409",
  "imm5707",
] as const;

export type FormCode = (typeof FORM_CODES)[number];

export type FilledForm = {
  code: FormCode;
  filename: string;
  bytes: Uint8Array;
};

const blankCache = new Map<string, Uint8Array>();

function langSuffix(lang: "e" | "f"): "e" | "f" {
  return lang === "f" ? "f" : "e";
}

function metaKey(code: FormCode, lang: "e" | "f"): string {
  return `${code}${langSuffix(lang)}`;
}

async function loadBlank(code: FormCode, lang: "e" | "f"): Promise<Uint8Array> {
  const key = metaKey(code, lang);
  const cached = blankCache.get(key);
  if (cached) return cached;

  const localCandidates = [
    new URL(`../../yuzu_github_page/assets/forms/ircc/blanks/${key}.pdf`, import.meta.url),
    new URL(`../imm1294-filler/${key === "imm1294f" ? "imm1294f.pdf" : key + ".pdf"}`, import.meta.url),
  ];
  for (const url of localCandidates) {
    try {
      const bytes = await Deno.readFile(url);
      if (bytes.byteLength > 1000) {
        blankCache.set(key, bytes);
        return bytes;
      }
    } catch {
      // try next
    }
  }

  const remoteCandidates = [
    Deno.env.get(`IRCC_BLANK_${key.toUpperCase()}_URL`)?.trim(),
    `${SITE_URL}/assets/forms/ircc/blanks/${key}.pdf`,
    `https://raw.githubusercontent.com/TROCKIN8R/yuzu_websites/main/yuzu_github_page/assets/forms/ircc/blanks/${key}.pdf`,
  ].filter((u): u is string => Boolean(u));

  let lastError = "No blank PDF source";
  for (const url of remoteCandidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = `HTTP ${response.status} for ${url}`;
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1000) {
        lastError = "Blank PDF too small";
        continue;
      }
      blankCache.set(key, bytes);
      return bytes;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`Could not load blank ${key}: ${lastError}`);
}

function pad2(v: string, fallback = ""): string {
  const d = v.replace(/\D/g, "").slice(0, 2);
  if (!d) return fallback;
  return d.padStart(2, "0");
}

function toImm1294Answers(a: KitAnswers): Imm1294Answers {
  const bag = { ...(a as Record<string, unknown>), ...(a.imm1294 || {}) } as Record<string, unknown>;
  const str = (k: string, fallback = "") => String(bag[k] ?? fallback).trim();
  const yn = (k: string, fallback: "Y" | "N" = "N"): "Y" | "N" => {
    const v = str(k, fallback).toUpperCase();
    return v === "Y" || v === "YES" || v === "TRUE" || v === "1" ? "Y" : "N";
  };
  const year = (k: string, fallback = "") => str(k, fallback).replace(/\D/g, "").slice(0, 4);
  const month = (k: string, fallback = "") => pad2(str(k, fallback), fallback);
  const day = (k: string, fallback = "") => pad2(str(k, fallback), fallback);

  const sexRaw = str("sex", a.sex || "Female");
  const sex = (["Male", "Female", "Unknown"].includes(sexRaw) ? sexRaw : "Female") as
    Imm1294Answers["sex"];

  const previousCor = yn("previousCor", "N");
  const previousCorRows: NonNullable<Imm1294Answers["previousCorRows"]> = [];
  if (previousCor === "Y") {
    const fromArray = Array.isArray(bag.previousCorRows) ? bag.previousCorRows as Record<string, unknown>[] : [];
    if (fromArray.length) {
      for (const row of fromArray.slice(0, 2)) {
        if (!String(row.country || "").trim()) continue;
        previousCorRows.push({
          country: String(row.country || "").trim(),
          status: String(row.status || "").trim(),
          other: String(row.other || "").trim() || undefined,
          fromYear: String(row.fromYear || "").replace(/\D/g, "").slice(0, 4),
          fromMonth: pad2(String(row.fromMonth || ""), "01"),
          fromDay: pad2(String(row.fromDay || ""), "01"),
          toYear: String(row.toYear || "").replace(/\D/g, "").slice(0, 4),
          toMonth: pad2(String(row.toMonth || ""), "01"),
          toDay: pad2(String(row.toDay || ""), "01"),
        });
      }
    } else if (str("pcor1Country")) {
      previousCorRows.push({
        country: str("pcor1Country"),
        status: str("pcor1Status"),
        other: str("pcor1Other") || undefined,
        fromYear: year("pcor1FromYear"),
        fromMonth: month("pcor1FromMonth", "01"),
        fromDay: day("pcor1FromDay", "01"),
        toYear: year("pcor1ToYear"),
        toMonth: month("pcor1ToMonth", "01"),
        toDay: day("pcor1ToDay", "01"),
      });
      if (str("pcor2Country")) {
        previousCorRows.push({
          country: str("pcor2Country"),
          status: str("pcor2Status"),
          other: str("pcor2Other") || undefined,
          fromYear: year("pcor2FromYear"),
          fromMonth: month("pcor2FromMonth", "01"),
          fromDay: day("pcor2FromDay", "01"),
          toYear: year("pcor2ToYear"),
          toMonth: month("pcor2ToMonth", "01"),
          toDay: day("pcor2ToDay", "01"),
        });
      }
    }
  }

  const sameAsCor = yn("sameAsCor", "Y");
  const sameAsMailing = yn("sameAsMailing", "Y");
  const previouslyMarried = yn("previouslyMarried", "N");
  const educationIndicator = yn("educationIndicator", "N");
  const hasAlias = yn("hasAlias", "N");
  const hasNatId = yn("hasNatId", "N");
  const hasUsCard = yn("hasUsCard", "N");

  type JobIn = {
    fromYear?: unknown;
    fromMonth?: unknown;
    toYear?: unknown;
    toMonth?: unknown;
    occupation?: unknown;
    employer?: unknown;
    city?: unknown;
    country?: unknown;
    provinceState?: unknown;
  };
  const jobsRaw = Array.isArray(bag.jobs) ? (bag.jobs as JobIn[]).slice(0, 3) : [];
  const jobs: Imm1294Answers["jobs"] = (jobsRaw.length
    ? jobsRaw
    : [{
      fromYear: str("occupationFromYear", "2022"),
      fromMonth: str("occupationFromMonth", "09"),
      occupation: str("occupation", "Student"),
      employer: str("employer", str("schoolName", "University of Toronto")),
      city: str("occupationCity", a.city || "Paris"),
      country: str("occupationCountry", a.country || "022"),
      provinceState: str("occupationProvince") || undefined,
    }]).map((row) => {
    const fromYear = String(row.fromYear || "2022").replace(/\D/g, "").slice(0, 4) || "2022";
    const fromMonth = pad2(String(row.fromMonth || "09"), "09");
    const toYear = String(row.toYear || "").replace(/\D/g, "").slice(0, 4);
    const toMonth = pad2(String(row.toMonth || ""), "");
    return {
      fromYear,
      fromMonth,
      ...(toYear && toMonth ? { toYear, toMonth } : {}),
      occupation: String(row.occupation || "Student").trim(),
      employer: String(row.employer || str("schoolName", "University of Toronto")).trim(),
      city: String(row.city || a.city || "Paris").trim(),
      country: String(row.country || a.country || "022").trim(),
      provinceState: String(row.provinceState || "").trim() || undefined,
    };
  });

  return {
    email: a.email,
    familyName: a.familyName,
    givenName: a.givenName,
    sex,
    dobYear: a.dobYear,
    dobMonth: a.dobMonth.padStart(2, "0"),
    dobDay: a.dobDay.padStart(2, "0"),
    placeBirthCity: str("placeBirthCity", a.placeBirthCity || "Paris"),
    placeBirthCountry: str("placeBirthCountry", a.placeBirthCountry || "022"),
    citizenship: str("citizenship", a.citizenship || "022"),
    maritalStatus: str("maritalStatus", a.isCommonLaw ? "03" : "02"),
    spouseFamilyName: str("spouseFamilyName", a.partnerFamilyName || "") || undefined,
    spouseGivenName: str("spouseGivenName", a.partnerGivenName || "") || undefined,
    marriageYear: year("marriageYear") || undefined,
    marriageMonth: month("marriageMonth") || undefined,
    marriageDay: day("marriageDay") || undefined,
    currentCountry: str("currentCountry", a.country || "022"),
    currentStatus: str("currentStatus", "01"),
    corFromYear: year("corFromYear") || undefined,
    corFromMonth: month("corFromMonth") || undefined,
    corFromDay: day("corFromDay") || undefined,
    corToYear: year("corToYear") || undefined,
    corToMonth: month("corToMonth") || undefined,
    corToDay: day("corToDay") || undefined,
    corOther: str("corOther") || undefined,
    previousCor,
    previousCorRows,
    sameAsCor,
    cwaRow: sameAsCor === "N"
      ? {
        country: str("cwaCountry"),
        status: str("cwaStatus"),
        other: str("cwaOther") || undefined,
        fromYear: year("cwaFromYear"),
        fromMonth: month("cwaFromMonth", "01"),
        fromDay: day("cwaFromDay", "01"),
        toYear: year("cwaToYear"),
        toMonth: month("cwaToMonth", "01"),
        toDay: day("cwaToDay", "01"),
      }
      : undefined,
    previouslyMarried,
    prevSpouse: previouslyMarried === "Y"
      ? {
        familyName: str("prevSpouseFamilyName"),
        givenName: str("prevSpouseGivenName"),
        dobYear: year("prevSpouseDobYear"),
        dobMonth: month("prevSpouseDobMonth", "01"),
        dobDay: day("prevSpouseDobDay", "01"),
        relationshipType: str("prevSpouseRelationship"),
        fromYear: year("prevSpouseFromYear"),
        fromMonth: month("prevSpouseFromMonth", "01"),
        fromDay: day("prevSpouseFromDay", "01"),
        toYear: year("prevSpouseToYear"),
        toMonth: month("prevSpouseToMonth", "01"),
        toDay: day("prevSpouseToDay", "01"),
      }
      : undefined,
    hasAlias,
    aliasFamilyName: str("aliasFamilyName") || undefined,
    aliasGivenName: str("aliasGivenName") || undefined,
    hasNatId,
    natIdNumber: str("natIdNumber") || undefined,
    natIdCountry: str("natIdCountry") || undefined,
    natIdIssueYear: year("natIdIssueYear") || undefined,
    natIdIssueMonth: month("natIdIssueMonth") || undefined,
    natIdIssueDay: day("natIdIssueDay") || undefined,
    natIdExpiryYear: year("natIdExpiryYear") || undefined,
    natIdExpiryMonth: month("natIdExpiryMonth") || undefined,
    natIdExpiryDay: day("natIdExpiryDay") || undefined,
    hasUsCard,
    usCardNumber: str("usCardNumber") || undefined,
    usCardExpiryYear: year("usCardExpiryYear") || undefined,
    usCardExpiryMonth: month("usCardExpiryMonth") || undefined,
    usCardExpiryDay: day("usCardExpiryDay") || undefined,
    passportNumber: str("passportNumber", "12AB34567"),
    passportCountry: str("passportCountry", a.citizenship || "022"),
    passportIssueYear: str("passportIssueYear", "2020"),
    passportIssueMonth: month("passportIssueMonth", "06"),
    passportIssueDay: day("passportIssueDay", "15"),
    passportExpiryYear: str("passportExpiryYear", "2030"),
    passportExpiryMonth: month("passportExpiryMonth", "06"),
    passportExpiryDay: day("passportExpiryDay", "15"),
    nativeLang: str("nativeLang", "002"),
    ableToCommunicate: (["English", "French", "Both", "Neither"].includes(str("ableToCommunicate"))
      ? str("ableToCommunicate")
      : "Both") as Imm1294Answers["ableToCommunicate"],
    preferredLang: (str("preferredLang", a.formLanguage === "f" ? "French" : "English") === "French"
      ? "French"
      : "English"),
    langTest: yn("langTest", "N"),
    streetNum: str("streetNum", a.streetNum || "10"),
    streetName: str("streetName", a.streetName || "Rue de Rivoli"),
    city: str("city", a.city || "Paris"),
    country: str("country", a.country || "022"),
    provinceState: str("provinceState", a.provinceState || ""),
    postalCode: str("postalCode", a.postalCode || "75001"),
    sameAsMailing,
    residential: sameAsMailing === "N"
      ? {
        streetNum: str("resStreetNum", "1"),
        streetName: str("resStreetName"),
        city: str("resCity"),
        country: str("resCountry"),
        provinceState: str("resProvinceState") || undefined,
        postalCode: str("resPostalCode"),
        aptUnit: str("resAptUnit") || undefined,
      }
      : undefined,
    phone: str("phone", a.phone || "0612345678"),
    phoneType: str("phoneType", "02"),
    phoneCountryCode: str("phoneCountryCode", a.phoneCountryCode || "33"),
    schoolName: str("schoolName", "University of Toronto"),
    studyLevel: str("studyLevel", "05"),
    fieldOfStudy: str("fieldOfStudy", "08"),
    schoolProvince: str("schoolProvince", "ON"),
    schoolCity: str("schoolCity", "Toronto"),
    schoolAddress: str("schoolAddress", "27 King's College Circle"),
    dli: str("dli", "O19332746152"),
    studyFromYear: str("studyFromYear", "2026"),
    studyFromMonth: month("studyFromMonth", "09"),
    studyFromDay: day("studyFromDay", "01"),
    studyToYear: str("studyToYear", "2028"),
    studyToMonth: month("studyToMonth", "04"),
    studyToDay: day("studyToDay", "30"),
    tuitionAmount: str("tuitionAmount", "25000"),
    availableFunds: str("availableFunds", "35000"),
    funds: (["Myself", "Parents", "Other"].includes(str("funds"))
      ? str("funds")
      : "Parents") as Imm1294Answers["funds"],
    fundsOtherPerson: str("fundsOtherPerson") || undefined,
    caqNumber: str("caqNumber") || undefined,
    caqExpiryYear: year("caqExpiryYear") || undefined,
    caqExpiryMonth: month("caqExpiryMonth") || undefined,
    caqExpiryDay: day("caqExpiryDay") || undefined,
    palNumber: str("palNumber") || undefined,
    palExpiryYear: year("palExpiryYear") || undefined,
    palExpiryMonth: month("palExpiryMonth") || undefined,
    palExpiryDay: day("palExpiryDay") || undefined,
    educationIndicator,
    educationRow: educationIndicator === "Y"
      ? {
        fromYear: year("eduFromYear", "2018"),
        fromMonth: month("eduFromMonth", "09"),
        toYear: year("eduToYear", "2022"),
        toMonth: month("eduToMonth", "06"),
        fieldOfStudy: str("eduField", "Business"),
        school: str("eduSchool", "Universite Lyon"),
        city: str("eduCity", a.city || "Lyon"),
        country: str("eduCountry", "022"),
        provinceState: str("eduProvince") || undefined,
      }
      : undefined,
    jobs,
    bgTb: yn("bgTb", "N"),
    bgDisorder: yn("bgDisorder", "N"),
    bgMedicalDetails: str("bgMedicalDetails") || undefined,
    bgOverstay: yn("bgOverstay", "N"),
    bgRefused: yn("bgRefused", "N"),
    bgClaimAsylum: yn("bgClaimAsylum", "N"),
    bgRefusedDetails: str("bgRefusedDetails") || undefined,
    bgCrime: yn("bgCrime", "N"),
    bgCrimeDetails: str("bgCrimeDetails") || undefined,
    bgMilitary: yn("bgMilitary", "N"),
    bgMilitaryDetails: str("bgMilitaryDetails") || undefined,
    bgViolence: yn("bgViolence", "N"),
    bgWitness: yn("bgWitness", "N"),
    cicContactConsent: yn("cicContactConsent", "N"),
    serviceIn: str("serviceIn", a.formLanguage === "f" ? "French" : "English") === "French"
      ? "French"
      : "English",
  };
}

async function fillXfaForm(
  code: Exclude<FormCode, "imm1294">,
  lang: "e" | "f",
  answers: KitAnswers,
): Promise<Uint8Array> {
  const key = metaKey(code, lang);
  const meta = (formMeta as Record<string, FormMeta>)[key];
  if (!meta) throw new Error(`Missing form meta for ${key}`);
  const blank = await loadBlank(code, lang);
  const patchers: Record<string, (xml: string, a: KitAnswers) => string> = {
    imm5646: patchImm5646,
    imm5483: patchImm5483,
    imm5476: patchImm5476,
    imm5475: patchImm5475,
    imm5409: patchImm5409,
    imm5707: patchImm5707,
  };
  const patch = patchers[code];
  if (!patch) throw new Error(`No patcher for ${code}`);
  return fillXfaDatasetsIncremental(blank, meta, (xml) => patch(xml, answers));
}

export function resolveForms(answers: KitAnswers): FormCode[] {
  if (Array.isArray(answers.forms) && answers.forms.length) {
    const allowed = new Set<string>(FORM_CODES);
    const picked = answers.forms
      .map((f) => f.toLowerCase())
      .filter((f): f is FormCode => allowed.has(f));
    if (picked.length) return picked;
  }
  return selectForms({
    hasRepresentative: answers.hasRepresentative,
    hasDesignee: answers.hasDesignee,
    isCommonLaw: answers.isCommonLaw,
    includeImm5707: answers.includeImm5707,
  }) as FormCode[];
}

export async function fillKitForms(answers: KitAnswers): Promise<FilledForm[]> {
  const lang = answers.formLanguage === "f" ? "f" : "e";
  const forms = resolveForms(answers);
  answers.forms = forms;

  const out: FilledForm[] = [];
  for (const code of forms) {
    let bytes: Uint8Array;
    if (code === "imm1294") {
      const blank = await loadBlank("imm1294", lang);
      bytes = await fillImm1294Pdf(blank, toImm1294Answers(answers));
    } else {
      bytes = await fillXfaForm(code, lang, answers);
    }
    const filename = `${code}${lang}_${answers.familyName}_${answers.givenName}.pdf`
      .replace(/[^\w.\-]+/g, "_");
    out.push({ code, filename, bytes });
  }
  return out;
}

export async function zipFilledForms(forms: FilledForm[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const form of forms) {
    zip.file(form.filename, form.bytes);
  }
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return buf;
}

export { selectForms, FORM_CODES };

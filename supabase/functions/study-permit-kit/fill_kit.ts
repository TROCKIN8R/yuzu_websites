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

function toImm1294Answers(a: KitAnswers): Imm1294Answers {
  const extra = (a.imm1294 || {}) as Record<string, unknown>;
  const str = (k: string, fallback = "") =>
    String(extra[k] ?? (a as Record<string, unknown>)[k] ?? fallback).trim();
  const yn = (k: string, fallback: "Y" | "N" = "N"): "Y" | "N" => {
    const v = str(k, fallback).toUpperCase();
    return v === "Y" || v === "YES" ? "Y" : "N";
  };

  const sexRaw = str("sex", a.sex || "Female");
  const sex = (["Male", "Female", "Unknown"].includes(sexRaw) ? sexRaw : "Female") as
    Imm1294Answers["sex"];

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
    marriageYear: str("marriageYear") || undefined,
    marriageMonth: str("marriageMonth") || undefined,
    marriageDay: str("marriageDay") || undefined,
    currentCountry: str("currentCountry", a.country || "022"),
    currentStatus: str("currentStatus", "01"),
    previousCor: yn("previousCor", "N"),
    sameAsCor: yn("sameAsCor", "Y"),
    previouslyMarried: yn("previouslyMarried", "N"),
    hasAlias: yn("hasAlias", "N"),
    hasNatId: yn("hasNatId", "N"),
    hasUsCard: yn("hasUsCard", "N"),
    passportNumber: str("passportNumber", "12AB34567"),
    passportCountry: str("passportCountry", a.citizenship || "022"),
    passportIssueYear: str("passportIssueYear", "2020"),
    passportIssueMonth: str("passportIssueMonth", "06").padStart(2, "0"),
    passportIssueDay: str("passportIssueDay", "15").padStart(2, "0"),
    passportExpiryYear: str("passportExpiryYear", "2030"),
    passportExpiryMonth: str("passportExpiryMonth", "06").padStart(2, "0"),
    passportExpiryDay: str("passportExpiryDay", "15").padStart(2, "0"),
    nativeLang: str("nativeLang", "002"),
    ableToCommunicate: (["English", "French", "Both", "Neither"].includes(str("ableToCommunicate"))
      ? str("ableToCommunicate")
      : "Both") as Imm1294Answers["ableToCommunicate"],
    preferredLang: str("preferredLang", a.formLanguage === "f" ? "French" : "English") as
      | "English"
      | "French",
    langTest: yn("langTest", "N"),
    streetNum: str("streetNum", a.streetNum || "10"),
    streetName: str("streetName", a.streetName || "Rue de Rivoli"),
    city: str("city", a.city || "Paris"),
    country: str("country", a.country || "022"),
    provinceState: str("provinceState", a.provinceState || ""),
    postalCode: str("postalCode", a.postalCode || "75001"),
    sameAsMailing: yn("sameAsMailing", "Y"),
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
    studyFromMonth: str("studyFromMonth", "09").padStart(2, "0"),
    studyFromDay: str("studyFromDay", "01").padStart(2, "0"),
    studyToYear: str("studyToYear", "2028"),
    studyToMonth: str("studyToMonth", "04").padStart(2, "0"),
    studyToDay: str("studyToDay", "30").padStart(2, "0"),
    tuitionAmount: str("tuitionAmount", "25000"),
    availableFunds: str("availableFunds", "35000"),
    funds: (["Myself", "Parents", "Other"].includes(str("funds"))
      ? str("funds")
      : "Parents") as Imm1294Answers["funds"],
    fundsOtherPerson: str("fundsOtherPerson") || undefined,
    educationIndicator: yn("educationIndicator", "N"),
    jobs: [
      {
        fromYear: str("occupationFromYear", "2022"),
        fromMonth: str("occupationFromMonth", "09"),
        occupation: str("occupation", "Student"),
        employer: str("employer", str("schoolName", "University of Toronto")),
        city: str("occupationCity", a.city || "Paris"),
        country: str("occupationCountry", a.country || "022"),
      },
    ],
    bgTb: yn("bgTb", "N"),
    bgDisorder: yn("bgDisorder", "N"),
    bgOverstay: yn("bgOverstay", "N"),
    bgRefused: yn("bgRefused", "N"),
    bgClaimAsylum: yn("bgClaimAsylum", "N"),
    bgCrime: yn("bgCrime", "N"),
    bgMilitary: yn("bgMilitary", "N"),
    bgViolence: yn("bgViolence", "N"),
    bgWitness: yn("bgWitness", "N"),
    cicContactConsent: yn("cicContactConsent", "N"),
    serviceIn: a.formLanguage === "f" ? "French" : "English",
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

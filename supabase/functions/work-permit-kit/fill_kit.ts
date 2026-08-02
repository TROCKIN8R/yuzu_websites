/**
 * Fill all selected IRCC work-permit kit forms from shared answers.
 */
import JSZip from "npm:jszip@3.10.1";
import { validateAnswers as validate1294 } from "../imm1294-filler/validate.ts";
import formMeta from "../_shared/form-meta.json" with { type: "json" };
import { fillImm1295Pdf, type Imm1295Answers } from "./fill_1295.ts";
import { fillImm5710Pdf, type Imm5710Answers } from "./fill_5710.ts";
import {
  type KitAnswers,
  patchImm5409,
  patchImm5475,
  patchImm5476,
  patchImm5488,
  patchImm5556,
  patchImm5707,
  selectForms,
} from "./patchers.ts";
import { validateWorkAnswers } from "./validate.ts";
import { fillXfaDatasetsIncremental, type FormMeta } from "../_shared/xfa_incremental.ts";

const FORM_CODES = [
  "imm1295",
  "imm5710",
  "imm5488",
  "imm5556",
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
const SITE_URL = "https://yuzu.solutions";

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

  const candidates = [
    new URL(`../../../yuzu_github_page/assets/forms/ircc/blanks/${key}.pdf`, import.meta.url),
    new URL(`../../../../yuzu_github_page/assets/forms/ircc/blanks/${key}.pdf`, import.meta.url),
  ];
  if (Deno.env.get("YUZU_REPO_ROOT")) {
    candidates.unshift(
      new URL(`yuzu_github_page/assets/forms/ircc/blanks/${key}.pdf`, `file://${Deno.env.get("YUZU_REPO_ROOT")}/`),
    );
  }
  for (const local of candidates) {
    try {
      const bytes = await Deno.readFile(local);
      if (bytes.byteLength > 1000) {
        blankCache.set(key, bytes);
        return bytes;
      }
    } catch { /* try next */ }
  }

  const url = `${SITE_URL}/assets/forms/ircc/blanks/${key}.pdf`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load blank ${key}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  blankCache.set(key, bytes);
  return bytes;
}

function bag(a: KitAnswers): Record<string, unknown> {
  return { ...(a as Record<string, unknown>), ...(a.primary || {}) };
}

export function flattenForPrimary(a: KitAnswers): Record<string, unknown> {
  const b = bag(a);
  return {
    ...b,
    email: a.email,
    familyName: a.familyName,
    givenName: a.givenName,
    sex: a.sex,
    dobYear: a.dobYear,
    dobMonth: a.dobMonth,
    dobDay: a.dobDay,
    placeBirthCity: a.placeBirthCity || b.placeBirthCity,
    placeBirthCountry: a.placeBirthCountry || b.placeBirthCountry,
    citizenship: a.citizenship || b.citizenship,
    streetNum: a.streetNum || b.streetNum,
    streetName: a.streetName || b.streetName,
    city: a.city || b.city,
    provinceState: a.provinceState || b.provinceState,
    country: a.country || b.country,
    postalCode: a.postalCode || b.postalCode,
    phone: a.phone || b.phone,
    phoneCountryCode: a.phoneCountryCode || b.phoneCountryCode,
    serviceIn: b.serviceIn || (a.formLanguage === "f" ? "French" : "English"),
    preferredLang: b.preferredLang || (a.formLanguage === "f" ? "French" : "English"),
    employerName: a.employerName || b.employerName,
    employerAddress: a.employerAddress || b.employerAddress,
    workProvince: a.workProvince || b.workProvince,
    workCity: a.workCity || b.workCity,
    workLocationAddress: a.workLocationAddress || b.workLocationAddress,
    jobTitle: a.jobTitle || b.jobTitle,
    jobDescription: a.jobDescription || b.jobDescription,
    workFromYear: a.workFromYear || b.workFromYear,
    workFromMonth: a.workFromMonth || b.workFromMonth,
    workFromDay: a.workFromDay || b.workFromDay,
    workToYear: a.workToYear || b.workToYear,
    workToMonth: a.workToMonth || b.workToMonth,
    workToDay: a.workToDay || b.workToDay,
    lmiaNumber: a.lmiaNumber || b.lmiaNumber,
    workPermitType: a.workPermitType || b.workPermitType,
    currentCountry: a.applicationLocation === "inside"
      ? (b.currentCountry || "Canada")
      : b.currentCountry,
  };
}

function toImm1295(a: KitAnswers, validated: Record<string, unknown>): Imm1295Answers {
  const v = validated as Imm1295Answers;
  return {
    ...v,
    workPermitType: String(a.workPermitType || v.workPermitType || "LMOS"),
    employerName: String(a.employerName || v.employerName || ""),
    employerAddress: String(a.employerAddress || v.employerAddress || ""),
    workProvince: String(a.workProvince || v.workProvince || "ON"),
    workCity: String(a.workCity || v.workCity || ""),
    workLocationAddress: String(a.workLocationAddress || v.workLocationAddress || ""),
    jobTitle: String(a.jobTitle || v.jobTitle || ""),
    jobDescription: String(a.jobDescription || v.jobDescription || ""),
    workFromYear: String(a.workFromYear || v.workFromYear || ""),
    workFromMonth: String(a.workFromMonth || v.workFromMonth || ""),
    workFromDay: String(a.workFromDay || v.workFromDay || ""),
    workToYear: String(a.workToYear || v.workToYear || ""),
    workToMonth: String(a.workToMonth || v.workToMonth || ""),
    workToDay: String(a.workToDay || v.workToDay || ""),
    lmiaNumber: String(a.lmiaNumber || v.lmiaNumber || ""),
    lcpChildCare: a.lcpChildCare,
    lcpDisabled: a.lcpDisabled,
    lcpElderly: a.lcpElderly,
    lcpOther: a.lcpOther,
    lcpNoPersons: a.lcpNoPersons,
  };
}

function toImm5710(a: KitAnswers, validated: Record<string, unknown>): Imm5710Answers {
  const v = validated as Imm5710Answers;
  return {
    ...v,
    currentCountry: "511",
    country: v.country || "511",
    applyingRestore: a.applyingRestore,
    applyingExtend: a.applyingExtend,
    applyingNewEmployer: a.applyingNewEmployer,
    applyingTrp: a.applyingTrp,
    origEntryDate: a.origEntryDate,
    origEntryPlace: a.origEntryPlace,
    purposeOfVisit: a.purposeOfVisit,
    recentEntryDate: a.recentEntryDate,
    recentEntryPlace: a.recentEntryPlace,
    prevDocNum: a.prevDocNum,
    employerName: String(a.employerName || v.employerName || ""),
    employerAddress: String(a.employerAddress || v.employerAddress || ""),
    workProvince: String(a.workProvince || v.workProvince || "ON"),
    workCity: String(a.workCity || v.workCity || ""),
    workLocationAddress: String(a.workLocationAddress || v.workLocationAddress || ""),
    jobTitle: String(a.jobTitle || v.jobTitle || ""),
    jobDescription: String(a.jobDescription || v.jobDescription || ""),
    workFromYear: String(a.workFromYear || v.workFromYear || ""),
    workFromMonth: String(a.workFromMonth || v.workFromMonth || ""),
    workFromDay: String(a.workFromDay || v.workFromDay || ""),
    workToYear: String(a.workToYear || v.workToYear || ""),
    workToMonth: String(a.workToMonth || v.workToMonth || ""),
    workToDay: String(a.workToDay || v.workToDay || ""),
    lmiaNumber: String(a.lmiaNumber || v.lmiaNumber || ""),
  };
}

async function fillXfaForm(
  code: Exclude<FormCode, "imm1295" | "imm5710">,
  lang: "e" | "f",
  answers: KitAnswers,
): Promise<Uint8Array> {
  const key = metaKey(code, lang);
  const meta = (formMeta as Record<string, FormMeta>)[key];
  if (!meta) throw new Error(`Missing form meta for ${key}`);
  const blank = await loadBlank(code, lang);
  const patchers: Record<string, (xml: string, a: KitAnswers) => string> = {
    imm5488: patchImm5488,
    imm5556: patchImm5556,
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
    const core = selectForms({
      applicationLocation: answers.applicationLocation,
      hasRepresentative: answers.hasRepresentative,
      hasDesignee: answers.hasDesignee,
      isCommonLaw: answers.isCommonLaw,
    }) as FormCode[];
    const merged = [...new Set<FormCode>([...core, ...picked])];
    if (merged.length) return merged;
  }
  return selectForms({
    applicationLocation: answers.applicationLocation,
    hasRepresentative: answers.hasRepresentative,
    hasDesignee: answers.hasDesignee,
    isCommonLaw: answers.isCommonLaw,
  }) as FormCode[];
}

export async function fillKitForms(answers: KitAnswers): Promise<FilledForm[]> {
  const lang = answers.formLanguage === "f" ? "f" : "e";
  const forms = resolveForms(answers);
  answers.forms = forms;

  const flat = flattenForPrimary(answers);
  const workValidated = validateWorkAnswers(flat);
  if (!workValidated.ok) throw new Error(workValidated.error);

  const immValidated = validate1294({
    ...flat,
    schoolName: flat.employerName,
    studyLevel: "04",
    fieldOfStudy: "04",
    schoolProvince: flat.workProvince,
    schoolCity: flat.workCity,
    schoolAddress: flat.employerAddress,
    dli: "O9999999",
    studyFromYear: flat.workFromYear,
    studyFromMonth: flat.workFromMonth,
    studyFromDay: flat.workFromDay,
    studyToYear: flat.workToYear,
    studyToMonth: flat.workToMonth,
    studyToDay: flat.workToDay,
    tuitionAmount: "0",
    availableFunds: "0",
    funds: "Myself",
  });
  if (!immValidated.ok) throw new Error(immValidated.error);

  const out: FilledForm[] = [];
  const primary = answers.applicationLocation === "inside" ? "imm5710" : "imm1295";

  for (const code of forms) {
    let bytes: Uint8Array;
    if (code === "imm1295") {
      const blank = await loadBlank("imm1295", lang);
      bytes = await fillImm1295Pdf(blank, toImm1295(answers, immValidated.answers), lang);
    } else if (code === "imm5710") {
      const blank = await loadBlank("imm5710", lang);
      bytes = await fillImm5710Pdf(blank, toImm5710(answers, immValidated.answers), lang);
    } else {
      bytes = await fillXfaForm(code, lang, answers);
    }
    if (code === primary) {
      // ensure primary was filled even if not first in list
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
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export { selectForms, FORM_CODES };

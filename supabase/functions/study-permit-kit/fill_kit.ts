/**
 * Fill all selected IRCC study-permit kit forms from shared answers.
 */
import JSZip from "npm:jszip@3.10.1";
import { fillImm1294Pdf } from "../imm1294-filler/fill.ts";
import { validateAnswers } from "../imm1294-filler/validate.ts";
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

/** Flatten kit answers into the IMM 1294 validator payload (no demo defaults). */
export function flattenForImm1294(a: KitAnswers): Record<string, unknown> {
  const bag = { ...(a as Record<string, unknown>), ...(a.imm1294 || {}) };
  return {
    ...bag,
    email: a.email,
    familyName: a.familyName,
    givenName: a.givenName,
    sex: a.sex,
    dobYear: a.dobYear,
    dobMonth: a.dobMonth,
    dobDay: a.dobDay,
    placeBirthCity: a.placeBirthCity || bag.placeBirthCity,
    placeBirthCountry: a.placeBirthCountry || bag.placeBirthCountry,
    citizenship: a.citizenship || bag.citizenship,
    streetNum: a.streetNum || bag.streetNum,
    streetName: a.streetName || bag.streetName,
    city: a.city || bag.city,
    provinceState: a.provinceState || bag.provinceState,
    country: a.country || bag.country,
    postalCode: a.postalCode || bag.postalCode,
    phone: a.phone || bag.phone,
    phoneCountryCode: a.phoneCountryCode || bag.phoneCountryCode,
    serviceIn: bag.serviceIn || (a.formLanguage === "f" ? "French" : "English"),
    preferredLang: bag.preferredLang || (a.formLanguage === "f" ? "French" : "English"),
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
    const core: FormCode[] = ["imm1294", "imm5707", "imm5483"];
    const merged = [...new Set<FormCode>([...core, ...picked])];
    if (merged.length) return merged;
  }
  return selectForms({
    hasRepresentative: answers.hasRepresentative,
    hasDesignee: answers.hasDesignee,
    isCommonLaw: answers.isCommonLaw,
    needsCustodian: answers.needsCustodian,
  }) as FormCode[];
}

export async function fillKitForms(answers: KitAnswers): Promise<FilledForm[]> {
  const lang = answers.formLanguage === "f" ? "f" : "e";
  const forms = resolveForms(answers);
  answers.forms = forms;

  const immValidated = validateAnswers(flattenForImm1294(answers));
  if (!immValidated.ok) {
    throw new Error(immValidated.error);
  }

  const out: FilledForm[] = [];
  for (const code of forms) {
    let bytes: Uint8Array;
    if (code === "imm1294") {
      const blank = await loadBlank("imm1294", lang);
      bytes = await fillImm1294Pdf(blank, immValidated.answers);
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

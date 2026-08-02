/**
 * Smoke test: fill outside (IMM 1295) and inside (IMM 5710) work-permit kit paths.
 *
 * Run: ~/.deno/bin/deno run -A supabase/functions/work-permit-kit/smoke_work.ts
 */
import { extractDatasetsXml } from "../_shared/xfa_incremental.ts";
import formMeta from "../_shared/form-meta.json" with { type: "json" };
import { fillKitForms, type FilledForm } from "./fill_kit.ts";
import type { KitAnswers } from "./patchers.ts";

const OUT_DIR = new URL("../../../scripts/_tmp_work_fields/", import.meta.url);

function baseAnswers(overrides: Partial<KitAnswers> = {}): KitAnswers {
  return {
    email: "smoke.test@example.com",
    formLanguage: "e",
    applicationLocation: "outside",
    forms: [],
    workPermitType: "LMOS",
    familyName: "Martin",
    givenName: "Claire",
    sex: "Female",
    dobYear: "1995",
    dobMonth: "06",
    dobDay: "15",
    citizenship: "France",
    placeBirthCountry: "France",
    placeBirthCity: "Lyon",
    maritalStatus: "02",
    streetNum: "12",
    streetName: "Rue Example",
    city: "Paris",
    provinceState: "ON",
    country: "France",
    postalCode: "75001",
    phone: "612345678",
    phoneCountryCode: "33",
    employerName: "Maple Tech Inc",
    employerAddress: "100 King St W, Toronto ON",
    workProvince: "ON",
    workCity: "Toronto",
    workLocationAddress: "100 King St W",
    jobTitle: "Software Developer",
    jobDescription: "Develop web applications for clients",
    workFromYear: "2026",
    workFromMonth: "09",
    workFromDay: "01",
    workToYear: "2028",
    workToMonth: "08",
    workToDay: "31",
    lmiaNumber: "71234567",
    parent1FamilyName: "Martin",
    parent1GivenName: "Jean",
    parent1Occupation: "Engineer",
    parent2FamilyName: "Martin",
    parent2GivenName: "Sophie",
    parent2Occupation: "Teacher",
    primary: {
      passportNumber: "12AB34567",
      passportCountry: "France",
      passportIssueYear: "2020",
      passportIssueMonth: "01",
      passportIssueDay: "15",
      passportExpiryYear: "2030",
      passportExpiryMonth: "01",
      passportExpiryDay: "14",
      nativeLang: "French",
      ableToCommunicate: "English",
      langTest: "N",
      currentCountry: "France",
      currentStatus: "02",
      previousCor: "N",
      sameAsCor: "Y",
      previouslyMarried: "N",
      hasAlias: "N",
      hasNatId: "N",
      hasUsCard: "N",
      sameAsMailing: "Y",
      phoneType: "02",
      educationIndicator: "N",
      jobs: [{
        fromYear: "2020",
        fromMonth: "06",
        toYear: "2025",
        toMonth: "12",
        occupation: "Developer",
        employer: "Acme SA",
        city: "Paris",
        country: "France",
      }],
      bgTb: "N",
      bgDisorder: "N",
      bgOverstay: "N",
      bgRefused: "N",
      bgClaimAsylum: "N",
      bgCrime: "N",
      bgMilitary: "N",
      bgViolence: "N",
      bgWitness: "N",
      cicContactConsent: "N",
    },
    ...overrides,
  };
}

function assertTag(xml: string, tag: string, label: string) {
  const selfClosing = new RegExp(`<${tag}\\n>[^<\\s][\\s\\S]*?</${tag}\\n>`);
  const nested = new RegExp(`<${tag}\\n><${tag}\\n>[^<\\s]`);
  if (!selfClosing.test(xml) && !nested.test(xml)) {
    throw new Error(`${label}: expected non-empty <${tag}>`);
  }
}

async function assertPrimary(form: FilledForm, tags: string[]) {
  const key = `${form.code}e`;
  const meta = (formMeta as Record<string, { fileKeyHex: string; datasetsObj: number; datasetsGen: number; bytes: number }>)[key];
  if (!meta) throw new Error(`No meta for ${key}`);
  const xml = await extractDatasetsXml(form.bytes, meta);
  const outPath = new URL(`${form.code}e-smoke-filled.xml`, OUT_DIR);
  await Deno.writeTextFile(outPath, xml);
  const pdfPath = new URL(`${form.code}e-smoke-filled.pdf`, OUT_DIR);
  await Deno.writeFile(pdfPath, form.bytes);
  for (const tag of tags) assertTag(xml, tag, form.code);
  console.log(`OK ${form.code}: ${tags.length} tags asserted, wrote ${outPath.pathname}`);
}

const outsideTags1295 = [
  "FamilyName", "GivenName", "Sex", "DOBYear", "Citizenship", "PassportNum",
  "WorkPermitType", "EmployerName", "jobTitle", "posDesc", "LMO", "FromDate", "ToDate",
  "Email", "IntlNumber",
];
const insideTags5710 = [
  "FamilyName", "GivenName", "Sex", "DOBYear", "Citizenship", "PassportNum",
  "Extend", "Name", "Job", "Desc", "LMO", "FromDate", "ToDate",
  "Email", "IntlNumber", "PurposeOfVisit",
];

const outsideAnswers = baseAnswers({ applicationLocation: "outside" });
const insideAnswers = baseAnswers({
  applicationLocation: "inside",
  applyingExtend: true,
  origEntryDate: "2024-01-10",
  origEntryPlace: "Toronto Pearson",
  purposeOfVisit: "Work",
  recentEntryDate: "2025-06-01",
  recentEntryPlace: "Toronto Pearson",
  prevDocNum: "W1234567",
  primary: {
    ...baseAnswers().primary,
    currentCountry: "Canada",
    currentStatus: "03",
    corFromYear: "2024",
    corFromMonth: "01",
    corFromDay: "10",
    corToYear: "2026",
    corToMonth: "01",
    corToDay: "09",
  },
});

console.log("Filling outside-Canada kit (IMM 1295)...");
const outsideForms = await fillKitForms(outsideAnswers);
const imm1295 = outsideForms.find((f) => f.code === "imm1295");
if (!imm1295) throw new Error("IMM 1295 missing from outside kit");
await assertPrimary(imm1295, outsideTags1295);

console.log("Filling inside-Canada kit (IMM 5710)...");
const insideForms = await fillKitForms(insideAnswers);
const imm5710 = insideForms.find((f) => f.code === "imm5710");
if (!imm5710) throw new Error("IMM 5710 missing from inside kit");
await assertPrimary(imm5710, insideTags5710);

console.log("\nAll smoke tests passed.");
console.log(`Outside forms: ${outsideForms.map((f) => f.code).join(", ")}`);
console.log(`Inside forms: ${insideForms.map((f) => f.code).join(", ")}`);

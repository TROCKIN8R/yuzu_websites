/**
 * Local smoke test: fill IMM 1294 for basic + branch-heavy scenarios and
 * assert key XFA dataset fields are present after encrypt/decrypt round-trip.
 *
 * Usage (from repo root):
 *   deno run -A supabase/functions/imm1294-filler/smoke_branches.ts
 */

import {
  extractDatasetsXml,
  fillImm1294Pdf,
  type Imm1294Answers,
} from "./fill.ts";

const ROOT = new URL(".", import.meta.url).pathname;
const PDF_PATH = `${ROOT}imm1294f.pdf`;
const OUT_DIR = `${ROOT}../../../yuzu_github_page/assets/forms`;

function baseAnswers(overrides: Partial<Imm1294Answers> = {}): Imm1294Answers {
  return {
    email: "you@example.com",
    familyName: "Dupont",
    givenName: "Marie Claire",
    sex: "Female",
    dobYear: "1998",
    dobMonth: "04",
    dobDay: "12",
    placeBirthCity: "Lyon",
    placeBirthCountry: "France",
    citizenship: "France",
    maritalStatus: "02",
    currentCountry: "France",
    currentStatus: "01",
    previousCor: "N",
    sameAsCor: "Y",
    previouslyMarried: "N",
    hasAlias: "N",
    hasNatId: "N",
    hasUsCard: "N",
    passportNumber: "12AB34567",
    passportCountry: "France",
    passportIssueYear: "2018",
    passportIssueMonth: "05",
    passportIssueDay: "15",
    passportExpiryYear: "2030",
    passportExpiryMonth: "08",
    passportExpiryDay: "01",
    nativeLang: "French",
    ableToCommunicate: "Both",
    preferredLang: "English",
    langTest: "N",
    streetNum: "10",
    streetName: "Rue de Rivoli",
    city: "Paris",
    country: "France",
    provinceState: "Ile-de-France",
    postalCode: "75001",
    sameAsMailing: "Y",
    phone: "+33612345678",
    phoneType: "02",
    phoneCountryCode: "33",
    schoolName: "McGill University",
    studyLevel: "04",
    fieldOfStudy: "04",
    schoolProvince: "QC",
    schoolCity: "Montreal",
    schoolAddress: "845 Sherbrooke Street West",
    dli: "O19349011030",
    studyFromYear: "2026",
    studyFromMonth: "09",
    studyFromDay: "01",
    studyToYear: "2028",
    studyToMonth: "04",
    studyToDay: "30",
    tuitionAmount: "25000",
    availableFunds: "40000",
    funds: "Parents",
    educationIndicator: "N",
    jobs: [{
      fromYear: "2022",
      fromMonth: "09",
      occupation: "Student",
      employer: "Universite Lyon",
      city: "Lyon",
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
    serviceIn: "English",
    ...overrides,
  };
}

function assertIncludes(xml: string, snippet: string, label: string) {
  if (!xml.includes(snippet)) {
    throw new Error(`Missing ${label}: ${snippet.slice(0, 120)}`);
  }
}

async function runScenario(
  name: string,
  answers: Imm1294Answers,
  checks: (xml: string) => void,
  writeSample = false,
) {
  const blank = await Deno.readFile(PDF_PATH);
  const filled = await fillImm1294Pdf(blank, answers);
  if (filled.length <= blank.length) {
    throw new Error(`${name}: filled PDF not larger than blank`);
  }
  const xml = await extractDatasetsXml(filled);
  checks(xml);

  if (writeSample) {
    await Deno.mkdir(OUT_DIR, { recursive: true });
    const out = `${OUT_DIR}/imm1294-sample-filled.pdf`;
    await Deno.writeFile(out, filled);
    console.log(`Wrote ${out} (${filled.length} bytes)`);
  }
  console.log(`OK  ${name}`);
}

await runScenario("basic", baseAnswers(), (xml) => {
  assertIncludes(xml, "<FamilyName\n>Dupont</FamilyName\n>", "family name");
  assertIncludes(xml, "<PCRIndicator\n>N</PCRIndicator\n>", "no previous COR");
  assertIncludes(xml, "<SameAsMailingIndicator\n>Y</SameAsMailingIndicator\n>", "same mailing");
  assertIncludes(xml, "<expensesPaidBy\n>Parents</expensesPaidBy\n>", "funds");
  assertIncludes(xml, "<Occupation\n><Occupation\n>Student</Occupation\n>", "job1");
  assertIncludes(xml, "<natIDIndicator\n>N</natIDIndicator\n>", "nat ID N");
}, true);

await runScenario(
  "branches",
  baseAnswers({
    hasAlias: "Y",
    aliasFamilyName: "Martin",
    aliasGivenName: "Claire",
    maritalStatus: "01",
    spouseFamilyName: "Bernard",
    spouseGivenName: "Paul",
    marriageYear: "2020",
    marriageMonth: "06",
    marriageDay: "15",
    previousCor: "Y",
    previousCorRows: [
      {
        country: "Spain",
        status: "05",
        fromYear: "2019",
        fromMonth: "01",
        fromDay: "10",
        toYear: "2020",
        toMonth: "12",
        toDay: "31",
      },
      {
        country: "Germany",
        status: "04",
        fromYear: "2021",
        fromMonth: "01",
        fromDay: "01",
        toYear: "2021",
        toMonth: "08",
        toDay: "31",
      },
    ],
    sameAsCor: "N",
    cwaRow: {
      country: "Canada",
      status: "03",
      fromYear: "2025",
      fromMonth: "01",
      fromDay: "01",
      toYear: "2026",
      toMonth: "07",
      toDay: "01",
    },
    previouslyMarried: "Y",
    prevSpouse: {
      familyName: "Petit",
      givenName: "Luc",
      dobYear: "1995",
      dobMonth: "03",
      dobDay: "20",
      relationshipType: "01",
      fromYear: "2016",
      fromMonth: "01",
      fromDay: "01",
      toYear: "2019",
      toMonth: "05",
      toDay: "01",
    },
    hasNatId: "Y",
    natIdNumber: "123456789",
    natIdCountry: "France",
    natIdIssueYear: "2015",
    natIdIssueMonth: "01",
    natIdIssueDay: "01",
    natIdExpiryYear: "2035",
    natIdExpiryMonth: "01",
    natIdExpiryDay: "01",
    sameAsMailing: "N",
    residential: {
      streetNum: "22",
      streetName: "Avenue Victor Hugo",
      city: "Lyon",
      country: "France",
      provinceState: "Auvergne-Rhone-Alpes",
      postalCode: "69006",
    },
    funds: "Other",
    fundsOtherPerson: "Uncle Jean",
    caqNumber: "CAQ123456",
    caqExpiryYear: "2027",
    caqExpiryMonth: "08",
    caqExpiryDay: "31",
    educationIndicator: "Y",
    educationRow: {
      fromYear: "2016",
      fromMonth: "09",
      toYear: "2020",
      toMonth: "06",
      fieldOfStudy: "Computer Science",
      school: "Universite Lyon",
      city: "Lyon",
      country: "France",
    },
    jobs: [
      {
        fromYear: "2022",
        fromMonth: "09",
        occupation: "Student",
        employer: "Universite Lyon",
        city: "Lyon",
        country: "France",
      },
      {
        fromYear: "2020",
        fromMonth: "01",
        toYear: "2022",
        toMonth: "08",
        occupation: "Intern",
        employer: "Acme SA",
        city: "Paris",
        country: "France",
      },
    ],
    bgTb: "Y",
    bgMedicalDetails: "Treated and cleared in 2024",
    bgRefused: "Y",
    bgRefusedDetails: "UK visit visa refused 2017",
  }),
  (xml) => {
    assertIncludes(xml, "<AliasNameIndicator\n><AliasNameIndicator\n>Y</AliasNameIndicator\n>", "alias Y");
    assertIncludes(xml, "Martin", "alias family");
    assertIncludes(xml, "<PCRIndicator\n>Y</PCRIndicator\n>", "previous COR Y");
    assertIncludes(xml, "<PreviousCOR\n>", "previous COR block");
    assertIncludes(xml, "Bernard", "spouse");
    assertIncludes(xml, "Petit", "prev spouse");
    assertIncludes(xml, "Uncle Jean", "funds other");
    assertIncludes(xml, "Avenue Victor Hugo", "residential");
    assertIncludes(xml, "Computer Science", "education");
    assertIncludes(xml, "Intern", "job2");
    assertIncludes(xml, "Treated and cleared", "medical details");
    assertIncludes(xml, "UK visit visa", "refused details");
    assertIncludes(xml, "CAQ123456", "CAQ");
    assertIncludes(xml, "<CountryWhereApplying\n>", "CWA block");
    assertIncludes(xml, "<SameAsCORIndicator\n>N</SameAsCORIndicator\n>", "same as COR N");
  },
);

console.log("All smoke scenarios passed.");

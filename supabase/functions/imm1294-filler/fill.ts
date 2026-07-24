/** Fill IMM1294 XFA datasets by same-length replacement (keeps PDF xref valid). */

export type Imm1294Answers = {
  email: string;
  familyName: string;
  givenName: string;
  sex: "Male" | "Female" | "Unknown";
  dobYear: string;
  dobMonth: string;
  dobDay: string;
  placeBirthCity: string;
  placeBirthCountry: string;
  citizenship: string;
  maritalStatus: string; // lic code 01-06, 00, 09
  currentCountry: string;
  currentStatus: string; // ImmigrationStatus lic
  passportNumber: string;
  passportCountry: string;
  passportExpiryYear: string;
  passportExpiryMonth: string;
  passportExpiryDay: string;
  nativeLang: string;
  ableToCommunicate: "English" | "French" | "Both" | "Neither";
  streetNum: string;
  streetName: string;
  city: string;
  country: string;
  provinceState: string;
  postalCode: string;
  phone: string;
  schoolName: string;
  program: string;
  schoolProvince: string;
  schoolCity: string;
  schoolAddress: string;
  dli: string;
  studyFromYear: string;
  studyFromMonth: string;
  studyFromDay: string;
  studyToYear: string;
  studyToMonth: string;
  studyToDay: string;
  tuitionAmount: string;
  funds: "Myself" | "Parents" | "Other";
  serviceIn?: "English" | "French";
};

const START = "<!--YUZU_FORM1_START-->";
const END = "<!--YUZU_FORM1_END-->";
const PAD_PREFIX = "<!--YUZU_PAD:";
const PAD_SUFFIX = ":YUZU_PAD-->";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function openTag(tag: string, value: string): string {
  return `<${tag}\n>${esc(value)}</${tag}\n>`;
}

/** Replace first `<Tag\n/>` after `after` marker, or globally if after is empty. */
function fillEmpty(
  xml: string,
  tag: string,
  value: string,
  after = "",
): string {
  if (!value) return xml;
  const empty = `<${tag}\n/>`;
  const filled = openTag(tag, value);
  if (!after) {
    return xml.replace(empty, filled);
  }
  const idx = xml.indexOf(after);
  if (idx < 0) return xml;
  const head = xml.slice(0, idx);
  const tail = xml.slice(idx);
  const pos = tail.indexOf(empty);
  if (pos < 0) return xml;
  return head + tail.slice(0, pos) + filled + tail.slice(pos + empty.length);
}

/** Fill nested `<Outer><Inner/></Outer>` pattern. */
function fillNested(
  xml: string,
  outer: string,
  value: string,
  after = "",
): string {
  if (!value) return xml;
  const empty = `<${outer}\n><${outer}\n/></${outer}\n>`;
  const filled = `<${outer}\n>${openTag(outer, value)}</${outer}\n>`;
  if (!after) return xml.replace(empty, filled);
  const idx = xml.indexOf(after);
  if (idx < 0) return xml;
  const head = xml.slice(0, idx);
  const tail = xml.slice(idx);
  const pos = tail.indexOf(empty);
  if (pos < 0) return xml;
  return head + tail.slice(0, pos) + filled + tail.slice(pos + empty.length);
}

export function buildFilledForm1(template: string, a: Imm1294Answers): string {
  let xml = template;

  xml = fillNested(xml, "ServiceIn", a.serviceIn || "English");
  xml = fillEmpty(xml, "FamilyName", a.familyName, "><Name\n>");
  xml = fillEmpty(xml, "GivenName", a.givenName, "><Name\n>");
  xml = fillNested(xml, "AliasNameIndicator", "No");
  xml = fillNested(xml, "Sex", a.sex);
  xml = fillEmpty(xml, "DOBYear", a.dobYear, "><Sex\n>");
  xml = fillEmpty(xml, "DOBMonth", a.dobMonth, "><Sex\n>");
  xml = fillEmpty(xml, "DOBDay", a.dobDay, "><Sex\n>");
  xml = fillEmpty(xml, "PlaceBirthCity", a.placeBirthCity);
  xml = fillEmpty(xml, "PlaceBirthCountry", a.placeBirthCountry);
  xml = fillNested(xml, "Citizenship", a.citizenship);
  xml = fillEmpty(xml, "Pays", a.currentCountry, "><CurrentCOR\n>");
  xml = fillEmpty(xml, "Status", a.currentStatus, "><CurrentCOR\n>");
  xml = fillEmpty(xml, "MaritalStatus", a.maritalStatus, "><MaritalStatus\n><SectionA\n>");

  xml = fillNested(xml, "nativeLang", a.nativeLang);
  xml = fillNested(xml, "ableToCommunicate", a.ableToCommunicate);
  xml = fillNested(xml, "PassportNum", a.passportNumber);
  xml = fillNested(xml, "CountryofIssue", a.passportCountry, "><Passport\n>");
  xml = fillEmpty(xml, "expiryYYYY", a.passportExpiryYear);
  xml = fillEmpty(xml, "expiryMM", a.passportExpiryMonth);
  xml = fillEmpty(xml, "expiryDD", a.passportExpiryDay);

  xml = fillNested(xml, "StreetNum", a.streetNum, "><AddressRow1\n>");
  xml = fillNested(xml, "Streetname", a.streetName, "><AddressRow1\n>");
  xml = fillNested(xml, "CityTown", a.city, "><AddressRow2\n>");
  xml = fillNested(xml, "Pays", a.country, "><AddressRow2\n>");
  xml = fillNested(xml, "ProvinceState", a.provinceState, "><AddressRow2\n>");
  xml = fillNested(xml, "PostalCode", a.postalCode, "><AddressRow2\n>");

  // Prefer international phone slot for POC simplicity
  xml = xml.replace(
    /<Phone\n><Type\n\/><CanadaUS\n>0<\/CanadaUS\n><Other\n>0<\/Other\n>/,
    `<Phone\n><Type\n/><CanadaUS\n>0</CanadaUS\n><Other\n>1</Other\n>`,
  );
  xml = fillNested(xml, "IntlNumber", a.phone.replace(/\D/g, ""), "><PhoneNumbers\n><Phone\n>");

  xml = fillEmpty(xml, "Email", a.email, "><FaxEmail\n>");

  xml = fillEmpty(xml, "SchoolName", a.schoolName, "><schoolName\n>");
  xml = fillEmpty(xml, "Program", a.program, "><schoolName\n>");
  xml = fillEmpty(xml, "Prov", a.schoolProvince, "><ProvinceState\n>");
  xml = fillNested(xml, "CityTown", a.schoolCity, "><PurposeRow1\n>");
  xml = fillNested(xml, "Address", a.schoolAddress, "><PurposeRow1\n>");
  xml = fillEmpty(xml, "DLI", a.dli, "><PurposeRow1\n>");

  // Study dates live under HowLongStudy as FromDate/ToDate (often YYYY-MM-DD)
  const studyFrom = [a.studyFromYear, a.studyFromMonth, a.studyFromDay].filter(Boolean).join("-");
  const studyTo = [a.studyToYear, a.studyToMonth, a.studyToDay].filter(Boolean).join("-");
  xml = fillEmpty(xml, "FromDate", studyFrom, "><HowLongStudy\n>");
  xml = fillEmpty(xml, "ToDate", studyTo, "><HowLongStudy\n>");

  xml = fillEmpty(xml, "amount", a.tuitionAmount, "><tuition\n>");
  xml = fillNested(xml, "Funds", a.funds);

  return xml;
}

/** Keep form1 byte length stable by shrinking/expanding the pad comment. */
export function fitForm1ToLength(xml: string, targetLen: number): Uint8Array {
  const enc = new TextEncoder();
  const padStart = xml.indexOf(PAD_PREFIX);
  const padEnd = xml.indexOf(PAD_SUFFIX, padStart);
  if (padStart < 0 || padEnd < 0) {
    throw new Error("PDF pad marker missing");
  }

  const head = xml.slice(0, padStart + PAD_PREFIX.length);
  const tail = xml.slice(padEnd); // includes suffix and remainder
  const coreLen = enc.encode(head + tail).length;
  const need = targetLen - coreLen;
  if (need < 0) {
    throw new Error(
      `Filled form data is ${-need} bytes too large for the PDF slot`,
    );
  }

  const fitted = head + " ".repeat(need) + tail;
  const bytes = enc.encode(fitted);
  if (bytes.length !== targetLen) {
    // UTF-8 edge case: fall back to byte-level pad
    const out = new Uint8Array(targetLen);
    const headBytes = enc.encode(head);
    const tailBytes = enc.encode(tail);
    out.set(headBytes, 0);
    out.fill(0x20, headBytes.length, targetLen - tailBytes.length);
    out.set(tailBytes, targetLen - tailBytes.length);
    return out;
  }
  return bytes;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function fillImm1294Pdf(blankPdf: Uint8Array, answers: Imm1294Answers): Uint8Array {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const startBytes = enc.encode(START);
  const endBytes = enc.encode(END);

  const start = indexOfBytes(blankPdf, startBytes);
  const end = indexOfBytes(blankPdf, endBytes, start + startBytes.length);
  if (start < 0 || end < 0) {
    throw new Error("PDF fill markers missing");
  }

  const formStart = start + startBytes.length;
  const originalForm = blankPdf.subarray(formStart, end);
  const originalLen = originalForm.length;
  const template = dec.decode(originalForm);
  const filled = buildFilledForm1(template, answers);
  const fitted = fitForm1ToLength(filled, originalLen);

  const out = new Uint8Array(blankPdf.length);
  out.set(blankPdf);
  out.set(fitted, formStart);
  return out;
}

/**
 * Fill IMM 1294 while preserving IRCC DocMDP certification.
 *
 * Strategy: incremental update of the original encrypted PDF — only append a
 * replacement for the XFA datasets stream (obj 113). Signed byte ranges stay intact.
 */

import pako from "npm:pako@2.1.0";
import { md5 } from "npm:js-md5@0.8.3";
import countryCodes from "./country-codes.json" with { type: "json" };
import languageCodes from "./language-codes.json" with { type: "json" };

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
  maritalStatus: string;
  currentCountry: string;
  currentStatus: string;
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
  availableFunds: string;
  funds: "Myself" | "Parents" | "Other";
  serviceIn?: "English" | "French";
};

/** Empty-user AESV2 file key for the shipped imm1294f.pdf (revision 4). */
const FILE_ENCRYPTION_KEY = hexToBytes(
  "813b737c96381da7a399b2160a659510",
);

/** XFA datasets EmbeddedFile object in imm1294f.pdf */
const DATASETS_OBJ = 113;
const DATASETS_GEN = 0;

const PROVINCE_LIC: Record<string, string> = {
  AB: "09",
  BC: "11",
  MB: "07",
  NB: "04",
  NL: "01",
  NS: "03",
  NT: "10",
  NU: "64",
  ON: "06",
  PE: "02",
  QC: "05",
  SK: "08",
  YT: "12",
};

const SERVICE_LIC: Record<string, string> = {
  English: "01",
  French: "02",
};

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Strip accents / characters IRCC open-text validators often reject. */
function asciiSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function openTag(tag: string, value: string): string {
  return `<${tag}\n>${esc(value)}</${tag}\n>`;
}

function fillEmpty(
  xml: string,
  tag: string,
  value: string,
  after = "",
): string {
  if (!value) return xml;
  const empty = `<${tag}\n/>`;
  const filled = openTag(tag, value);
  if (!after) return xml.replace(empty, filled);
  const idx = xml.indexOf(after);
  if (idx < 0) return xml;
  const head = xml.slice(0, idx);
  const tail = xml.slice(idx);
  const pos = tail.indexOf(empty);
  if (pos < 0) return xml;
  return head + tail.slice(0, pos) + filled + tail.slice(pos + empty.length);
}

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

function resolveCountryLic(value: string): string {
  const raw = value.trim();
  if (/^\d{3}$/.test(raw)) return raw;
  const map = countryCodes as Record<string, string>;
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase();
  for (const [label, lic] of Object.entries(map)) {
    if (label.toLowerCase() === lower) return lic;
  }
  throw new Error(`Unknown country (use IRCC list name or 3-digit code): ${raw}`);
}

function resolveLanguageLic(value: string): string {
  const raw = value.trim();
  if (/^\d{3}$/.test(raw)) return raw;
  const map = languageCodes as Record<string, string>;
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase();
  for (const [label, lic] of Object.entries(map)) {
    if (label.toLowerCase() === lower) return lic;
  }
  throw new Error(`Unknown native language (e.g. French, English): ${raw}`);
}

function resolveProvinceLic(value: string): string {
  const raw = value.trim().toUpperCase();
  if (/^\d{2}$/.test(raw)) return raw;
  if (PROVINCE_LIC[raw]) return PROVINCE_LIC[raw];
  throw new Error(`Unknown school province code: ${value}`);
}

/** Map human form answers to IRCC LOV `lic` codes stored in XFA datasets. */
export function normalizeAnswers(a: Imm1294Answers): Imm1294Answers {
  const serviceIn = a.serviceIn === "French" ? "French" : "English";
  return {
    ...a,
    familyName: asciiSafe(a.familyName),
    givenName: asciiSafe(a.givenName),
    placeBirthCity: asciiSafe(a.placeBirthCity),
    placeBirthCountry: resolveCountryLic(a.placeBirthCountry),
    citizenship: resolveCountryLic(a.citizenship),
    currentCountry: resolveCountryLic(a.currentCountry),
    passportCountry: resolveCountryLic(a.passportCountry),
    nativeLang: resolveLanguageLic(a.nativeLang),
    streetName: asciiSafe(a.streetName),
    city: asciiSafe(a.city),
    country: resolveCountryLic(a.country),
    provinceState: asciiSafe(a.provinceState),
    schoolName: asciiSafe(a.schoolName),
    program: asciiSafe(a.program),
    schoolProvince: resolveProvinceLic(a.schoolProvince),
    schoolCity: asciiSafe(a.schoolCity),
    schoolAddress: asciiSafe(a.schoolAddress),
    serviceIn,
    // PreferenceLanguage lic for ServiceIn radio/dropdown
    // stored later via SERVICE_LIC
  };
}

export function buildFilledForm1(template: string, a: Imm1294Answers): string {
  const serviceLic = SERVICE_LIC[a.serviceIn || "English"] || "01";
  let xml = template;

  xml = fillNested(xml, "ServiceIn", serviceLic);
  xml = fillEmpty(xml, "FamilyName", a.familyName, "><Name\n>");
  xml = fillEmpty(xml, "GivenName", a.givenName, "><Name\n>");
  xml = fillNested(xml, "AliasNameIndicator", "N");
  xml = fillNested(xml, "Sex", a.sex);
  xml = fillEmpty(xml, "DOBYear", a.dobYear, "><Sex\n>");
  xml = fillEmpty(xml, "DOBMonth", a.dobMonth, "><Sex\n>");
  xml = fillEmpty(xml, "DOBDay", a.dobDay, "><Sex\n>");
  xml = fillEmpty(xml, "PlaceBirthCity", a.placeBirthCity);
  xml = fillEmpty(xml, "PlaceBirthCountry", a.placeBirthCountry);
  xml = fillNested(xml, "Citizenship", a.citizenship);
  xml = fillEmpty(xml, "Pays", a.currentCountry, "><CurrentCOR\n>");
  xml = fillEmpty(xml, "Status", a.currentStatus, "><CurrentCOR\n>");
  xml = fillEmpty(
    xml,
    "MaritalStatus",
    a.maritalStatus,
    "><MaritalStatus\n><SectionA\n>",
  );

  xml = fillEmpty(xml, "natIDIndicator", "N", "><natID\n>");
  xml = fillEmpty(xml, "usCardIndicator", "N", "><USCard\n>");

  xml = fillNested(xml, "nativeLang", a.nativeLang);
  xml = fillNested(xml, "ableToCommunicate", a.ableToCommunicate);
  xml = fillNested(xml, "PassportNum", a.passportNumber);
  xml = fillNested(xml, "CountryofIssue", a.passportCountry);
  xml = fillEmpty(xml, "expiryYYYY", a.passportExpiryYear);
  xml = fillEmpty(xml, "expiryMM", a.passportExpiryMonth);
  xml = fillEmpty(xml, "expiryDD", a.passportExpiryDay);

  xml = fillNested(xml, "StreetNum", a.streetNum, "><AddressRow1\n>");
  xml = fillNested(xml, "Streetname", a.streetName, "><AddressRow1\n>");
  xml = fillNested(xml, "CityTown", a.city, "><AddressRow2\n>");
  xml = fillNested(xml, "Pays", a.country, "><AddressRow2\n>");
  if (a.provinceState) {
    xml = fillNested(xml, "ProvinceState", a.provinceState, "><AddressRow2\n>");
  }
  xml = fillNested(xml, "PostalCode", a.postalCode, "><AddressRow2\n>");

  xml = xml.replace(
    "<Phone\n><Type\n/><CanadaUS\n>0</CanadaUS\n><Other\n>0</Other\n>",
    "<Phone\n><Type\n/><CanadaUS\n>0</CanadaUS\n><Other\n>1</Other\n>",
  );
  xml = fillNested(
    xml,
    "IntlNumber",
    a.phone.replace(/\D/g, ""),
    "><PhoneNumbers\n><Phone\n>",
  );
  xml = fillEmpty(xml, "Email", a.email, "><FaxEmail\n>");

  xml = fillEmpty(xml, "SchoolName", a.schoolName, "><schoolName\n>");
  xml = fillEmpty(xml, "Program", a.program, "><schoolName\n>");
  xml = fillEmpty(xml, "Prov", a.schoolProvince, "><ProvinceState\n>");
  xml = fillNested(xml, "CityTown", a.schoolCity, "><PurposeRow1\n>");
  xml = fillNested(xml, "Address", a.schoolAddress, "><PurposeRow1\n>");
  xml = fillEmpty(xml, "DLI", a.dli, "><PurposeRow1\n>");

  const studyFrom = [a.studyFromYear, a.studyFromMonth, a.studyFromDay]
    .filter(Boolean)
    .join("-");
  const studyTo = [a.studyToYear, a.studyToMonth, a.studyToDay]
    .filter(Boolean)
    .join("-");
  xml = fillEmpty(xml, "FromDate", studyFrom, "><HowLongStudy\n>");
  xml = fillEmpty(xml, "ToDate", studyTo, "><HowLongStudy\n>");

  xml = fillEmpty(xml, "amount", a.tuitionAmount, "><tuition\n>");
  // Nested Funds under expensesPaid is the CAD "available funds" text field.
  xml = fillNested(xml, "Funds", a.availableFunds, "><expensesPaid\n>");
  xml = fillEmpty(xml, "expensesPaidBy", a.funds, "><expensesPaid\n>");

  // Minimal occupation row so EMPLOI mandatory fields are not left red.
  xml = fillEmpty(xml, "FromYear", a.studyFromYear, "><OccupationRow1\n>");
  xml = fillEmpty(xml, "FromMonth", a.studyFromMonth, "><OccupationRow1\n>");
  xml = fillNested(xml, "Occupation", "Student", "><OccupationRow1\n>");
  xml = fillEmpty(xml, "Employer", a.schoolName, "><OccupationRow1\n>");
  xml = fillNested(xml, "CityTown", a.schoolCity, "><OccupationRow1\n>");
  xml = fillNested(
    xml,
    "Pays",
    resolveCountryLic("Canada"),
    "><OccupationRow1\n>",
  );

  return xml;
}

function indexOfBytes(
  haystack: Uint8Array,
  needle: Uint8Array | string,
  from = 0,
): number {
  const n = typeof needle === "string"
    ? new TextEncoder().encode(needle)
    : needle;
  outer: for (let i = from; i <= haystack.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) {
      if (haystack[i + j] !== n[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function objectKey(fileKey: Uint8Array, idnum: number, gen: number): Uint8Array {
  const keyData = new Uint8Array(fileKey.length + 3 + 2 + 4);
  keyData.set(fileKey, 0);
  keyData[fileKey.length] = idnum & 0xff;
  keyData[fileKey.length + 1] = (idnum >> 8) & 0xff;
  keyData[fileKey.length + 2] = (idnum >> 16) & 0xff;
  keyData[fileKey.length + 3] = gen & 0xff;
  keyData[fileKey.length + 4] = (gen >> 8) & 0xff;
  keyData.set(new TextEncoder().encode("sAlT"), fileKey.length + 5);
  const digest = md5.arrayBuffer(keyData) as ArrayBuffer;
  const full = new Uint8Array(digest);
  const len = Math.min(16, fileKey.length + 5);
  return full.subarray(0, len);
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function aesEncryptCbc(
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    asBufferSource(key),
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      asBufferSource(plaintext),
    ),
  );
  const out = new Uint8Array(16 + cipher.length);
  out.set(iv, 0);
  out.set(cipher, 16);
  return out;
}

async function aesDecryptCbc(
  key: Uint8Array,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const iv = payload.subarray(0, 16);
  const cipher = payload.subarray(16);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    asBufferSource(key),
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: asBufferSource(iv) },
      cryptoKey,
      asBufferSource(cipher),
    ),
  );
}

function findStreamSpan(
  pdf: Uint8Array,
  objNum: number,
): { dictStart: number; streamStart: number; streamEnd: number; endobj: number } {
  const header = new TextEncoder().encode(`${objNum} 0 obj`);
  const dictStart = indexOfBytes(pdf, header);
  if (dictStart < 0) throw new Error(`PDF object ${objNum} not found`);

  const streamKw = indexOfBytes(pdf, "stream", dictStart);
  if (streamKw < 0) throw new Error(`stream keyword missing for obj ${objNum}`);

  // After "stream", skip EOL (\r\n, \n, or \r)
  let streamStart = streamKw + 6;
  if (pdf[streamStart] === 0x0d && pdf[streamStart + 1] === 0x0a) {
    streamStart += 2;
  } else if (pdf[streamStart] === 0x0a || pdf[streamStart] === 0x0d) {
    streamStart += 1;
  }

  const endstream = indexOfBytes(pdf, "endstream", streamStart);
  if (endstream < 0) throw new Error("endstream missing");
  let streamEnd = endstream;
  // Trim trailing EOL before endstream
  if (pdf[streamEnd - 1] === 0x0a) streamEnd -= 1;
  if (pdf[streamEnd - 1] === 0x0d) streamEnd -= 1;

  const endobj = indexOfBytes(pdf, "endobj", endstream);
  if (endobj < 0) throw new Error("endobj missing");

  return { dictStart, streamStart, streamEnd, endobj: endobj + 6 };
}

function parseLastStartXref(pdf: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(pdf);
  const matches = [...text.matchAll(/startxref\s+(\d+)/g)];
  if (!matches.length) throw new Error("startxref not found");
  return Number(matches[matches.length - 1][1]);
}

function parseTrailerMeta(pdf: Uint8Array): {
  size: number;
  root: string;
  info: string;
  encrypt: string;
  id: string;
} {
  // Prefer values from the last XRef stream dictionary near EOF.
  const tail = new TextDecoder("latin1").decode(pdf.slice(-1200));
  const size = Number(/\/Size\s+(\d+)/.exec(tail)?.[1]);
  const root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(tail)?.[1];
  const info = /\/Info\s+(\d+\s+\d+\s+R)/.exec(tail)?.[1];
  const encrypt = /\/Encrypt\s+(\d+\s+\d+\s+R)/.exec(tail)?.[1];
  const id = /\/ID\s*(\[[^\]]+\])/.exec(tail)?.[1];
  if (!size || !root || !info || !encrypt || !id) {
    throw new Error("Could not parse PDF trailer metadata");
  }
  return { size, root, info, encrypt, id };
}

async function extractDatasetsXml(pdf: Uint8Array): Promise<string> {
  const span = findStreamSpan(pdf, DATASETS_OBJ);
  const encrypted = pdf.subarray(span.streamStart, span.streamEnd);
  const okey = objectKey(FILE_ENCRYPTION_KEY, DATASETS_OBJ, DATASETS_GEN);
  const compressed = await aesDecryptCbc(okey, encrypted);
  const xmlBytes = pako.inflate(compressed);
  return new TextDecoder("utf-8").decode(xmlBytes);
}

function patchForm1(datasetsXml: string, answers: Imm1294Answers): string {
  const start = datasetsXml.indexOf("<form1");
  if (start < 0) throw new Error("form1 missing in XFA datasets");
  const endMatch = datasetsXml.slice(start).match(/<\/form1\n?>/);
  if (!endMatch || endMatch.index === undefined) {
    throw new Error("form1 close tag missing");
  }
  const end = start + endMatch.index + endMatch[0].length;
  const filled = buildFilledForm1(datasetsXml.slice(start, end), answers);
  return datasetsXml.slice(0, start) + filled + datasetsXml.slice(end);
}

/**
 * Fill the certified IMM 1294 PDF via encrypted incremental update.
 * `blankPdf` must be the original IRCC file (imm1294f.pdf), not a rewritten blank.
 */
export async function fillImm1294Pdf(
  blankPdf: Uint8Array,
  answers: Imm1294Answers,
): Promise<Uint8Array> {
  const normalized = normalizeAnswers(answers);
  const datasetsXml = await extractDatasetsXml(blankPdf);
  const patchedXml = patchForm1(datasetsXml, normalized);
  const xmlBytes = new TextEncoder().encode(patchedXml);
  const compressed = pako.deflate(xmlBytes);
  const okey = objectKey(FILE_ENCRYPTION_KEY, DATASETS_OBJ, DATASETS_GEN);
  const streamBytes = await aesEncryptCbc(okey, compressed);

  const prev = parseLastStartXref(blankPdf);
  const meta = parseTrailerMeta(blankPdf);
  const objOffset = blankPdf.length;

  const header = new TextEncoder().encode(
    `${DATASETS_OBJ} 0 obj\n` +
      `<<\n/Filter [/FlateDecode]\n/Type /EmbeddedFile\n/Length ${streamBytes.length}\n>>\n` +
      `stream\n`,
  );
  const footer = new TextEncoder().encode("\nendstream\nendobj\n");
  const objBody = new Uint8Array(header.length + streamBytes.length + footer.length);
  objBody.set(header, 0);
  objBody.set(streamBytes, header.length);
  objBody.set(footer, header.length + streamBytes.length);

  const xrefPos = objOffset + objBody.length;
  const xref = new TextEncoder().encode(
    `xref\n${DATASETS_OBJ} 1\n${objOffset.toString().padStart(10, "0")} 00000 n \n`,
  );
  const trailer = new TextEncoder().encode(
    `trailer\n<<\n` +
      `/Size ${meta.size}\n` +
      `/Root ${meta.root}\n` +
      `/Info ${meta.info}\n` +
      `/Encrypt ${meta.encrypt}\n` +
      `/ID ${meta.id}\n` +
      `/Prev ${prev}\n` +
      `>>\nstartxref\n${xrefPos}\n%%EOF\n`,
  );

  const out = new Uint8Array(
    blankPdf.length + objBody.length + xref.length + trailer.length,
  );
  out.set(blankPdf, 0);
  out.set(objBody, blankPdf.length);
  out.set(xref, blankPdf.length + objBody.length);
  out.set(trailer, blankPdf.length + objBody.length + xref.length);

  // Sanity: original prefix (incl. IRCC signature) unchanged
  for (let i = 0; i < Math.min(64, blankPdf.length); i++) {
    if (out[i] !== blankPdf[i]) throw new Error("Incremental prefix corrupted");
  }

  return out;
}

/** @deprecated kept for diagnostics */
export function debugFileKeyHex(): string {
  return bytesToHex(FILE_ENCRYPTION_KEY);
}

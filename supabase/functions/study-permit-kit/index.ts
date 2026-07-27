import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  fillKitForms,
  resolveForms,
  zipFilledForms,
  type FilledForm,
} from "./fill_kit.ts";
import {
  DRAFT_TTL_DAYS,
  loadDraft,
  saveDraft,
} from "./drafts.ts";
import { type KitAnswers, selectForms } from "./patchers.ts";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/yuzu\.solutions$/,
  /^https:\/\/www\.yuzu\.solutions$/,
  /^https:\/\/trockin8r\.github\.io\/yuzu_websites(\/.*)?$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const SITE_URL = "https://yuzu.solutions";
const LOGO_URL = `${SITE_URL}/assets/og-image.png`;
const NOTIFY_EMAIL = "adrienyvin@gmail.com";
const EMAIL_MAX_LENGTH = 254;
const TEXT_MAX = 120;
const BRAND = {
  yuzu: "#F8C607",
  yuzuDark: "#BC9605",
  yuzuLight: "#FEF6DA",
  carbon: "#2D3436",
  carbonMuted: "#5C6567",
  paper: "#FFFFFF",
  border: "#E8E9EA",
};

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function resolveCorsOrigin(origin: string | null) {
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return origin;
  }
  return SITE_URL;
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max = TEXT_MAX) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function digits(value: unknown, len: number) {
  return String(value ?? "").replace(/\D/g, "").slice(0, len);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function countRecentHits(
  supabase: SupabaseClient,
  bucket: string,
  windowMinutes: number,
) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await supabase
    .from("intake_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);

  if (error) {
    console.error("Rate limit lookup failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function recordRateEvent(supabase: SupabaseClient, bucket: string) {
  const { error } = await supabase.from("intake_rate_events").insert({ bucket });
  if (error) {
    console.error("Rate limit event insert failed:", error.message);
  }
}

async function enforceRateLimits(
  supabase: SupabaseClient,
  remoteIp?: string,
  email?: string,
) {
  const ipLimit = Number(Deno.env.get("STUDY_KIT_IP_LIMIT") || Deno.env.get("IMM1294_IP_LIMIT") || "5");
  const emailLimit = Number(
    Deno.env.get("STUDY_KIT_EMAIL_LIMIT") || Deno.env.get("IMM1294_EMAIL_LIMIT") || "3",
  );
  const ipWindowMinutes = Number(
    Deno.env.get("STUDY_KIT_IP_WINDOW_MIN") || Deno.env.get("IMM1294_IP_WINDOW_MIN") || "60",
  );
  const emailWindowMinutes = Number(
    Deno.env.get("STUDY_KIT_EMAIL_WINDOW_MIN") || Deno.env.get("IMM1294_EMAIL_WINDOW_MIN") || "1440",
  );

  if (remoteIp) {
    const ipBucket = `studykit:ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return { ok: false, error: "Too many requests from this network. Try again later." };
    }
  }

  if (email) {
    const emailBucket = `studykit:email:${await sha256(email.toLowerCase())}`;
    const emailHits = await countRecentHits(supabase, emailBucket, emailWindowMinutes);
    if (emailHits >= emailLimit) {
      return { ok: false, error: "This email already received a kit recently. Check your inbox." };
    }
  }

  if (remoteIp) {
    await recordRateEvent(supabase, `studykit:ip:${await sha256(remoteIp)}`);
  }
  if (email) {
    await recordRateEvent(supabase, `studykit:email:${await sha256(email.toLowerCase())}`);
  }

  return { ok: true, error: "" };
}

async function enforceDraftRateLimits(
  supabase: SupabaseClient,
  remoteIp: string | undefined,
  action: string,
) {
  const ipLimit = Number(Deno.env.get("STUDY_KIT_DRAFT_IP_LIMIT") || "20");
  const ipWindowMinutes = Number(Deno.env.get("STUDY_KIT_DRAFT_IP_WINDOW_MIN") || "60");
  if (!remoteIp) return { ok: true, error: "" };

  const ipBucket = `studykit-draft:${action}:ip:${await sha256(remoteIp)}`;
  const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
  if (ipHits >= ipLimit) {
    return { ok: false, error: "Too many save/resume attempts from this network. Try again later." };
  }
  await recordRateEvent(supabase, ipBucket);
  return { ok: true, error: "" };
}

async function verifyTurnstile(token: string, remoteIp?: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  if (!secret) {
    return { ok: false, error: "Captcha is not configured on the server", skipped: false };
  }
  if (!token) {
    return { ok: false, error: "Captcha verification is required", skipped: false };
  }

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const result = await response.json().catch(() => ({}));
  const errorCodes = Array.isArray(result["error-codes"]) ? result["error-codes"].join(", ") : "";
  return {
    ok: Boolean(result.success),
    error: result.success ? "" : (errorCodes || "Captcha verification failed"),
    skipped: false,
  };
}

function parseBool(raw: unknown): boolean {
  if (raw === true) return true;
  const v = cleanText(raw, 8).toLowerCase();
  return v === "y" || v === "yes" || v === "true" || v === "1";
}

function validateKit(raw: Record<string, unknown>): { ok: true; answers: KitAnswers } | { ok: false; error: string } {
  const email = cleanText(raw.email, EMAIL_MAX_LENGTH).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const familyName = cleanText(raw.familyName);
  const givenName = cleanText(raw.givenName);
  if (!familyName || !givenName) {
    return { ok: false, error: "Enter your family name and given name." };
  }

  const dobYear = digits(raw.dobYear, 4);
  const dobMonth = digits(raw.dobMonth, 2).padStart(2, "0");
  const dobDay = digits(raw.dobDay, 2).padStart(2, "0");
  if (dobYear.length !== 4 || Number(dobMonth) < 1 || Number(dobMonth) > 12 || Number(dobDay) < 1 || Number(dobDay) > 31) {
    return { ok: false, error: "Enter a valid date of birth." };
  }

  const formLanguage = cleanText(raw.formLanguage || raw.serviceIn, 20).toLowerCase().startsWith("f")
    ? "f"
    : "e";

  const hasRepresentative = parseBool(raw.hasRepresentative);
  const hasDesignee = parseBool(raw.hasDesignee);
  const isCommonLaw = parseBool(raw.isCommonLaw);
  const needsCustodian = parseBool(raw.needsCustodian) || parseBool(raw.includeImm5646);

  let forms = selectForms({ hasRepresentative, hasDesignee, isCommonLaw, needsCustodian });
  if (Array.isArray(raw.forms) && raw.forms.length) {
    forms = resolveForms({
      email,
      formLanguage,
      forms: (raw.forms as unknown[]).map((f) => cleanText(f, 20).toLowerCase()),
      familyName,
      givenName,
      dobYear,
      dobMonth,
      dobDay,
      hasRepresentative,
      hasDesignee,
      isCommonLaw,
      needsCustodian,
    });
  }

  if (!cleanText(raw.parent1FamilyName) || !cleanText(raw.parent1GivenName)) {
    return { ok: false, error: "Enter parent / guardian 1 family name and given name (required for IMM 5707)." };
  }
  if (!cleanText(raw.parent2FamilyName) || !cleanText(raw.parent2GivenName)) {
    return { ok: false, error: "Enter parent / guardian 2 family name and given name (required for IMM 5707)." };
  }

  if (hasRepresentative) {
    if (!cleanText(raw.repFamilyName) || !cleanText(raw.repGivenName)) {
      return { ok: false, error: "Enter your representative’s family and given names." };
    }
    if (!cleanText(raw.repEmail, EMAIL_MAX_LENGTH)) {
      return { ok: false, error: "Enter your representative’s email." };
    }
  }
  if (hasDesignee) {
    if (!cleanText(raw.designeeFamilyName) || !cleanText(raw.designeeGivenName)) {
      return { ok: false, error: "Enter the designated individual’s family and given names." };
    }
    if (!cleanText(raw.designeeRelationship)) {
      return { ok: false, error: "Enter the designated individual’s relationship to you." };
    }
  }
  if (isCommonLaw) {
    if (!cleanText(raw.partnerFamilyName) || !cleanText(raw.partnerGivenName)) {
      return { ok: false, error: "Enter your common-law partner’s family and given names." };
    }
    if (!cleanText(raw.yearsTogether, 10)) {
      return { ok: false, error: "Enter how many years you have lived together." };
    }
  }
  if (needsCustodian) {
    if (!cleanText(raw.custodianFamilyName) || !cleanText(raw.custodianGivenName)) {
      return { ok: false, error: "Enter the custodian’s family and given names (IMM 5646)." };
    }
    if (!cleanText(raw.custodianAddress, 200)) {
      return { ok: false, error: "Enter the custodian’s address in Canada." };
    }
  }

  const imm1294 = (raw.imm1294 && typeof raw.imm1294 === "object")
    ? raw.imm1294 as Record<string, unknown>
    : {};

  // Flatten IMM 1294 questionnaire fields (including dynamic branches) into imm1294 bag.
  for (const key of [
    "passportNumber", "passportCountry", "passportIssueYear", "passportIssueMonth", "passportIssueDay",
    "passportExpiryYear", "passportExpiryMonth", "passportExpiryDay",
    "schoolName", "studyLevel", "fieldOfStudy", "schoolProvince", "schoolCity", "schoolAddress", "dli",
    "studyFromYear", "studyFromMonth", "studyFromDay", "studyToYear", "studyToMonth", "studyToDay",
    "tuitionAmount", "availableFunds", "funds", "fundsOtherPerson",
    "caqNumber", "caqExpiryYear", "caqExpiryMonth", "caqExpiryDay",
    "palNumber", "palExpiryYear", "palExpiryMonth", "palExpiryDay",
    "nativeLang", "ableToCommunicate", "preferredLang", "langTest",
    "maritalStatus", "spouseFamilyName", "spouseGivenName", "marriageYear", "marriageMonth", "marriageDay",
    "currentCountry", "currentStatus", "corOther",
    "corFromYear", "corFromMonth", "corFromDay", "corToYear", "corToMonth", "corToDay",
    "previousCor", "previousCorRows",
    "pcor1Country", "pcor1Status", "pcor1Other", "pcor1FromYear", "pcor1FromMonth", "pcor1FromDay",
    "pcor1ToYear", "pcor1ToMonth", "pcor1ToDay",
    "pcor2Country", "pcor2Status", "pcor2Other", "pcor2FromYear", "pcor2FromMonth", "pcor2FromDay",
    "pcor2ToYear", "pcor2ToMonth", "pcor2ToDay",
    "sameAsCor", "cwaCountry", "cwaStatus", "cwaOther",
    "cwaFromYear", "cwaFromMonth", "cwaFromDay", "cwaToYear", "cwaToMonth", "cwaToDay",
    "previouslyMarried", "prevSpouseFamilyName", "prevSpouseGivenName", "prevSpouseRelationship",
    "prevSpouseDobYear", "prevSpouseDobMonth", "prevSpouseDobDay",
    "prevSpouseFromYear", "prevSpouseFromMonth", "prevSpouseFromDay",
    "prevSpouseToYear", "prevSpouseToMonth", "prevSpouseToDay",
    "hasAlias", "aliasFamilyName", "aliasGivenName",
    "hasNatId", "natIdNumber", "natIdCountry",
    "natIdIssueYear", "natIdIssueMonth", "natIdIssueDay",
    "natIdExpiryYear", "natIdExpiryMonth", "natIdExpiryDay",
    "hasUsCard", "usCardNumber", "usCardExpiryYear", "usCardExpiryMonth", "usCardExpiryDay",
    "sameAsMailing", "resStreetNum", "resStreetName", "resAptUnit", "resCity", "resCountry",
    "resProvinceState", "resPostalCode",
    "phoneType", "educationIndicator",
    "eduFromYear", "eduFromMonth", "eduToYear", "eduToMonth",
    "eduField", "eduSchool", "eduCity", "eduCountry", "eduProvince",
    "occupation", "employer", "occupationCity", "occupationCountry", "occupationProvince",
    "occupationFromYear", "occupationFromMonth", "jobs",
    "bgTb", "bgDisorder", "bgMedicalDetails", "bgOverstay", "bgRefused", "bgClaimAsylum",
    "bgRefusedDetails", "bgCrime", "bgCrimeDetails", "bgMilitary", "bgMilitaryDetails",
    "bgViolence", "bgWitness", "cicContactConsent", "serviceIn",
  ]) {
    if (raw[key] !== undefined && imm1294[key] === undefined) {
      imm1294[key] = raw[key];
    }
  }

  const answers: KitAnswers = {
    email,
    formLanguage,
    forms,
    familyName,
    givenName,
    sex: cleanText(raw.sex, 20) || undefined,
    dobYear,
    dobMonth,
    dobDay,
    citizenship: cleanText(raw.citizenship) || undefined,
    placeBirthCountry: cleanText(raw.placeBirthCountry) || undefined,
    placeBirthCity: cleanText(raw.placeBirthCity) || undefined,
    maritalStatus: cleanText(raw.maritalStatus, 2) || undefined,
    occupation: cleanText(raw.occupation) || undefined,
    emailContact: cleanText(raw.emailContact || email, EMAIL_MAX_LENGTH) || undefined,
    phone: cleanText(raw.phone, 40) || undefined,
    phoneCountryCode: digits(raw.phoneCountryCode, 4) || undefined,
    streetNum: cleanText(raw.streetNum, 20) || undefined,
    streetName: cleanText(raw.streetName) || undefined,
    city: cleanText(raw.city) || undefined,
    provinceState: cleanText(raw.provinceState, 40) || undefined,
    country: cleanText(raw.country) || undefined,
    postalCode: cleanText(raw.postalCode, 20) || undefined,
    schoolName: cleanText(raw.schoolName) || undefined,
    schoolAddress: cleanText(raw.schoolAddress, 200) || undefined,
    imm1294,
    parent1FamilyName: cleanText(raw.parent1FamilyName) || undefined,
    parent1GivenName: cleanText(raw.parent1GivenName) || undefined,
    parent1Dob: cleanText(raw.parent1Dob, 20) || undefined,
    parent1Cob: cleanText(raw.parent1Cob) || undefined,
    parent1Address: cleanText(raw.parent1Address, 200) || undefined,
    parent1MaritalStatus: cleanText(raw.parent1MaritalStatus, 2) || undefined,
    parent1Occupation: cleanText(raw.parent1Occupation) || undefined,
    parent1Telephone: cleanText(raw.parent1Telephone, 40) || undefined,
    parent2FamilyName: cleanText(raw.parent2FamilyName) || undefined,
    parent2GivenName: cleanText(raw.parent2GivenName) || undefined,
    parent2Dob: cleanText(raw.parent2Dob, 20) || undefined,
    parent2Cob: cleanText(raw.parent2Cob) || undefined,
    parent2Address: cleanText(raw.parent2Address, 200) || undefined,
    parent2MaritalStatus: cleanText(raw.parent2MaritalStatus, 2) || undefined,
    parent2Occupation: cleanText(raw.parent2Occupation) || undefined,
    parent2Telephone: cleanText(raw.parent2Telephone, 40) || undefined,
    spouseFamilyName: cleanText(raw.spouseFamilyName) || undefined,
    spouseGivenName: cleanText(raw.spouseGivenName) || undefined,
    spouseDob: cleanText(raw.spouseDob, 20) || undefined,
    spouseCob: cleanText(raw.spouseCob) || undefined,
    spouseAddress: cleanText(raw.spouseAddress, 200) || undefined,
    spouseOccupation: cleanText(raw.spouseOccupation) || undefined,
    spouseAccompanying: parseBool(raw.spouseAccompanying),
    hasRepresentative,
    repFamilyName: cleanText(raw.repFamilyName) || undefined,
    repGivenName: cleanText(raw.repGivenName) || undefined,
    repOrganization: cleanText(raw.repOrganization) || undefined,
    repEmail: cleanText(raw.repEmail, EMAIL_MAX_LENGTH) || undefined,
    repPhone: cleanText(raw.repPhone, 40) || undefined,
    repPhoneCountryCode: digits(raw.repPhoneCountryCode, 4) || undefined,
    repMembershipId: cleanText(raw.repMembershipId, 40) || undefined,
    repStreetNum: cleanText(raw.repStreetNum, 20) || undefined,
    repStreetName: cleanText(raw.repStreetName) || undefined,
    repCity: cleanText(raw.repCity) || undefined,
    repProvince: cleanText(raw.repProvince, 40) || undefined,
    repCountry: cleanText(raw.repCountry) || undefined,
    repPostalCode: cleanText(raw.repPostalCode, 20) || undefined,
    hasDesignee,
    designeeFamilyName: cleanText(raw.designeeFamilyName) || undefined,
    designeeGivenName: cleanText(raw.designeeGivenName) || undefined,
    designeeRelationship: cleanText(raw.designeeRelationship) || undefined,
    isCommonLaw,
    needsCustodian,
    partnerGivenName: cleanText(raw.partnerGivenName) || undefined,
    partnerFamilyName: cleanText(raw.partnerFamilyName) || undefined,
    yearsTogether: cleanText(raw.yearsTogether, 10) || undefined,
    commonLawCity: cleanText(raw.commonLawCity) || undefined,
    commonLawProvince: cleanText(raw.commonLawProvince, 40) || undefined,
    commonLawCountry: cleanText(raw.commonLawCountry) || undefined,
    commonLawStart: cleanText(raw.commonLawStart, 20) || undefined,
    custodianFamilyName: cleanText(raw.custodianFamilyName) || undefined,
    custodianGivenName: cleanText(raw.custodianGivenName) || undefined,
    custodianDob: cleanText(raw.custodianDob, 20) || undefined,
    custodianStatus: cleanText(raw.custodianStatus, 40) || undefined,
    custodianAddress: cleanText(raw.custodianAddress, 200) || undefined,
    custodianTelephone: cleanText(raw.custodianTelephone, 40) || undefined,
  };

  return { ok: true, answers };
}

function createSmtpTransporter() {
  const host = Deno.env.get("SMTP_HOST")?.trim();
  const user = Deno.env.get("SMTP_USER")?.trim();
  const pass = Deno.env.get("SMTP_PASS")?.trim();
  const from = (Deno.env.get("SMTP_FROM") || user || "").trim();
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  const secure = (Deno.env.get("SMTP_SECURE") || (port === 465 ? "true" : "false")).toLowerCase() === "true";

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP not configured");
  }

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  };
}

function zipFilename(answers: KitAnswers) {
  return `study-permit-kit_${answers.familyName}_${answers.givenName}.zip`
    .replace(/[^\w.\-]+/g, "_");
}

function buildEmailHtml(name: string, formCodes: string[]) {
  const first = escapeHtml(name.split(" ")[0] || name);
  const list = formCodes.map((c) => escapeHtml(c.toUpperCase())).join(", ");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your study permit kit</title></head>
<body style="margin:0;padding:0;background:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" width="100%" style="background:#F4F5F5;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:600px;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 32px 20px;background:linear-gradient(180deg, ${BRAND.yuzuLight} 0%, ${BRAND.paper} 100%);border-bottom:1px solid ${BRAND.border};">
        <img src="${LOGO_URL}" width="220" alt="Yuzu.solutions" style="display:block;border:0;max-width:220px;height:auto;">
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${first},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Your <strong>Canadian study permit kit</strong> was filled from the answers you submitted on the Yuzu automation demo.
          The ZIP attachment includes: ${list}.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.carbonMuted};">
          Open each PDF in <strong>Adobe Acrobat/Reader</strong> to review. This is a proof of concept — not legal advice.
        </p>
      </td></tr>
      <tr><td style="padding:22px 32px;background:#FAFAFA;border-top:1px solid ${BRAND.border};">
        <p style="margin:0;font-size:13px;color:${BRAND.carbonMuted};">
          <strong style="color:${BRAND.carbon};">Adrien Yvin</strong> · Yuzu.solutions ·
          <a href="${SITE_URL}" style="color:${BRAND.yuzuDark};text-decoration:none;">yuzu.solutions</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

async function sendKitEmail(answers: KitAnswers, forms: FilledForm[], zipBytes: Uint8Array) {
  const { from, transporter } = createSmtpTransporter();
  const name = `${answers.givenName} ${answers.familyName}`.trim();
  const filename = zipFilename(answers);
  const codes = forms.map((f) => f.code);

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: answers.email,
    replyTo: from,
    subject: "Your filled study permit kit (Yuzu demo)",
    text: [
      `Hi ${answers.givenName},`,
      "",
      "Your Canadian study permit kit was filled from the Yuzu automation demo.",
      `Forms included: ${codes.map((c) => c.toUpperCase()).join(", ")}.`,
      "The ZIP is attached.",
      "",
      "Adrien Yvin · Yuzu.solutions",
      SITE_URL,
    ].join("\n"),
    html: buildEmailHtml(name, codes),
    attachments: [
      {
        filename,
        content: zipBytes,
        contentType: "application/zip",
      },
    ],
  });
}

async function sendNotify(answers: KitAnswers, forms: FilledForm[]) {
  const { from, transporter } = createSmtpTransporter();
  const notifyTo = (Deno.env.get("INTAKE_NOTIFY_EMAIL") || NOTIFY_EMAIL).trim();
  const name = `${answers.givenName} ${answers.familyName}`;

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: notifyTo,
    replyTo: answers.email,
    subject: `Study permit kit demo: ${name}`,
    text: [
      "Study permit kit filler demo submission",
      "",
      `Name: ${name}`,
      `Email: ${answers.email}`,
      `Forms: ${forms.map((f) => f.code).join(", ")}`,
    ].join("\n"),
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Forbidden" }, 403, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim();

  // Preview which forms would be selected (no captcha / no fill).
  if (payload.action === "select-forms") {
    const forms = selectForms({
      hasRepresentative: parseBool(payload.hasRepresentative),
      hasDesignee: parseBool(payload.hasDesignee),
      isCommonLaw: parseBool(payload.isCommonLaw),
      needsCustodian: parseBool(payload.needsCustodian) || parseBool(payload.includeImm5646),
    });
    return jsonResponse({ ok: true, forms }, 200, origin);
  }

  // Save / resume drafts (rate-limited; no captcha — mid-wizard save).
  if (payload.action === "save-draft" || payload.action === "load-draft") {
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500, origin);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const draftLimit = await enforceDraftRateLimits(supabase, remoteIp, payload.action);
    if (!draftLimit.ok) {
      return jsonResponse({ error: draftLimit.error }, 429, origin);
    }

    if (payload.action === "save-draft") {
      const draftPayload = (payload.draft && typeof payload.draft === "object")
        ? payload.draft as Record<string, unknown>
        : payload;
      const familyName = cleanText(
        draftPayload.familyName || payload.familyName,
        120,
      );
      const step = Number(payload.step ?? draftPayload.step ?? 0);
      const result = await saveDraft(supabase, {
        step,
        payload: draftPayload,
        familyName,
      });
      if (!result.ok) {
        return jsonResponse({ error: result.error }, 400, origin);
      }
      return jsonResponse({
        ok: true,
        code: result.code,
        expiresAt: result.expiresAt,
        validDays: DRAFT_TTL_DAYS,
      }, 200, origin);
    }

    const result = await loadDraft(supabase, {
      code: cleanText(payload.code, 40),
      familyName: cleanText(payload.familyName, 120),
    });
    if (!result.ok) {
      return jsonResponse({ error: result.error }, 404, origin);
    }
    return jsonResponse({
      ok: true,
      step: result.draft.step,
      draft: result.draft.payload,
      expiresAt: result.draft.expires_at,
    }, 200, origin);
  }

  if (payload.consent !== true) {
    return jsonResponse({ error: "Consent is required" }, 400, origin);
  }

  const captchaToken = cleanText(payload.captchaToken, 2048);

  const captcha = await verifyTurnstile(captchaToken, remoteIp);
  if (!captcha.ok) {
    return jsonResponse({ error: captcha.error || "Captcha verification failed" }, 400, origin);
  }

  const validated = validateKit(payload);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400, origin);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const rateLimit = await enforceRateLimits(supabase, remoteIp, validated.answers.email);
  if (!rateLimit.ok) {
    return jsonResponse({ error: rateLimit.error }, 429, origin);
  }

  const delivery = cleanText(payload.delivery, 20).toLowerCase() === "download"
    ? "download"
    : "email";

  let forms: FilledForm[];
  let zipBytes: Uint8Array;
  try {
    forms = await fillKitForms(validated.answers);
    zipBytes = await zipFilledForms(forms);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Kit fill failed:", detail);
    return jsonResponse({ error: `Could not fill the kit: ${detail}` }, 500, origin);
  }

  if (delivery === "download") {
    try {
      await sendNotify(validated.answers, forms);
    } catch (error) {
      console.error("Notify email failed:", error);
    }
    return new Response(zipBytes, {
      status: 200,
      headers: {
        ...buildCorsHeaders(origin),
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename(validated.answers)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    await sendKitEmail(validated.answers, forms, zipBytes);
  } catch (error) {
    console.error("Kit email failed:", error);
    return jsonResponse({ error: "Could not send the kit email" }, 500, origin);
  }

  try {
    await sendNotify(validated.answers, forms);
  } catch (error) {
    console.error("Notify email failed:", error);
  }

  return jsonResponse({
    ok: true,
    emailSent: true,
    email: validated.answers.email,
    forms: forms.map((f) => f.code),
  }, 200, origin);
});

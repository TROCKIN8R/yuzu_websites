import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/yuzu\.solutions$/,
  /^https:\/\/www\.yuzu\.solutions$/,
  /^https:\/\/trockin8r\.github\.io\/yuzu_websites(\/.*)?$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com",
]);

const ROUTE_DESTINATIONS = [
  "SharePoint / Legal",
  "CRM / Salesforce",
  "Drive / Finance",
  "Teams / Ops notify",
];

const SIGN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CALENDLY_URL = "https://calendly.com/adrienyvin/30min";
const SITE_URL = "https://yuzu.solutions";
const LOGO_URL = `${SITE_URL}/assets/og-image.png`;
const NOTIFY_EMAIL = "adrienyvin@gmail.com";
const NAME_MAX_LENGTH = 120;
const EMAIL_MAX_LENGTH = 254;
const SOURCE_MAX_LENGTH = 120;
const BRAND = {
  yuzu: "#F8C607",
  yuzuDark: "#BC9605",
  yuzuLight: "#FEF6DA",
  carbon: "#2D3436",
  carbonMuted: "#5C6567",
  paper: "#FFFFFF",
  border: "#E8E9EA",
  zest: "#86C54A",
};

type ContractRow = {
  name: string;
  email_masked: string;
  company: string;
  domain: string;
  destination: string;
  status: string;
  source: string;
};

type SignTokenPayload = {
  id: string;
  email: string;
  name: string;
  exp: number;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function base64urlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlEncodeString(value: string) {
  return base64urlEncode(new TextEncoder().encode(value));
}

function base64urlDecodeToString(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getSigningSecret() {
  return (
    Deno.env.get("CONTRACT_SIGNING_SECRET")?.trim()
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
    || ""
  );
}

function getFunctionsBaseUrl() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/contract-router`;
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

async function hmacSha256Base64url(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return base64urlEncode(new Uint8Array(signature));
}

async function createSignToken(id: string, email: string, name: string) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("Signing secret not configured");
  }

  const payload: SignTokenPayload = {
    id,
    email,
    name,
    exp: Date.now() + SIGN_TOKEN_TTL_MS,
  };
  const payloadPart = base64urlEncodeString(JSON.stringify(payload));
  const signature = await hmacSha256Base64url(payloadPart, secret);
  return `${payloadPart}.${signature}`;
}

async function verifySignToken(token: string): Promise<SignTokenPayload | null> {
  const secret = getSigningSecret();
  if (!secret || !token) return null;

  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;

  const expected = await hmacSha256Base64url(payloadPart, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecodeToString(payloadPart)) as SignTokenPayload;
    if (!payload?.id || !payload?.email || !payload?.name || !payload?.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
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
  const ipLimit = Number(Deno.env.get("INTAKE_IP_LIMIT") || "5");
  const emailLimit = Number(Deno.env.get("INTAKE_EMAIL_LIMIT") || "2");
  const ipWindowMinutes = Number(Deno.env.get("INTAKE_IP_WINDOW_MIN") || "60");
  const emailWindowMinutes = Number(Deno.env.get("INTAKE_EMAIL_WINDOW_MIN") || "1440");

  if (remoteIp) {
    const ipBucket = `contract:ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return { ok: false, error: "Too many submissions from this network. Try again later." };
    }
  }

  if (email) {
    const emailBucket = `contract:email:${await sha256(email.toLowerCase())}`;
    const emailHits = await countRecentHits(supabase, emailBucket, emailWindowMinutes);
    if (emailHits >= emailLimit) {
      return { ok: false, error: "This email was already submitted recently. Check your inbox." };
    }
  }

  if (remoteIp) {
    await recordRateEvent(supabase, `contract:ip:${await sha256(remoteIp)}`);
  }
  if (email) {
    await recordRateEvent(supabase, `contract:email:${await sha256(email.toLowerCase())}`);
  }

  return { ok: true, error: "" };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstNameFrom(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function titleCaseWord(word: string) {
  return word
    .split(/(['-])/)
    .map((part) => {
      if (part === "'" || part === "-") return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function formatName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");
}

function maskNamePart(part: string) {
  if (!part) return part;
  if (part.length === 1) return part;
  return part.charAt(0) + "*".repeat(part.length - 1);
}

function maskName(name: string) {
  return formatName(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("-").map(maskNamePart).join("-"))
    .join(" ");
}

function getTurnstileSecret() {
  return (
    Deno.env.get("TURNSTILE_SECRET_KEY")?.trim()
    || Deno.env.get("TURNSTILE_SECRET")?.trim()
    || ""
  );
}

async function verifyTurnstile(token: string, remoteIp?: string) {
  if (!token) {
    return { ok: false, error: "Captcha verification is required" };
  }

  const secret = getTurnstileSecret();
  if (!secret) {
    console.error(
      "Turnstile secret missing. Set TURNSTILE_SECRET_KEY in Supabase Edge Function secrets.",
    );
    return { ok: false, error: "Captcha verification is not configured" };
  }

  const params = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    params.set("remoteip", remoteIp);
  }

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

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length === 1 ? local : `${local[0]}***`;
  return `${visible}@${domain}`;
}

function companyFromDomain(domain: string) {
  const label = domain.split(".")[0] || domain;
  return label.replace(/-/g, " ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function routeDestination(domain: string, isFree: boolean) {
  if (isFree) return "SharePoint / Internal";
  const hash = domain.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ROUTE_DESTINATIONS[hash % ROUTE_DESTINATIONS.length];
}

function buildRow(displayName: string, email: string, source: string): ContractRow {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  const isFree = FREE_DOMAINS.has(domain);
  const destination = routeDestination(domain, isFree);
  return {
    name: displayName,
    email_masked: maskEmail(email),
    company: isFree ? "Personal inbox" : companyFromDomain(domain),
    domain,
    destination,
    status: "pending",
    source: source || "yuzu.solutions",
  };
}

function buildMockDocumentHtml(name: string, company: string) {
  const signer = escapeHtml(name);
  const org = escapeHtml(company);
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAFAFA;border:1px solid ${BRAND.border};border-radius:12px;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 6px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.carbonMuted};">Demo document</p>
          <p style="margin:0 0 18px;font-size:20px;line-height:1.3;font-weight:800;color:${BRAND.carbon};">Services Agreement (Sample)</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${BRAND.carbon};"><strong>Between</strong> Yuzu.solutions and ${org}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${BRAND.carbon};"><strong>Signer</strong> ${signer}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${BRAND.carbon};"><strong>Effective date</strong> ${escapeHtml(today)}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${BRAND.carbon};">
            This sample agreement covers automation delivery, data handling, and support terms for a pilot engagement.
            It is a mock document for the Contract Router demo only — no legal obligations apply.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:${BRAND.carbon};">
            By selecting <strong>Sign here</strong>, you simulate completing an e-signature so the router can file the agreement and update the live demo table.
          </p>
        </td>
      </tr>
    </table>`;
}

function buildSignatureRequestEmailHtml(
  name: string,
  company: string,
  destination: string,
  signUrl: string,
) {
  const firstName = escapeHtml(firstNameFrom(name));
  const routeLabel = escapeHtml(destination);
  const safeSignUrl = escapeHtml(signUrl);
  const documentHtml = buildMockDocumentHtml(name, company);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signature requested</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F4F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;background-color:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 32px 20px;background:linear-gradient(180deg, ${BRAND.yuzuLight} 0%, ${BRAND.paper} 100%);border-bottom:1px solid ${BRAND.border};">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="220" alt="Yuzu.solutions" style="display:block;border:0;outline:none;max-width:220px;height:auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 16px;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.4;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.zest};">Signature requested</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.carbon};">Hi ${firstName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${BRAND.carbon};">
                Please review and sign the sample agreement below. Once signed, the Contract Router demo will route it to
                <strong>${routeLabel}</strong> and update the live table on
                <a href="${SITE_URL}/#test-automations" style="color:${BRAND.yuzuDark};text-decoration:none;font-weight:600;">yuzu.solutions</a>.
              </p>
              ${documentHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 32px;">
              <a href="${safeSignUrl}" style="display:inline-block;padding:16px 32px;background-color:${BRAND.yuzu};color:${BRAND.carbon};font-size:16px;font-weight:800;line-height:1;text-decoration:none;border-radius:999px;border:1px solid ${BRAND.yuzuDark};">
                Sign here
              </a>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${BRAND.carbonMuted};">
                Demo only. This link expires in 7 days.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSignatureRequestEmailText(
  name: string,
  company: string,
  destination: string,
  signUrl: string,
) {
  const firstName = firstNameFrom(name);
  return [
    `Hi ${firstName},`,
    "",
    "Please review and sign the sample Services Agreement for the Yuzu.solutions Contract Router demo.",
    "",
    `Signer: ${name}`,
    `Organization: ${company}`,
    `Will route to: ${destination}`,
    "",
    "Sign here:",
    signUrl,
    "",
    "Demo only. This link expires in 7 days.",
    "",
    `Live table: ${SITE_URL}/#test-automations`,
  ].join("\n");
}

function buildThanksEmailHtml(name: string, destination: string) {
  const firstName = escapeHtml(firstNameFrom(name));
  const routeLabel = escapeHtml(destination);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for signing</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F4F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 32px 20px;background:linear-gradient(180deg, ${BRAND.yuzuLight} 0%, ${BRAND.paper} 100%);border-bottom:1px solid ${BRAND.border};">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="220" alt="Yuzu.solutions" style="display:block;border:0;outline:none;max-width:220px;height:auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.carbon};">Hi ${firstName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.carbon};">
                Thanks for signing the sample agreement. Your demo contract is now marked <strong>Signed</strong> and routed to
                <strong>${routeLabel}</strong>.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:${BRAND.carbon};">
                Watch the live table update on
                <a href="${SITE_URL}/#test-automations" style="color:${BRAND.yuzuDark};text-decoration:none;font-weight:600;">yuzu.solutions</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAFDF8;border:1px solid #EEF8E4;border-radius:12px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.4;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.zest};">Next step</p>
                    <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.carbon};">
                      Book a 30-minute call to walk through contract routing for your stack.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 28px;">
              <a href="${CALENDLY_URL}" style="display:inline-block;padding:14px 28px;background-color:${BRAND.yuzu};color:${BRAND.carbon};font-size:15px;font-weight:700;line-height:1;text-decoration:none;border-radius:999px;border:1px solid ${BRAND.yuzuDark};">
                Book a 30-minute call
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background-color:#FAFAFA;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${BRAND.carbonMuted};">
                <strong style="color:${BRAND.carbon};">Adrien Yvin</strong> · Founder, Yuzu.solutions
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildThanksEmailText(name: string, destination: string) {
  const firstName = firstNameFrom(name);
  return [
    `Hi ${firstName},`,
    "",
    "Thanks for signing the sample agreement for the Yuzu.solutions Contract Router demo.",
    `Your contract is now marked Signed and routed to ${destination}.`,
    "",
    `Live table: ${SITE_URL}/#test-automations`,
    "",
    "Book a 30-minute call:",
    CALENDLY_URL,
  ].join("\n");
}

function buildSignResultPageHtml(options: {
  title: string;
  headline: string;
  body: string;
  destination?: string;
  status?: string;
}) {
  const destinationBlock = options.destination
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${BRAND.carbon};"><strong>Routed to:</strong> ${escapeHtml(options.destination)}</p>`
    : "";
  const statusBlock = options.status
    ? `<p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.carbon};"><strong>Status:</strong> ${escapeHtml(options.status)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;">
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.zest};">Contract Router demo</p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:${BRAND.carbon};">${escapeHtml(options.headline)}</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${BRAND.carbon};">${options.body}</p>
              ${destinationBlock}
              ${statusBlock}
              <p style="margin:24px 0 0;">
                <a href="${SITE_URL}/#test-automations" style="display:inline-block;padding:12px 24px;background:${BRAND.yuzu};color:${BRAND.carbon};font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;border:1px solid ${BRAND.yuzuDark};">
                  View live table
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getNotifyEmail() {
  return (Deno.env.get("INTAKE_NOTIFY_EMAIL") || NOTIFY_EMAIL).trim();
}

function buildNotifyEmailHtml(
  name: string,
  email: string,
  row: ContractRow,
  source: string,
) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New contract router submission</title>
</head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};background:#F4F5F5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:12px;">
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.zest};">New submission</p>
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${BRAND.carbon};">Contract Router demo</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:15px;line-height:1.6;">
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};width:110px;">Name</td><td style="padding:8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}" style="color:${BRAND.yuzuDark};text-decoration:none;">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};">Company</td><td style="padding:8px 0;">${escapeHtml(row.company)}</td></tr>
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};">Routed to</td><td style="padding:8px 0;"><strong>${escapeHtml(row.destination)}</strong></td></tr>
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};">Source</td><td style="padding:8px 0;">${escapeHtml(source)}</td></tr>
          <tr><td style="padding:8px 0;color:${BRAND.carbonMuted};">Status</td><td style="padding:8px 0;">${escapeHtml(row.status)}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${BRAND.carbonMuted};">
          Signature request email sent. Public table shows masked name <strong>${escapeHtml(row.name)}</strong>.
          <a href="${SITE_URL}/#test-automations" style="color:${BRAND.yuzuDark};text-decoration:none;font-weight:600;">View live table</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildNotifyEmailText(
  name: string,
  email: string,
  row: ContractRow,
  source: string,
) {
  return [
    "New Contract Router submission",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${row.company}`,
    `Routed to: ${row.destination}`,
    `Source: ${source}`,
    `Status: ${row.status}`,
    "",
    "Signature request email sent.",
    `Public table (masked): ${row.name} / ${row.email_masked}`,
    `${SITE_URL}/#test-automations`,
  ].join("\n");
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

async function sendSignatureRequestEmail(
  name: string,
  email: string,
  company: string,
  destination: string,
  signUrl: string,
) {
  const { from, transporter } = createSmtpTransporter();

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: email,
    replyTo: from,
    subject: "Signature requested — Yuzu.solutions Contract Router demo",
    text: buildSignatureRequestEmailText(name, company, destination, signUrl),
    html: buildSignatureRequestEmailHtml(name, company, destination, signUrl),
  });
}

async function sendThanksEmail(name: string, email: string, destination: string) {
  const { from, transporter } = createSmtpTransporter();

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: email,
    replyTo: from,
    subject: "Thanks for signing — Yuzu.solutions demo",
    text: buildThanksEmailText(name, destination),
    html: buildThanksEmailHtml(name, destination),
  });
}

async function sendNotifyEmail(
  name: string,
  email: string,
  row: ContractRow,
  source: string,
) {
  const { from, transporter } = createSmtpTransporter();
  const notifyTo = getNotifyEmail();

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: notifyTo,
    replyTo: email,
    subject: `New contract router submission: ${name}`,
    text: buildNotifyEmailText(name, email, row, source),
    html: buildNotifyEmailHtml(name, email, row, source),
  });
}

async function handleSignRequest(token: string) {
  const payload = await verifySignToken(token);
  if (!payload) {
    return htmlResponse(buildSignResultPageHtml({
      title: "Invalid link",
      headline: "This signing link is invalid or expired",
      body: "Request a new demo from the Contract Router tab on yuzu.solutions.",
    }), 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return htmlResponse(buildSignResultPageHtml({
      title: "Server error",
      headline: "Could not complete signing",
      body: "The demo service is misconfigured. Try again later.",
    }), 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const table = (Deno.env.get("CONTRACT_ROUTES_TABLE") || "contract_routes").trim();

  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select("id,name,destination,status")
    .eq("id", payload.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return htmlResponse(buildSignResultPageHtml({
      title: "Not found",
      headline: "Contract not found",
      body: "This demo contract could not be located.",
    }), 404);
  }

  if (existing.status === "signed") {
    return htmlResponse(buildSignResultPageHtml({
      title: "Already signed",
      headline: "This agreement is already signed",
      body: "No further action is needed. Check the live demo table for the Signed status.",
      destination: existing.destination,
      status: "Signed",
    }));
  }

  const signedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from(table)
    .update({ status: "signed", signed_at: signedAt })
    .eq("id", payload.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Contract sign update failed:", updateError.message);
    return htmlResponse(buildSignResultPageHtml({
      title: "Server error",
      headline: "Could not record your signature",
      body: "Please try the Sign here link again in a moment.",
    }), 500);
  }

  try {
    await sendThanksEmail(payload.name, payload.email, existing.destination);
  } catch (error) {
    const emailError = error instanceof Error ? error.message : String(error);
    console.error("Thanks email failed:", emailError);
  }

  return htmlResponse(buildSignResultPageHtml({
    title: "Signed",
    headline: "Thanks — your signature was recorded",
    body: "A confirmation email is on its way. The live demo table will show Signed shortly.",
    destination: existing.destination,
    status: "Signed",
  }));
}

async function handleIntakeRequest(req: Request, origin: string | null) {
  let payload: { name?: string; email?: string; source?: string; consent?: boolean; captchaToken?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, origin);
  }

  const rawName = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const source = String(payload.source || "yuzu.solutions").trim().slice(0, SOURCE_MAX_LENGTH);
  const consent = payload.consent === true;
  const captchaToken = String(payload.captchaToken || "").trim();
  const name = formatName(rawName);
  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim();

  if (!consent) {
    return jsonResponse({ error: "Consent is required" }, 400, origin);
  }

  const captcha = await verifyTurnstile(captchaToken, remoteIp);
  if (!captcha.ok) {
    return jsonResponse({ error: captcha.error || "Captcha verification failed" }, 400, origin);
  }

  if (!rawName || rawName.length > NAME_MAX_LENGTH) {
    return jsonResponse({ error: "Invalid name" }, 400, origin);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > EMAIL_MAX_LENGTH) {
    return jsonResponse({ error: "Invalid email" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const rateLimit = await enforceRateLimits(supabase, remoteIp, email);
  if (!rateLimit.ok) {
    return jsonResponse({ error: rateLimit.error }, 429, origin);
  }

  const table = (Deno.env.get("CONTRACT_ROUTES_TABLE") || "contract_routes").trim();
  const row = buildRow(maskName(rawName), email, source);

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert(row)
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("Contract route insert failed:", insertError?.message);
    return jsonResponse({ error: "Could not save submission" }, 500, origin);
  }

  let emailSent = false;
  let notifySent = false;

  try {
    const signToken = await createSignToken(inserted.id, email, name);
    const signUrl = `${getFunctionsBaseUrl()}?token=${encodeURIComponent(signToken)}`;
    await sendSignatureRequestEmail(name, email, row.company, row.destination, signUrl);
    emailSent = true;
  } catch (error) {
    const emailError = error instanceof Error ? error.message : String(error);
    console.error("Signature request email failed:", emailError);
  }

  try {
    await sendNotifyEmail(name, email, row, source);
    notifySent = true;
  } catch (error) {
    const notifyError = error instanceof Error ? error.message : String(error);
    console.error("Notify email failed:", notifyError);
  }

  return jsonResponse({
    ok: true,
    row,
    emailSent,
    notifySent,
  }, 200, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const signToken = url.searchParams.get("token");

  if (req.method === "GET" && signToken) {
    return handleSignRequest(signToken);
  }

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method === "POST") {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ error: "Forbidden" }, 403, origin);
    }
    return handleIntakeRequest(req, origin);
  }

  return new Response("Not found", { status: 404 });
});

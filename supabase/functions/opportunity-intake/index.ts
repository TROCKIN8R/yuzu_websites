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

const CALENDLY_URL = "https://calendly.com/adrienyvin/30min";
const SITE_URL = "https://yuzu.solutions";
const LOGO_URL = `${SITE_URL}/assets/og-image.png`;
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
    "Vary": "Origin",
  };
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
  const ipLimit = Number(Deno.env.get("INTAKE_IP_LIMIT") || "5");
  const emailLimit = Number(Deno.env.get("INTAKE_EMAIL_LIMIT") || "2");
  const ipWindowMinutes = Number(Deno.env.get("INTAKE_IP_WINDOW_MIN") || "60");
  const emailWindowMinutes = Number(Deno.env.get("INTAKE_EMAIL_WINDOW_MIN") || "1440");

  if (remoteIp) {
    const ipBucket = `ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return { ok: false, error: "Too many submissions from this network. Try again later." };
    }
  }

  if (email) {
    const emailBucket = `email:${await sha256(email.toLowerCase())}`;
    const emailHits = await countRecentHits(supabase, emailBucket, emailWindowMinutes);
    if (emailHits >= emailLimit) {
      return { ok: false, error: "This email was already submitted recently. Check your inbox." };
    }
  }

  if (remoteIp) {
    await recordRateEvent(supabase, `ip:${await sha256(remoteIp)}`);
  }
  if (email) {
    await recordRateEvent(supabase, `email:${await sha256(email.toLowerCase())}`);
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

async function verifyTurnstile(token: string, remoteIp?: string) {
  if (!token) {
    return { ok: false, error: "Captcha verification is required" };
  }

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  if (!secret) {
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

function buildRow(displayName: string, email: string, source: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  const isFree = FREE_DOMAINS.has(domain);
  return {
    name: displayName,
    email_masked: maskEmail(email),
    company: isFree ? "Personal inbox" : companyFromDomain(domain),
    domain,
    company_size: "Unknown",
    industry: isFree ? "Personal email" : "Unknown",
    status: "pending",
    source_note: "Submitted via website form",
    source: source || "yuzu.solutions",
  };
}

function buildEmailHtml(name: string) {
  const firstName = escapeHtml(firstNameFrom(name));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thanks for trying Yuzu.solutions</title>
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
                Thanks for trying our <strong>opportunity tracker</strong> demo. Your submission is now in the live table on
                <a href="${SITE_URL}" style="color:${BRAND.yuzuDark};text-decoration:none;font-weight:600;">yuzu.solutions</a>.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:${BRAND.carbon};">
                In production, the same hook can route leads to your CRM, SharePoint, or internal tracker, notify sales, and enrich company context automatically.
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
                      Book a 30-minute call to walk through how intake, routing, and enrichment could fit your stack.
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
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.carbonMuted};">
                Prefer email? Reply with what you are trying to automate and we will take it from there.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background-color:#FAFAFA;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${BRAND.carbonMuted};">
                <strong style="color:${BRAND.carbon};">Adrien Yvin</strong> · Founder, Yuzu.solutions
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.carbonMuted};">
                <a href="mailto:info@yuzu.solutions" style="color:${BRAND.yuzuDark};text-decoration:none;">info@yuzu.solutions</a>
                · <a href="${SITE_URL}" style="color:${BRAND.yuzuDark};text-decoration:none;">yuzu.solutions</a>
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

function buildEmailText(name: string) {
  const firstName = firstNameFrom(name);
  return [
    `Hi ${firstName},`,
    "",
    "Thanks for trying our opportunity tracker demo on yuzu.solutions.",
    "Your submission is now in the live table.",
    "",
    "In production, the same hook can route leads to your CRM, SharePoint, or internal tracker, notify sales, and enrich company context automatically.",
    "",
    "Next step: book a 30-minute call to walk through how intake, routing, and enrichment could fit your stack.",
    CALENDLY_URL,
    "",
    "Prefer email? Reply with what you are trying to automate.",
    "",
    "Adrien Yvin",
    "Founder, Yuzu.solutions",
    "info@yuzu.solutions",
    SITE_URL,
  ].join("\n");
}

async function sendFollowUpEmail(name: string, email: string) {
  const host = Deno.env.get("SMTP_HOST")?.trim();
  const user = Deno.env.get("SMTP_USER")?.trim();
  const pass = Deno.env.get("SMTP_PASS")?.trim();
  const from = (Deno.env.get("SMTP_FROM") || user || "").trim();
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  const secure = (Deno.env.get("SMTP_SECURE") || (port === 465 ? "true" : "false")).toLowerCase() === "true";

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: email,
    replyTo: from,
    subject: "Thanks for trying Yuzu.solutions",
    text: buildEmailText(name),
    html: buildEmailHtml(name),
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("ok", { headers: buildCorsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Forbidden" }, 403, origin);
  }

  let payload: { name?: string; email?: string; source?: string; consent?: boolean; captchaToken?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, origin);
  }

  const rawName = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const source = String(payload.source || "yuzu.solutions").trim().slice(0, 120);
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

  if (!rawName || rawName.length > 120) {
    return jsonResponse({ error: "Invalid name" }, 400, origin);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

  const table = (Deno.env.get("OPPORTUNITIES_TABLE") || "opportunities").trim();
  const row = buildRow(maskName(rawName), email, source);

  const { error: insertError } = await supabase.from(table).insert(row);
  if (insertError) {
    console.error("Opportunity insert failed:", insertError.message);
    return jsonResponse({ error: "Could not save submission" }, 500, origin);
  }

  let emailSent = false;
  try {
    await sendFollowUpEmail(name, email);
    emailSent = true;
  } catch (error) {
    const emailError = error instanceof Error ? error.message : String(error);
    console.error("Follow-up email failed:", emailError);
  }

  return jsonResponse({
    ok: true,
    row,
    emailSent,
  }, 200, origin);
});

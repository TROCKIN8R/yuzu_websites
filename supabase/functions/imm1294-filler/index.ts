import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { fillImm1294Pdf, type Imm1294Answers } from "./fill.ts";
import { validateAnswers } from "./validate.ts";

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
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Vary": "Origin",
  };
}

function pdfFilename(answers: Imm1294Answers) {
  return `IMM1294_${answers.familyName}_${answers.givenName}.pdf`
    .replace(/[^\w.\-]+/g, "_");
}

function pdfResponse(pdfBytes: Uint8Array, answers: Imm1294Answers, origin: string | null) {
  const filename = pdfFilename(answers);
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanText(value: unknown, max = TEXT_MAX) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function digits(value: unknown, len: number) {
  return String(value ?? "").replace(/\D/g, "").slice(0, len);
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
  const ipLimit = Number(Deno.env.get("IMM1294_IP_LIMIT") || "5");
  const emailLimit = Number(Deno.env.get("IMM1294_EMAIL_LIMIT") || "3");
  const ipWindowMinutes = Number(Deno.env.get("IMM1294_IP_WINDOW_MIN") || "60");
  const emailWindowMinutes = Number(Deno.env.get("IMM1294_EMAIL_WINDOW_MIN") || "1440");

  if (remoteIp) {
    const ipBucket = `imm1294:ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return { ok: false, error: "Too many requests from this network. Try again later." };
    }
  }

  if (email) {
    const emailBucket = `imm1294:email:${await sha256(email.toLowerCase())}`;
    const emailHits = await countRecentHits(supabase, emailBucket, emailWindowMinutes);
    if (emailHits >= emailLimit) {
      return { ok: false, error: "This email already received a filled form recently. Check your inbox." };
    }
  }

  if (remoteIp) {
    await recordRateEvent(supabase, `imm1294:ip:${await sha256(remoteIp)}`);
  }
  if (email) {
    await recordRateEvent(supabase, `imm1294:email:${await sha256(email.toLowerCase())}`);
  }

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

function buildEmailHtml(name: string) {
  const first = escapeHtml(name.split(" ")[0] || name);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your filled IMM 1294</title></head>
<body style="margin:0;padding:0;background:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" width="100%" style="background:#F4F5F5;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:600px;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 32px 20px;background:linear-gradient(180deg, ${BRAND.yuzuLight} 0%, ${BRAND.paper} 100%);border-bottom:1px solid ${BRAND.border};">
        <img src="${LOGO_URL}" width="220" alt="Yuzu.solutions" style="display:block;border:0;max-width:220px;height:auto;">
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${first},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Your <strong>IMM 1294</strong> study-permit form was filled from the answers you submitted on the Yuzu automation demo.
          The completed PDF is attached.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${BRAND.carbonMuted};">
          This is a proof of concept. Open the attachment in <strong>Adobe Acrobat/Reader</strong>
          (not Preview). The IRCC certification is preserved so Validate and signature stay available.
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

async function sendFilledPdf(answers: Imm1294Answers, pdfBytes: Uint8Array) {
  const { from, transporter } = createSmtpTransporter();
  const name = `${answers.givenName} ${answers.familyName}`.trim();
  const filename = pdfFilename(answers);

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: answers.email,
    replyTo: from,
    subject: "Your filled IMM 1294 form (Yuzu demo)",
    text: [
      `Hi ${answers.givenName},`,
      "",
      "Your IMM 1294 study-permit form was filled from the answers you submitted on the Yuzu automation demo.",
      "The completed PDF is attached.",
      "",
      "Open it in Adobe Acrobat/Reader to review the filled fields.",
      "",
      "Adrien Yvin · Yuzu.solutions",
      SITE_URL,
    ].join("\n"),
    html: buildEmailHtml(name),
    attachments: [
      {
        filename,
        content: pdfBytes,
        contentType: "application/pdf",
      },
    ],
  });
}

let cachedBlankPdf: Uint8Array | null = null;

async function loadBlankPdf(): Promise<Uint8Array> {
  if (cachedBlankPdf) return cachedBlankPdf;

  // Must be the original IRCC-certified PDF (not a rewritten blank).
  const candidates = [
    Deno.env.get("IMM1294_BLANK_URL")?.trim(),
    `${SITE_URL}/assets/forms/imm1294f.pdf`,
    "https://raw.githubusercontent.com/TROCKIN8R/yuzu_websites/main/yuzu_github_page/assets/forms/imm1294f.pdf",
    "https://raw.githubusercontent.com/TROCKIN8R/yuzu_websites/main/supabase/functions/imm1294-filler/imm1294f.pdf",
  ].filter((url): url is string => Boolean(url));

  // Prefer bundled certified original when the edge runtime includes it.
  try {
    const local = await Deno.readFile(new URL("./imm1294f.pdf", import.meta.url));
    if (local.byteLength > 1000) {
      cachedBlankPdf = local;
      return local;
    }
  } catch (error) {
    console.warn("Local certified PDF unavailable, falling back to URL:", error);
  }

  let lastError = "No blank PDF source available";
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = `HTTP ${response.status} fetching blank PDF`;
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1000) {
        lastError = "Blank PDF response too small";
        continue;
      }
      cachedBlankPdf = bytes;
      return bytes;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}

async function sendNotify(answers: Imm1294Answers) {
  const { from, transporter } = createSmtpTransporter();
  const notifyTo = (Deno.env.get("INTAKE_NOTIFY_EMAIL") || NOTIFY_EMAIL).trim();
  const name = `${answers.givenName} ${answers.familyName}`;

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: notifyTo,
    replyTo: answers.email,
    subject: `IMM1294 demo filled: ${name}`,
    text: [
      "IMM 1294 filler demo submission",
      "",
      `Name: ${name}`,
      `Email: ${answers.email}`,
      `School: ${answers.schoolName}`,
      `Program: ${answers.program}`,
      `DLI: ${answers.dli}`,
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

  if (payload.consent !== true) {
    return jsonResponse({ error: "Consent is required" }, 400, origin);
  }

  const captchaToken = cleanText(payload.captchaToken, 2048);
  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim();

  const captcha = await verifyTurnstile(captchaToken, remoteIp);
  if (!captcha.ok) {
    return jsonResponse({ error: captcha.error || "Captcha verification failed" }, 400, origin);
  }

  const validated = validateAnswers(payload);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
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

  let pdfBytes: Uint8Array;
  try {
    const blankPdf = await loadBlankPdf();
    pdfBytes = await fillImm1294Pdf(blankPdf, validated.answers);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("PDF fill failed:", detail);
    return jsonResponse({ error: `Could not fill the PDF form: ${detail}` }, 500, origin);
  }

  if (delivery === "download") {
    try {
      await sendNotify(validated.answers);
    } catch (error) {
      console.error("Notify email failed:", error);
    }
    return pdfResponse(pdfBytes, validated.answers, origin);
  }

  try {
    await sendFilledPdf(validated.answers, pdfBytes);
  } catch (error) {
    console.error("Filled PDF email failed:", error);
    return jsonResponse({ error: "Could not send the filled PDF email" }, 500, origin);
  }

  try {
    await sendNotify(validated.answers);
  } catch (error) {
    console.error("Notify email failed:", error);
  }

  return jsonResponse({
    ok: true,
    emailSent: true,
    email: validated.answers.email,
  }, 200, origin);
});

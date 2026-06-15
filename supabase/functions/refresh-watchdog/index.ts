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

const SITE_URL = "https://yuzu.solutions";
const NOTIFY_EMAIL = "adrienyvin@gmail.com";

const PIPELINES = new Set([
  "refresh_semantic_model",
  "sales_dwh_incremental",
  "fabric_lakehouse_gold",
]);

const BRAND = {
  carbon: "#2D3436",
  carbonMuted: "#5C6567",
  paper: "#FFFFFF",
  border: "#E8E9EA",
  zest: "#86C54A",
  alert: "#DC2626",
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

async function enforceRateLimits(supabase: SupabaseClient, remoteIp?: string) {
  const ipLimit = Number(Deno.env.get("REFRESH_IP_LIMIT") || "10");
  const ipWindowMinutes = Number(Deno.env.get("REFRESH_IP_WINDOW_MIN") || "60");

  if (remoteIp) {
    const ipBucket = `refresh:ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return { ok: false, error: "Too many demo runs from this network. Try again later." };
    }
    await recordRateEvent(supabase, ipBucket);
  }

  return { ok: true, error: "" };
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
    console.error("Turnstile secret missing for refresh-watchdog");
    return { ok: false, error: "Captcha verification is not configured" };
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
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function pipelineLabel(pipeline: string) {
  const labels: Record<string, string> = {
    refresh_semantic_model: "Semantic model refresh",
    sales_dwh_incremental: "Sales DWH incremental",
    fabric_lakehouse_gold: "Fabric lakehouse Gold layer",
  };
  return labels[pipeline] || pipeline;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRun(pipeline: string, scenario: string, slaMinutes: number, source: string) {
  const durationSeconds = scenario === "breach"
    ? randomInt(600, 900)
    : randomInt(200, 280);
  const slaSeconds = slaMinutes * 60;
  const status = durationSeconds > slaSeconds ? "alert" : "ok";
  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - durationSeconds * 1000);

  return {
    pipeline,
    duration_seconds: durationSeconds,
    sla_minutes: slaMinutes,
    status,
    scenario,
    source: source || "yuzu.solutions/home-automation-demo",
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  };
}

function getNotifyEmail() {
  return (Deno.env.get("INTAKE_NOTIFY_EMAIL") || NOTIFY_EMAIL).trim();
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

function buildAlertEmailHtml(row: ReturnType<typeof buildRun>) {
  const duration = formatDuration(row.duration_seconds);
  const label = pipelineLabel(row.pipeline);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Refresh SLA alert</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};background:#F4F5F5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:12px;">
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.alert};">SLA breach</p>
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${BRAND.carbon};">Refresh Watchdog alert</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.carbon};">
          Pipeline <strong>${escapeHtml(label)}</strong> finished in <strong>${escapeHtml(duration)}</strong>,
          above the <strong>${row.sla_minutes} min</strong> SLA.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.carbonMuted};">
          In production this routes to Slack or Teams. Demo triggered from
          <a href="${SITE_URL}/#test-automations" style="color:#BC9605;text-decoration:none;font-weight:600;">yuzu.solutions</a>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAlertEmailText(row: ReturnType<typeof buildRun>) {
  return [
    "Refresh Watchdog SLA breach",
    "",
    `Pipeline: ${pipelineLabel(row.pipeline)} (${row.pipeline})`,
    `Duration: ${formatDuration(row.duration_seconds)}`,
    `SLA: ${row.sla_minutes} min`,
    `Scenario: ${row.scenario}`,
    "",
    `${SITE_URL}/#test-automations`,
  ].join("\n");
}

async function sendAlertEmail(row: ReturnType<typeof buildRun>) {
  const { from, transporter } = createSmtpTransporter();
  const label = pipelineLabel(row.pipeline);

  await transporter.sendMail({
    from: `"Yuzu.solutions Watchdog" <${from}>`,
    to: getNotifyEmail(),
    subject: `Refresh SLA alert: ${label} (${formatDuration(row.duration_seconds)})`,
    text: buildAlertEmailText(row),
    html: buildAlertEmailHtml(row),
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

  let payload: {
    pipeline?: string;
    scenario?: string;
    slaMinutes?: number;
    captchaToken?: string;
    source?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400, origin);
  }

  const pipeline = String(payload.pipeline || "").trim();
  const scenario = String(payload.scenario || "").trim().toLowerCase();
  const slaMinutes = Math.min(60, Math.max(1, Number(payload.slaMinutes) || 8));
  const captchaToken = String(payload.captchaToken || "").trim();
  const source = String(payload.source || "yuzu.solutions/home-automation-demo").trim().slice(0, 120);
  const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim();

  if (!PIPELINES.has(pipeline)) {
    return jsonResponse({ error: "Invalid pipeline" }, 400, origin);
  }

  if (scenario !== "healthy" && scenario !== "breach") {
    return jsonResponse({ error: "Invalid scenario" }, 400, origin);
  }

  const captcha = await verifyTurnstile(captchaToken, remoteIp);
  if (!captcha.ok) {
    return jsonResponse({ error: captcha.error || "Captcha verification failed" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const rateLimit = await enforceRateLimits(supabase, remoteIp);
  if (!rateLimit.ok) {
    return jsonResponse({ error: rateLimit.error }, 429, origin);
  }

  const table = (Deno.env.get("REFRESH_RUNS_TABLE") || "refresh_runs").trim();
  const row = buildRun(pipeline, scenario, slaMinutes, source);

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert(row)
    .select("id, started_at, completed_at, pipeline, duration_seconds, sla_minutes, status, scenario, source")
    .single();

  if (insertError || !inserted) {
    console.error("Refresh run insert failed:", insertError?.message);
    return jsonResponse({ error: "Could not save refresh run" }, 500, origin);
  }

  let alertSent = false;
  if (inserted.status === "alert") {
    try {
      await sendAlertEmail(inserted);
      alertSent = true;
    } catch (error) {
      const alertError = error instanceof Error ? error.message : String(error);
      console.error("Refresh alert email failed:", alertError);
    }
  }

  return jsonResponse({
    ok: true,
    row: inserted,
    alertSent,
  }, 200, origin);
});

/**
 * Shared Edge scaffolding for IRCC permit kits (CORS, rate limits, Turnstile,
 * SMTP email, and the POST action router).
 *
 * Kit-specific validation / form selection / fill stay in each function.
 */
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export const SITE_URL = "https://yuzu.solutions";
export const LOGO_URL = `${SITE_URL}/assets/og-image.png`;
export const NOTIFY_EMAIL = "adrienyvin@gmail.com";
export const EMAIL_MAX_LENGTH = 254;
export const TEXT_MAX = 120;

export const BRAND = {
  yuzu: "#F8C607",
  yuzuDark: "#BC9605",
  yuzuLight: "#FEF6DA",
  carbon: "#2D3436",
  carbonMuted: "#5C6567",
  paper: "#FFFFFF",
  border: "#E8E9EA",
};

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/yuzu\.solutions$/,
  /^https:\/\/www\.yuzu\.solutions$/,
  /^https:\/\/trockin8r\.github\.io\/yuzu_websites(\/.*)?$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export type FilledFormLike = {
  code: string;
  bytes?: Uint8Array;
  filename?: string;
};

export type KitPerson = {
  email: string;
  familyName: string;
  givenName: string;
};

export type RateLimitConfig = {
  /** Bucket prefix, e.g. studykit / workkit */
  bucketPrefix: string;
  /** Env prefix for fill limits, e.g. STUDY_KIT / WORK_KIT (falls back to IMM1294_*) */
  envPrefix: string;
  /** Env prefix for draft limits (defaults to `${envPrefix}_DRAFT`) */
  draftEnvPrefix?: string;
};

export type EmailCopy = {
  kitLabel: string; // "study permit" / "work permit"
  zipPrefix: string; // "study-permit-kit"
  userSubject: string;
  notifySubjectPrefix: string;
  notifyBodyTitle: string;
};

export type DraftHandlers = {
  DRAFT_TTL_DAYS: number;
  saveDraft: (
    supabase: SupabaseClient,
    input: { step: number; payload: Record<string, unknown>; familyName: string },
  ) => Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; error: string }>;
  loadDraft: (
    supabase: SupabaseClient,
    input: { code: string; familyName: string },
  ) => Promise<
    | {
      ok: true;
      draft: {
        id: string;
        step: number;
        payload: Record<string, unknown>;
        expires_at: string;
      };
    }
    | { ok: false; error: string }
  >;
};

export type PermitKitHandlers<
  TAnswers extends KitPerson,
  TForm extends FilledFormLike = FilledFormLike,
> = {
  rates: RateLimitConfig;
  email: EmailCopy;
  drafts: DraftHandlers;
  selectFormsFromPayload: (payload: Record<string, unknown>) => string[];
  validateKit: (
    raw: Record<string, unknown>,
  ) => { ok: true; answers: TAnswers } | { ok: false; error: string };
  fillKitForms: (answers: TAnswers) => Promise<TForm[]>;
  /** Accepts filled forms from this kit (codes are kit-specific string unions). */
  // deno-lint-ignore no-explicit-any
  zipFilledForms: (forms: any) => Promise<Uint8Array>;
};

export function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function resolveCorsOrigin(origin: string | null) {
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    return origin;
  }
  return SITE_URL;
}

export function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(origin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

export function cleanText(value: unknown, max = TEXT_MAX) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function digits(value: unknown, len: number) {
  return String(value ?? "").replace(/\D/g, "").slice(0, len);
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function parseBool(raw: unknown): boolean {
  if (raw === true) return true;
  const v = cleanText(raw, 8).toLowerCase();
  return v === "y" || v === "yes" || v === "true" || v === "1";
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

export async function enforceRateLimits(
  supabase: SupabaseClient,
  rates: RateLimitConfig,
  remoteIp?: string,
  email?: string,
) {
  const p = rates.envPrefix;
  const ipLimit = Number(
    Deno.env.get(`${p}_IP_LIMIT`) || Deno.env.get("IMM1294_IP_LIMIT") || "5",
  );
  const emailLimit = Number(
    Deno.env.get(`${p}_EMAIL_LIMIT`) || Deno.env.get("IMM1294_EMAIL_LIMIT") || "3",
  );
  const ipWindowMinutes = Number(
    Deno.env.get(`${p}_IP_WINDOW_MIN`) ||
      Deno.env.get("IMM1294_IP_WINDOW_MIN") ||
      "60",
  );
  const emailWindowMinutes = Number(
    Deno.env.get(`${p}_EMAIL_WINDOW_MIN`) ||
      Deno.env.get("IMM1294_EMAIL_WINDOW_MIN") ||
      "1440",
  );

  if (remoteIp) {
    const ipBucket = `${rates.bucketPrefix}:ip:${await sha256(remoteIp)}`;
    const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
    if (ipHits >= ipLimit) {
      return {
        ok: false,
        error: "Too many requests from this network. Try again later.",
      };
    }
  }

  if (email) {
    const emailBucket = `${rates.bucketPrefix}:email:${await sha256(email.toLowerCase())}`;
    const emailHits = await countRecentHits(
      supabase,
      emailBucket,
      emailWindowMinutes,
    );
    if (emailHits >= emailLimit) {
      return {
        ok: false,
        error: "This email already received a kit recently. Check your inbox.",
      };
    }
  }

  if (remoteIp) {
    await recordRateEvent(
      supabase,
      `${rates.bucketPrefix}:ip:${await sha256(remoteIp)}`,
    );
  }
  if (email) {
    await recordRateEvent(
      supabase,
      `${rates.bucketPrefix}:email:${await sha256(email.toLowerCase())}`,
    );
  }

  return { ok: true, error: "" };
}

export async function enforceDraftRateLimits(
  supabase: SupabaseClient,
  rates: RateLimitConfig,
  remoteIp: string | undefined,
  action: string,
) {
  const draftPrefix = rates.draftEnvPrefix || `${rates.envPrefix}_DRAFT`;
  const ipLimit = Number(Deno.env.get(`${draftPrefix}_IP_LIMIT`) || "20");
  const ipWindowMinutes = Number(
    Deno.env.get(`${draftPrefix}_IP_WINDOW_MIN`) || "60",
  );
  if (!remoteIp) return { ok: true, error: "" };

  const ipBucket =
    `${rates.bucketPrefix}-draft:${action}:ip:${await sha256(remoteIp)}`;
  const ipHits = await countRecentHits(supabase, ipBucket, ipWindowMinutes);
  if (ipHits >= ipLimit) {
    return {
      ok: false,
      error: "Too many save/resume attempts from this network. Try again later.",
    };
  }
  await recordRateEvent(supabase, ipBucket);
  return { ok: true, error: "" };
}

export async function verifyTurnstile(token: string, remoteIp?: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  if (!secret) {
    return {
      ok: false,
      error: "Captcha is not configured on the server",
      skipped: false,
    };
  }
  if (!token) {
    return {
      ok: false,
      error: "Captcha verification is required",
      skipped: false,
    };
  }

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
  );
  const result = await response.json().catch(() => ({}));
  const errorCodes = Array.isArray(result["error-codes"])
    ? result["error-codes"].join(", ")
    : "";
  return {
    ok: Boolean(result.success),
    error: result.success ? "" : (errorCodes || "Captcha verification failed"),
    skipped: false,
  };
}

export function createSmtpTransporter() {
  const host = Deno.env.get("SMTP_HOST")?.trim();
  const user = Deno.env.get("SMTP_USER")?.trim();
  const pass = Deno.env.get("SMTP_PASS")?.trim();
  const from = (Deno.env.get("SMTP_FROM") || user || "").trim();
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  const secure =
    (Deno.env.get("SMTP_SECURE") || (port === 465 ? "true" : "false"))
      .toLowerCase() === "true";

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

export function zipFilename(copy: EmailCopy, answers: KitPerson) {
  return `${copy.zipPrefix}_${answers.familyName}_${answers.givenName}.zip`
    .replace(/[^\w.\-]+/g, "_");
}

export function buildEmailHtml(copy: EmailCopy, name: string, formCodes: string[]) {
  const first = escapeHtml(name.split(" ")[0] || name);
  const list = formCodes.map((c) => escapeHtml(c.toUpperCase())).join(", ");
  const kitTitle = escapeHtml(copy.kitLabel);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your ${kitTitle} kit</title></head>
<body style="margin:0;padding:0;background:#F4F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.carbon};">
  <table role="presentation" width="100%" style="background:#F4F5F5;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:600px;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:28px 32px 20px;background:linear-gradient(180deg, ${BRAND.yuzuLight} 0%, ${BRAND.paper} 100%);border-bottom:1px solid ${BRAND.border};">
        <img src="${LOGO_URL}" width="220" alt="Yuzu.solutions" style="display:block;border:0;max-width:220px;height:auto;">
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${first},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
          Your <strong>Canadian ${kitTitle} kit</strong> was filled from the answers you submitted on the Yuzu automation demo.
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

export async function sendKitEmail(
  copy: EmailCopy,
  answers: KitPerson,
  forms: FilledFormLike[],
  zipBytes: Uint8Array,
) {
  const { from, transporter } = createSmtpTransporter();
  const name = `${answers.givenName} ${answers.familyName}`.trim();
  const filename = zipFilename(copy, answers);
  const codes = forms.map((f) => f.code);

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: answers.email,
    replyTo: from,
    subject: copy.userSubject,
    text: [
      `Hi ${answers.givenName},`,
      "",
      `Your Canadian ${copy.kitLabel} kit was filled from the Yuzu automation demo.`,
      `Forms included: ${codes.map((c) => c.toUpperCase()).join(", ")}.`,
      "The ZIP is attached.",
      "",
      "Adrien Yvin · Yuzu.solutions",
      SITE_URL,
    ].join("\n"),
    html: buildEmailHtml(copy, name, codes),
    attachments: [
      {
        filename,
        content: zipBytes,
        contentType: "application/zip",
      },
    ],
  });
}

export async function sendNotify(
  copy: EmailCopy,
  answers: KitPerson,
  forms: FilledFormLike[],
) {
  const { from, transporter } = createSmtpTransporter();
  const notifyTo = (Deno.env.get("INTAKE_NOTIFY_EMAIL") || NOTIFY_EMAIL).trim();
  const name = `${answers.givenName} ${answers.familyName}`;

  await transporter.sendMail({
    from: `"Yuzu.solutions" <${from}>`,
    to: notifyTo,
    replyTo: answers.email,
    subject: `${copy.notifySubjectPrefix}: ${name}`,
    text: [
      copy.notifyBodyTitle,
      "",
      `Name: ${name}`,
      `Email: ${answers.email}`,
      `Forms: ${forms.map((f) => f.code).join(", ")}`,
    ].join("\n"),
  });
}

/** Shared Deno.serve POST router for permit kits. */
export function servePermitKit<
  TAnswers extends KitPerson,
  TForm extends FilledFormLike = FilledFormLike,
>(
  handlers: PermitKitHandlers<TAnswers, TForm>,
) {
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

    if (payload.action === "select-forms") {
      const forms = handlers.selectFormsFromPayload(payload);
      return jsonResponse({ ok: true, forms }, 200, origin);
    }

    if (payload.action === "save-draft" || payload.action === "load-draft") {
      if (!supabaseUrl || !serviceRoleKey) {
        return jsonResponse({ error: "Server misconfigured" }, 500, origin);
      }
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const draftLimit = await enforceDraftRateLimits(
        supabase,
        handlers.rates,
        remoteIp,
        String(payload.action),
      );
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
        const result = await handlers.drafts.saveDraft(supabase, {
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
          validDays: handlers.drafts.DRAFT_TTL_DAYS,
        }, 200, origin);
      }

      const result = await handlers.drafts.loadDraft(supabase, {
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
      return jsonResponse(
        { error: captcha.error || "Captcha verification failed" },
        400,
        origin,
      );
    }

    const validated = handlers.validateKit(payload);
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400, origin);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const rateLimit = await enforceRateLimits(
      supabase,
      handlers.rates,
      remoteIp,
      validated.answers.email,
    );
    if (!rateLimit.ok) {
      return jsonResponse({ error: rateLimit.error }, 429, origin);
    }

    const delivery = cleanText(payload.delivery, 20).toLowerCase() === "download"
      ? "download"
      : "email";

    let forms: TForm[];
    let zipBytes: Uint8Array;
    try {
      forms = await handlers.fillKitForms(validated.answers);
      zipBytes = await handlers.zipFilledForms(forms);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error("Kit fill failed:", detail);
      return jsonResponse(
        { error: `Could not fill the kit: ${detail}` },
        500,
        origin,
      );
    }

    if (delivery === "download") {
      try {
        await sendNotify(handlers.email, validated.answers, forms);
      } catch (error) {
        console.error("Notify email failed:", error);
      }
      return new Response(zipBytes as unknown as BodyInit, {
        status: 200,
        headers: {
          ...buildCorsHeaders(origin),
          "Content-Type": "application/zip",
          "Content-Disposition":
            `attachment; filename="${zipFilename(handlers.email, validated.answers)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    try {
      await sendKitEmail(handlers.email, validated.answers, forms, zipBytes);
    } catch (error) {
      console.error("Kit email failed:", error);
      return jsonResponse({ error: "Could not send the kit email" }, 500, origin);
    }

    try {
      await sendNotify(handlers.email, validated.answers, forms);
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
}

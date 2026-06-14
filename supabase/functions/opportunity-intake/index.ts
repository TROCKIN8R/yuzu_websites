import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com",
]);

const CALENDLY_URL = "https://calendly.com/adrienyvin/30min";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

function buildRow(name: string, email: string, source: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  const isFree = FREE_DOMAINS.has(domain);
  return {
    name: name.trim(),
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
  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: Inter, system-ui, sans-serif; color: #1c1917; line-height: 1.6; max-width: 560px;">
  <p>Hi ${firstName},</p>
  <p>Thanks for trying the Yuzu opportunity tracker demo on <a href="https://yuzu.solutions">yuzu.solutions</a>. Your submission is in the live table now.</p>
  <p>If you would like to talk through how this kind of intake, routing, and enrichment fits your stack, book a 30-minute call:</p>
  <p><a href="${CALENDLY_URL}" style="display:inline-block;padding:12px 20px;background:#eab308;color:#fff;font-weight:700;text-decoration:none;border-radius:12px;">Book a 30-min call</a></p>
  <p>Or reply to this email with what you are trying to automate.</p>
  <p>Adrien<br>Yuzu.solutions</p>
</body>
</html>`;
}

function buildEmailText(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  return [
    `Hi ${firstName},`,
    "",
    "Thanks for trying the Yuzu opportunity tracker demo on yuzu.solutions. Your submission is in the live table now.",
    "",
    "If you would like to talk through how this kind of intake, routing, and enrichment fits your stack, book a 30-minute call:",
    CALENDLY_URL,
    "",
    "Or reply to this email with what you are trying to automate.",
    "",
    "Adrien",
    "Yuzu.solutions",
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
    subject: "Thanks for trying the Yuzu automation demo",
    text: buildEmailText(name),
    html: buildEmailHtml(name),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: { name?: string; email?: string; source?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const source = String(payload.source || "yuzu.solutions").trim();

  if (!name || name.length > 120) {
    return jsonResponse({ error: "Name is required (max 120 characters)" }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Valid email is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const table = (Deno.env.get("OPPORTUNITIES_TABLE") || "opportunities").trim();
  const row = buildRow(name, email, source);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error: insertError } = await supabase.from(table).insert(row);
  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  let emailSent = false;
  let emailError = "";
  try {
    await sendFollowUpEmail(name, email);
    emailSent = true;
  } catch (error) {
    emailError = error instanceof Error ? error.message : String(error);
    console.error("Follow-up email failed:", emailError);
  }

  return jsonResponse({
    ok: true,
    row,
    emailSent,
    emailError: emailSent ? null : emailError,
  });
});

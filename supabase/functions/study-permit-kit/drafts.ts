/**
 * Save / resume helpers for study-permit kit drafts.
 * Secret code is shown once; only hashes of code, DOB, and passport are stored.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const DRAFT_TTL_DAYS = 30;

export function normalizePassport(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 40);
}

export function normalizeDob(year: string, month: string, day: string): string | null {
  const y = String(year || "").replace(/\D/g, "").slice(0, 4);
  const m = String(month || "").replace(/\D/g, "").padStart(2, "0").slice(-2);
  const d = String(day || "").replace(/\D/g, "").padStart(2, "0").slice(-2);
  if (y.length !== 4 || Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

export function normalizeResumeCode(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function randomChunk(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Human-readable code, e.g. YUZU-K7M2-9Q4P */
export function generateResumeCode(): string {
  return `YUZU-${randomChunk(4)}-${randomChunk(4)}`;
}

export function formatResumeCode(normalized: string): string {
  const n = normalizeResumeCode(normalized);
  if (n.startsWith("YUZU") && n.length === 12) {
    return `YUZU-${n.slice(4, 8)}-${n.slice(8, 12)}`;
  }
  return n;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashWithPepper(kind: string, value: string): Promise<string> {
  const pepper = (Deno.env.get("STUDY_KIT_DRAFT_PEPPER") || "yuzu-study-kit-draft-v1").trim();
  return sha256Hex(`${pepper}:${kind}:${value}`);
}

export async function hashResumeSecrets(input: {
  code: string;
  dob: string;
  passport: string;
}): Promise<{ codeHash: string; dobHash: string; passportHash: string }> {
  const code = normalizeResumeCode(input.code);
  const passport = normalizePassport(input.passport);
  return {
    codeHash: await hashWithPepper("code", code),
    dobHash: await hashWithPepper("dob", input.dob),
    passportHash: await hashWithPepper("passport", passport),
  };
}

export type DraftRecord = {
  id: string;
  step: number;
  payload: Record<string, unknown>;
  expires_at: string;
};

export async function saveDraft(
  supabase: SupabaseClient,
  input: {
    step: number;
    payload: Record<string, unknown>;
    dob: string;
    passport: string;
  },
): Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; error: string }> {
  const passport = normalizePassport(input.passport);
  if (!passport || passport.length < 5) {
    return { ok: false, error: "Enter a passport number before saving (needed to resume later)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) {
    return { ok: false, error: "Enter your date of birth before saving (needed to resume later)." };
  }

  const code = generateResumeCode();
  const hashes = await hashResumeSecrets({
    code,
    dob: input.dob,
    passport,
  });
  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Strip delivery secrets from stored payload
  const { captchaToken: _c, consent: _consent, delivery: _d, ...safePayload } = input.payload;
  const step = Number.isFinite(input.step)
    ? Math.max(0, Math.min(20, Math.floor(input.step)))
    : 0;

  const { error } = await supabase.from("study_permit_drafts").insert({
    code_hash: hashes.codeHash,
    dob_hash: hashes.dobHash,
    passport_hash: hashes.passportHash,
    step,
    payload: { ...safePayload, formsConfirmed: true },
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Draft save failed:", error.message);
    return { ok: false, error: "Could not save your progress. Try again shortly." };
  }

  return { ok: true, code, expiresAt };
}

export async function loadDraft(
  supabase: SupabaseClient,
  input: {
    code: string;
    dob: string;
    passport: string;
  },
): Promise<{ ok: true; draft: DraftRecord } | { ok: false; error: string }> {
  const passport = normalizePassport(input.passport);
  if (!passport || passport.length < 5) {
    return { ok: false, error: "Enter the passport number used when you saved." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob)) {
    return { ok: false, error: "Enter the date of birth used when you saved." };
  }
  const code = normalizeResumeCode(input.code);
  if (code.length < 8) {
    return { ok: false, error: "Enter your resume code (for example YUZU-XXXX-XXXX)." };
  }

  const hashes = await hashResumeSecrets({
    code,
    dob: input.dob,
    passport,
  });

  const { data, error } = await supabase
    .from("study_permit_drafts")
    .select("id, step, payload, expires_at")
    .eq("code_hash", hashes.codeHash)
    .eq("dob_hash", hashes.dobHash)
    .eq("passport_hash", hashes.passportHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Draft load failed:", error.message);
    return { ok: false, error: "Could not look up your draft. Try again shortly." };
  }
  if (!data) {
    return {
      ok: false,
      error: "No matching draft found. Check the code, birth date, and passport number — or the code may have expired (30 days).",
    };
  }

  const payload = (data.payload && typeof data.payload === "object")
    ? data.payload as Record<string, unknown>
    : {};

  return {
    ok: true,
    draft: {
      id: data.id,
      step: Number(data.step) || 0,
      payload,
      expires_at: data.expires_at,
    },
  };
}

export { DRAFT_TTL_DAYS };

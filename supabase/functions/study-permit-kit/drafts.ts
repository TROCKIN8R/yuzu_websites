/**
 * Save / resume helpers for study-permit kit drafts.
 *
 * - Resume code + family name (last name) are stored as peppered SHA-256 hashes only.
 * - Form payload is AES-256-GCM encrypted (STUDY_KIT_DRAFT_ENCRYPTION_KEY).
 * - Table access is service-role only (RLS + REVOKE); Edge Function decrypts on resume.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const DRAFT_TTL_DAYS = 30;
const ENC_VERSION = 1;
const ENC_ALG = "AES-GCM";

type EncryptedEnvelope = {
  enc: true;
  v: number;
  alg: typeof ENC_ALG;
  iv: string;
  data: string;
};

/** Normalize last name for resume matching (case-insensitive, accents folded lightly). */
export function normalizeFamilyName(raw: string): string {
  return String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9'\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function sha256Bytes(value: string | Uint8Array): Promise<Uint8Array> {
  const data = typeof value === "string"
    ? new TextEncoder().encode(value)
    : asBufferSource(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await sha256Bytes(value);
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireSecret(name: string): string {
  const value = (Deno.env.get(name) || "").trim();
  if (!value || value.length < 16) {
    throw new Error(
      `${name} must be set to a strong secret (16+ characters) in Edge Function secrets.`,
    );
  }
  return value;
}

async function hashWithPepper(kind: string, value: string): Promise<string> {
  const pepper = requireSecret("STUDY_KIT_DRAFT_PEPPER");
  return sha256Hex(`${pepper}:${kind}:${value}`);
}

export async function hashResumeSecrets(input: {
  code: string;
  familyName: string;
}): Promise<{ codeHash: string; familyNameHash: string }> {
  const code = normalizeResumeCode(input.code);
  const familyName = normalizeFamilyName(input.familyName);
  return {
    codeHash: await hashWithPepper("code", code),
    familyNameHash: await hashWithPepper("familyName", familyName),
  };
}

async function importPayloadKey(): Promise<CryptoKey> {
  const secret = requireSecret("STUDY_KIT_DRAFT_ENCRYPTION_KEY");
  // Accept raw passphrase or hex; always derive a 256-bit key via SHA-256.
  const keyBytes = await sha256Bytes(`yuzu-study-kit-payload-v1:${secret}`);
  return crypto.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    { name: ENC_ALG },
    false,
    ["encrypt", "decrypt"],
  );
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.enc === true &&
    row.alg === ENC_ALG &&
    typeof row.iv === "string" &&
    typeof row.data === "string";
}

async function encryptPayload(
  payload: Record<string, unknown>,
): Promise<EncryptedEnvelope> {
  const key = await importPayloadKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: ENC_ALG, iv: asBufferSource(iv) },
    key,
    asBufferSource(plaintext),
  );
  return {
    enc: true,
    v: ENC_VERSION,
    alg: ENC_ALG,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

async function decryptPayload(
  stored: unknown,
): Promise<Record<string, unknown>> {
  if (!isEncryptedEnvelope(stored)) {
    throw new Error(
      "Draft payload is not encrypted. Save a new draft after encryption was enabled.",
    );
  }
  const key = await importPayloadKey();
  const iv = base64ToBytes(stored.iv);
  const data = base64ToBytes(stored.data);
  const plainBuf = await crypto.subtle.decrypt(
    { name: ENC_ALG, iv: asBufferSource(iv) },
    key,
    asBufferSource(data),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plainBuf));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Decrypted draft payload is invalid.");
  }
  return parsed as Record<string, unknown>;
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
    familyName: string;
  },
): Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; error: string }> {
  const familyName = normalizeFamilyName(input.familyName);
  if (!familyName || familyName.length < 2) {
    return { ok: false, error: "Enter your family name (last name) before saving — it’s needed to resume later." };
  }

  const code = generateResumeCode();
  let hashes: { codeHash: string; familyNameHash: string };
  let encrypted: EncryptedEnvelope;
  try {
    hashes = await hashResumeSecrets({ code, familyName });
    const { captchaToken: _c, consent: _consent, delivery: _d, ...safePayload } = input.payload;
    encrypted = await encryptPayload({ ...safePayload, formsConfirmed: true });
  } catch (error) {
    console.error("Draft encrypt failed:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "Draft encryption is not configured on the server. Contact the site operator.",
    };
  }

  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const step = Number.isFinite(input.step)
    ? Math.max(0, Math.min(20, Math.floor(input.step)))
    : 0;

  const { error } = await supabase.from("study_permit_drafts").insert({
    code_hash: hashes.codeHash,
    family_name_hash: hashes.familyNameHash,
    step,
    payload: encrypted,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Draft save failed:", error.message, error.code || "");
    const msg = String(error.message || "").toLowerCase();
    if (
      msg.includes("could not find the table") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return {
        ok: false,
        error: "Draft storage is not set up yet. Run scripts/supabase_study_permit_drafts.sql (then the revoke script) in the Supabase SQL Editor.",
      };
    }
    if (msg.includes("family_name_hash") || msg.includes("column")) {
      return {
        ok: false,
        error: "Draft storage needs a schema update. Run scripts/supabase_study_permit_drafts_family_name.sql in the Supabase SQL Editor.",
      };
    }
    return { ok: false, error: "Could not save your progress. Try again shortly." };
  }

  return { ok: true, code, expiresAt };
}

export async function loadDraft(
  supabase: SupabaseClient,
  input: {
    code: string;
    familyName: string;
  },
): Promise<{ ok: true; draft: DraftRecord } | { ok: false; error: string }> {
  const familyName = normalizeFamilyName(input.familyName);
  if (!familyName || familyName.length < 2) {
    return { ok: false, error: "Enter the family name (last name) used when you saved." };
  }
  const code = normalizeResumeCode(input.code);
  if (code.length < 8) {
    return { ok: false, error: "Enter your resume code (for example YUZU-XXXX-XXXX)." };
  }

  let hashes: { codeHash: string; familyNameHash: string };
  try {
    hashes = await hashResumeSecrets({ code, familyName });
  } catch (error) {
    console.error("Draft crypto misconfigured:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "Draft encryption is not configured on the server. Contact the site operator.",
    };
  }

  const { data, error } = await supabase
    .from("study_permit_drafts")
    .select("id, step, payload, expires_at")
    .eq("code_hash", hashes.codeHash)
    .eq("family_name_hash", hashes.familyNameHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Draft load failed:", error.message);
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("family_name_hash") || msg.includes("column")) {
      return {
        ok: false,
        error: "Draft storage needs a schema update. Run scripts/supabase_study_permit_drafts_family_name.sql in the Supabase SQL Editor.",
      };
    }
    return { ok: false, error: "Could not look up your draft. Try again shortly." };
  }
  if (!data) {
    return {
      ok: false,
      error: "No matching draft found. Check the code and family name — or the code may have expired (30 days).",
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = await decryptPayload(data.payload);
  } catch (err) {
    console.error("Draft decrypt failed:", err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: "Could not unlock this draft. It may have been saved before encryption was enabled — please start a new save.",
    };
  }

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

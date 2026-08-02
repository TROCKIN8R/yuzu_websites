/**
 * Work-permit kit drafts — thin wrapper over shared draft store.
 * Uses the same STUDY_KIT_DRAFT_PEPPER / ENCRYPTION_KEY as study-permit-kit.
 */
export {
  normalizeFamilyName,
  normalizeResumeCode,
  generateResumeCode,
  formatResumeCode,
  hashResumeSecrets,
  DRAFT_TTL_DAYS,
  type DraftRecord,
} from "../_shared/permit_kit_drafts.ts";

import { createDraftStore } from "../_shared/permit_kit_drafts.ts";

const store = createDraftStore({
  table: "work_permit_drafts",
  setupSqlHint:
    "Draft storage is not set up yet. Run scripts/supabase_work_permit_drafts.sql (then the revoke script) in the Supabase SQL Editor.",
});

export const saveDraft = store.saveDraft;
export const loadDraft = store.loadDraft;

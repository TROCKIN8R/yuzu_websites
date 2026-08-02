#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${SUPABASE_CLI:-$HOME/.local/share/supabase/supabase}"
PROJECT_REF="mwgbeolcgigvpufjmodz"
FUNCTION="work-permit-kit"

if [[ ! -x "$CLI" ]]; then
  echo "Supabase CLI not found at $CLI"
  echo "Install: curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz | tar -xzf - -C ~/.local/share/supabase"
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN first."
  echo "Create one at: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

cd "$ROOT"
"$CLI" functions deploy "$FUNCTION" --project-ref "$PROJECT_REF"
echo "Deployed $FUNCTION to project $PROJECT_REF"
echo ""
echo "Required Edge Function secrets (same as study-permit-kit):"
echo "  STUDY_KIT_DRAFT_PEPPER              # long random string for resume-key hashing"
echo "  STUDY_KIT_DRAFT_ENCRYPTION_KEY      # long random string for AES-GCM payload encryption"
echo ""
echo "SQL (run once in SQL Editor, in order):"
echo "  1) scripts/supabase_work_permit_drafts.sql"
echo "  2) scripts/supabase_revoke_work_permit_drafts.sql"
echo ""
echo "Smoke (local):"
echo "  ~/.deno/bin/deno run -A supabase/functions/work-permit-kit/smoke_work.ts"

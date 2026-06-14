#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="${SUPABASE_CLI:-$HOME/.local/share/supabase/supabase}"
PROJECT_REF="mwgbeolcgigvpufjmodz"
FUNCTION="opportunity-intake"

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

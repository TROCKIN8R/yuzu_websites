# STM live transit demo setup

The STM API key must **never** ship in the public website. The browser calls a Supabase Edge Function (`stm-proxy`) that adds the `apikey` header server-side.

## Where to put secrets

| Secret | Where | Used by |
|--------|--------|---------|
| **`STM_API_KEY`** | Supabase → **Edge Functions → Secrets** | `stm-proxy` at runtime |
| **`STM_API_KEY`** | GitHub → **Settings → Secrets → Actions** | CI sync on deploy (recommended) |
| Supabase anon key | `yuzu_github_page/js/stm-config.js` | Public — safe to commit |

### 1. Get your STM API key

1. Log in to [portail développeurs STM](https://portail.developpeurs.stm.info/).
2. Create an application and enable:
   - **Données Ouvertes iBUS - GTFS-Realtime (v2.0)**
   - **API i3** (service status), if available on your app
3. **Publish** the application (must show **Enabled**).
4. Copy the API key from **Authentication & Credentials**.

### 2. Add the secret in Supabase

**Supabase Dashboard** → your project → **Edge Functions** → **Secrets**

```
STM_API_KEY=paste-your-stm-api-key-here
```

Value only — no quotes in the dashboard field.

### 3. Sync via GitHub (recommended)

Add the same key as a repository secret:

**GitHub** → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- Name: `STM_API_KEY`
- Value: your STM API key

The workflow `.github/workflows/deploy-supabase-functions.yml` syncs it to Supabase on every function deploy.

### 4. Deploy the proxy

Push to `main` (auto-deploy) or run manually:

```bash
export SUPABASE_ACCESS_TOKEN='your-token'
supabase secrets set "STM_API_KEY=your-stm-api-key" --project-ref mwgbeolcgigvpufjmodz
supabase functions deploy stm-proxy --project-ref mwgbeolcgigvpufjmodz
```

### 5. Local Edge Function testing

```bash
supabase secrets set "STM_API_KEY=your-stm-api-key" --project-ref mwgbeolcgigvpufjmodz
supabase functions serve stm-proxy --env-file supabase/.env.local
```

Optional: copy `js/stm-config.local.example.js` → `js/stm-config.local.js` and point `supabase.url` at `http://127.0.0.1:54321` for local serves. **Still do not put the STM key in that file.**

## Demo page

`/demos/stm-live.html` — polls:

- `serviceStatus` — métro / bus service messages (JSON)
- `vehiclePositions` — live bus positions (GTFS-RT → JSON via proxy)

## Do not put secrets here

- `stm-config.js` — public
- `stm-config.local.js` — gitignored, overrides only (no API keys)
- Any HTML/JS in `yuzu_github_page/`

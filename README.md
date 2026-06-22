# yuzu_websites

GitHub website for [Yuzu.solutions](https://yuzu.solutions) — *If life gives you Yuzu, make a dashboard.*

## Site location

The website lives in [`yuzu_github_page/`](yuzu_github_page/index.html).

## Deployment

| Trigger | Workflow | Result |
| --- | --- | --- |
| Pull request opened/updated | [Deploy PR Preview](.github/workflows/pr-preview.yml) | Preview at `https://trockin8r.github.io/yuzu_websites/pr-preview/pr-<number>/` |
| Push to `main` | [Deploy Production](.github/workflows/deploy-production.yml) | Live site at `https://trockin8r.github.io/yuzu_websites/` |

## One-time GitHub setup

1. **Pages source** — In repo **Settings → Pages**, set **Build and deployment → Source** to **Deploy from a branch**.
2. **Pages branch** — Choose branch `gh-pages`, folder `/ (root)`.
3. **Workflow permissions** — In **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**.

Both production and PR preview deploys publish to the `gh-pages` branch (production at the root, previews under `pr-preview/pr-<number>/`).

## Local preview

```bash
pip install -r scripts/requirements-blog.txt
python3 scripts/build_blog.py
python3 scripts/build_locales.py
python3 scripts/patch_nav_blog.py
python3 scripts/build_blog.py --teasers-only
cd yuzu_github_page
python3 -m http.server 8080
```

Then visit http://localhost:8080.

## Blog / Insights

Articles live in [`content/blog/`](content/blog/README.md) as Markdown (EN/FR/ES). CI builds static HTML, RSS feeds, and sitemap entries on each deploy. Scheduled posts are published daily by [Publish scheduled blog](.github/workflows/publish-scheduled-blog.yml).

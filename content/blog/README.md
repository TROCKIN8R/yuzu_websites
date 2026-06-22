# Yuzu.solutions Blog / Insights

Multilingual articles (EN, FR, ES) for SEO. Markdown is the source of truth; HTML is generated at deploy time.

## Folder structure

```
content/blog/my-article-slug/
  article.yaml    # metadata + scheduling
  en.md           # English body
  fr.md           # French body
  es.md           # Spanish body
```

## article.yaml fields

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | yes | URL slug (must match folder name) |
| `title` | yes | `{ en, fr, es }` display titles |
| `description` | yes | `{ en, fr, es }` meta descriptions (~155 chars) |
| `publish_at` | yes | ISO 8601 UTC datetime, e.g. `2026-07-01T13:00:00Z` |
| `status` | yes | `draft`, `scheduled`, or `published` |
| `author` | yes | Author name |
| `category` | yes | `bi-news`, `workflows`, or `new-tech` |
| `tags` | no | List of tag strings |
| `cover_image` | no | Path under `yuzu_github_page/`, e.g. `assets/blog/cover.png` |

## Status rules

- **draft:** not built, not in sitemap
- **scheduled:** hidden until `publish_at`; GitHub Actions flips to `published` when due
- **published:** live on site immediately

## Local preview

```bash
pip install -r scripts/requirements-blog.txt
python3 scripts/build_blog.py
python3 scripts/build_locales.py
python3 scripts/patch_nav_blog.py
python3 scripts/build_blog.py --teasers-only
cd yuzu_github_page && python3 -m http.server 8080
```

## Scheduling

Set `status: scheduled` and a future `publish_at`. The workflow `.github/workflows/publish-scheduled-blog.yml` runs daily and commits status changes to `main`, which triggers deploy.

Manual publish: set `status: published` and push, or run the workflow via **Actions → Publish scheduled blog → Run workflow**.

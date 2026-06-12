# yuzu_websites

yuzu.solutions GitHub website — static site for [zest.solutions](https://zest.solutions), hosted on GitHub Pages.

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

Open `yuzu_github_page/index.html` in a browser, or serve the folder locally:

```bash
cd yuzu_github_page
python3 -m http.server 8080
```

Then visit http://localhost:8080.

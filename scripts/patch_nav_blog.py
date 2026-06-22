#!/usr/bin/env python3
"""Add Insights / Blogue / Blog nav link to all site pages."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "yuzu_github_page"

DESKTOP_PATTERNS = [
    (
        re.compile(
            r'(</div>\s*</div>\s*)\n(\s*<a href="(?:\.\./)?(?:index\.html)?#founder" class="nav-pill-item">(?:Our Team|Notre équipe|Nuestro equipo)</a>)'
        ),
        lambda m, blog: f'{m.group(1)}\n                <a href="{blog}" class="nav-pill-item">{label(m)}</a>\n{m.group(2)}',
    ),
]

MOBILE_PATTERNS = [
    (
        re.compile(
            r'(</div>\s*)\n(\s*<a href="(?:\.\./)?(?:index\.html)?#founder" class="mobile-nav-link">(?:Our Team|Notre équipe|Nuestro equipo)</a>)'
        ),
        lambda m, blog: f'{m.group(1)}\n            <a href="{blog}" class="mobile-nav-link">{label(m)}</a>\n{m.group(2)}',
    ),
]


def detect_locale(text: str, path: Path) -> str:
    if "/fr/" in str(path) or path.parts[-2:] == ("fr", "index.html") or str(path).endswith("/fr/index.html"):
        return "fr"
    if "/es/" in str(path) or path.parts[-2:] == ("es", "index.html") or str(path).endswith("/es/index.html"):
        return "es"
    if 'lang="fr-CA"' in text[:800]:
        return "fr"
    if 'lang="es"' in text[:800] and 'lang="fr' not in text[:800]:
        return "es"
    return "en"


def blog_href(path: Path, locale: str) -> str:
    rel = path.relative_to(ROOT)
    parts = rel.parts
    if locale == "en":
        if len(parts) == 1:
            return "blog/index.html"
        if parts[0] == "services":
            return "../blog/index.html"
        if parts[0] == "blog":
            return "index.html"
        return "blog/index.html"
    # fr or es
    if len(parts) == 2 and parts[1] == "index.html":
        return "blog/index.html"
    if len(parts) == 3 and parts[1] == "services":
        return "../blog/index.html"
    if len(parts) == 3 and parts[1] == "blog":
        return "index.html"
    return "blog/index.html"


def nav_label(locale: str) -> str:
    return {"en": "Insights", "fr": "Blogue", "es": "Blog"}[locale]


def label(m: re.Match) -> str:
    text = m.group(2)
    if "Notre équipe" in text:
        return "Blogue"
    if "Nuestro equipo" in text:
        return "Blog"
    return "Insights"


def fix_blog_labels(text: str, locale: str) -> str:
    label = nav_label(locale)
    text = re.sub(
        r'(<a href="(?:\.\./)?blog/index\.html" class="nav-pill-item">)(?:Insights|Blogue|Blog)(</a>)',
        rf"\1{label}\2",
        text,
    )
    text = re.sub(
        r'(<a href="(?:\.\./)?blog/index\.html" class="mobile-nav-link">)(?:Insights|Blogue|Blog)(</a>)',
        rf"\1{label}\2",
        text,
    )
    return text


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    locale = detect_locale(text, path)
    blog = blog_href(path, locale)
    original = text

    has_blog_nav = 'href="blog/index.html"' in text or 'href="../blog/index.html"' in text
    if not has_blog_nav:
        for pattern, repl in DESKTOP_PATTERNS:
            if pattern.search(text):
                text = pattern.sub(lambda m: repl(m, blog), text, count=1)

        for pattern, repl in MOBILE_PATTERNS:
            if pattern.search(text):
                text = pattern.sub(lambda m: repl(m, blog), text, count=1)

    text = fix_blog_labels(text, locale)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for path in sorted(ROOT.rglob("*.html")):
        if "blog/" in str(path.relative_to(ROOT)) and path.name != "index.html":
            continue
        if patch_file(path):
            changed += 1
            print(f"Patched: {path.relative_to(ROOT)}")
    print(f"Done. {changed} file(s) updated.")


if __name__ == "__main__":
    main()

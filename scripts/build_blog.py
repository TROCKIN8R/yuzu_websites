#!/usr/bin/env python3
"""Build multilingual blog HTML from content/blog markdown sources."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

import markdown
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = REPO_ROOT / "content" / "blog"
SITE_ROOT = REPO_ROOT / "yuzu_github_page"
MANIFEST_PATH = CONTENT_DIR / ".published.json"
BASE = "https://yuzu.solutions"

LOCALES = ("en", "fr", "es")
LOCALE_META = {
    "en": {"html_lang": "en", "hreflang": "en", "og_locale": "en_US", "prefix": ""},
    "fr": {"html_lang": "fr-CA", "hreflang": "fr-CA", "og_locale": "fr_CA", "prefix": "/fr"},
    "es": {"html_lang": "es", "hreflang": "es", "og_locale": "es_ES", "prefix": "/es"},
}

UI = {
    "en": {
        "home": "Home",
        "insights": "Insights",
        "vision": "Vision",
        "services": "Services",
        "team": "Our Team",
        "get_started": "Get Started",
        "back_blog": "← Back to Insights",
        "blog_heading": "Insights",
        "blog_sub": "BI news, workflows, and new technologies from the Yuzu press room.",
        "by": "By",
        "read_more": "Read article",
        "rss_title": "Yuzu.solutions Insights",
    },
    "fr": {
        "home": "Accueil",
        "insights": "Blogue",
        "vision": "Vision",
        "services": "Services",
        "team": "Notre équipe",
        "get_started": "Commencer",
        "back_blog": "← Retour au blogue",
        "blog_heading": "Blogue",
        "blog_sub": "Actualités BI, workflows et nouvelles technologies depuis la presse Yuzu.",
        "by": "Par",
        "read_more": "Lire l'article",
        "rss_title": "Blogue Yuzu.solutions",
    },
    "es": {
        "home": "Inicio",
        "insights": "Blog",
        "vision": "Visión",
        "services": "Servicios",
        "team": "Nuestro equipo",
        "get_started": "Empezar",
        "back_blog": "← Volver al blog",
        "blog_heading": "Blog",
        "blog_sub": "Noticias BI, flujos de trabajo y nuevas tecnologías desde la prensa Yuzu.",
        "by": "Por",
        "read_more": "Leer artículo",
        "rss_title": "Blog Yuzu.solutions",
    },
}

CATEGORIES = {
    "bi-news": {"en": "BI News", "fr": "Actualités BI", "es": "Noticias BI"},
    "workflows": {"en": "Workflows", "fr": "Workflows", "es": "Flujos de trabajo"},
    "new-tech": {"en": "New Tech", "fr": "Nouvelles tech", "es": "Nueva tecnología"},
}

SERVICES = [
    ("bi-ai-enablement", "⚡", {
        "en": ("BI & AI Enablement", "Fabric training, GitHub CI/CD & AI agents · The Accelerator"),
        "fr": ("Activation BI et IA", "Formation Fabric, GitHub CI/CD et agents IA · L'accélérateur"),
        "es": ("Activación BI e IA", "Formación Fabric, GitHub CI/CD y agentes IA · El acelerador"),
    }),
    ("infrastructure-data", "🏗️", {
        "en": ("Infrastructure & Data", "Fabric lakehouses, ETL & semantic models · The Core"),
        "fr": ("Infrastructure et données", "Lakehouses Fabric, ETL et modèles sémantiques · Le cœur"),
        "es": ("Infraestructura y datos", "Lakehouses Fabric, ETL y modelos semánticos · El núcleo"),
    }),
    ("technical-debt", "🛠️", {
        "en": ("Technical Debt & Rescue", "Legacy fixes, performance & model cleanup · The Detox"),
        "fr": ("Dette technique et sauvetage", "Correctifs legacy, performance et nettoyage de modèles · Le détox"),
        "es": ("Deuda técnica y rescate", "Correcciones legacy, rendimiento y limpieza de modelos · El detox"),
    }),
    ("bi-dashboard-delivery", "📊", {
        "en": ("BI & Dashboard Delivery", "Semantic models, exec dashboards & self-serve BI · The Single Pour"),
        "fr": ("Livraison BI et tableaux de bord", "Modèles sémantiques, tableaux exécutifs et BI libre-service · La verse unique"),
        "es": ("Entrega BI y dashboards", "Modelos semánticos, dashboards ejecutivos y autoservicio · El vertido único"),
    }),
    ("mvp-builds", "🚀", {
        "en": ("MVP Builds", "Internal tools, portals & rapid prototypes · The First Press"),
        "fr": ("Constructions MVP", "Outils internes, portails et prototypes rapides · La première pressée"),
        "es": ("Construcciones MVP", "Herramientas internas, portales y prototipos rápidos · La primera prensada"),
    }),
    ("ai-automation", "🤖", {
        "en": ("AI & Automation", "Agents, workflows & LLM integrations · The Zest"),
        "fr": ("IA et automatisation", "Agents, flux de travail et intégrations LLM · Le zeste"),
        "es": ("IA y automatización", "Agentes, flujos de trabajo e integraciones LLM · El zest"),
    }),
]

MD = markdown.Markdown(extensions=["extra", "sane_lists", "smarty"])

BLOG_THEME_COUNT = 50
BLOG_BG_FAMILIES = ("yuzu", "zest", "kumquat", "info")
BLOG_BG_STEPS_BY_FAMILY: dict[str, tuple[str, ...]] = {
    "yuzu": ("25", "50", "100", "200"),
    "zest": ("25", "50", "100", "200"),
    "kumquat": ("25", "50", "100", "200"),
    "info": ("25", "50", "100"),
}
BLOG_ACCENT_SOFT_STEP: dict[str, str] = {
    "yuzu": "200",
    "zest": "200",
    "kumquat": "200",
    "info": "100",
}
BLOG_ACCENT_MUTED_STEP: dict[str, str] = {
    "yuzu": "300",
    "zest": "300",
    "kumquat": "300",
    "info": "300",
}


def build_theme_specs() -> list[tuple[str, str, str]]:
    """50 light page backgrounds paired with accent ramps from the brand palette."""
    specs: list[tuple[str, str, str]] = []
    for bg_family in BLOG_BG_FAMILIES:
        for step in BLOG_BG_STEPS_BY_FAMILY[bg_family]:
            for accent_family in BLOG_BG_FAMILIES:
                specs.append((bg_family, step, accent_family))
                if len(specs) >= BLOG_THEME_COUNT:
                    return specs
    return specs


THEME_SPECS = build_theme_specs()


def theme_index(slug: str) -> int:
    digest = hashlib.md5(slug.encode("utf-8")).hexdigest()
    return int(digest, 16) % BLOG_THEME_COUNT


def theme_class(slug: str) -> str:
    return f"blog-theme-{theme_index(slug):02d}"


def write_blog_themes_css() -> None:
    lines = [
        "/* Generated by scripts/build_blog.py — 50 brand palette article themes */",
        "",
    ]
    for idx, (bg_family, bg_step, accent_family) in enumerate(THEME_SPECS):
        soft = BLOG_ACCENT_SOFT_STEP[accent_family]
        muted = BLOG_ACCENT_MUTED_STEP[accent_family]
        lines.append(f".blog-theme-{idx:02d} {{")
        lines.append(f"    --blog-bg: var(--{bg_family}-{bg_step});")
        lines.append(f"    --blog-hero-bg: var(--{accent_family}-100);")
        lines.append(f"    --blog-accent: var(--{accent_family}-700);")
        lines.append(f"    --blog-accent-mid: var(--{accent_family}-500);")
        lines.append(f"    --blog-accent-soft: var(--{accent_family}-{soft});")
        lines.append(f"    --blog-accent-muted: var(--{accent_family}-{muted});")
        lines.append(f"    --blog-tag-bg: var(--{accent_family}-100);")
        lines.append(f"    --blog-tag-text: var(--{accent_family}-900);")
        lines.append(f"    --blog-link: var(--{accent_family}-800);")
        lines.append(f"    --blog-link-hover: var(--{accent_family}-950);")
        lines.append(f"    --blog-card-accent: var(--{accent_family}-500);")
        lines.append("}")
        lines.append("")
    (SITE_ROOT / "css" / "blog-themes.css").write_text("\n".join(lines), encoding="utf-8")


def enhance_prose(body_html: str) -> str:
    body_html = re.sub(r"<table>", '<div class="blog-prose-table-wrap"><table>', body_html)
    body_html = re.sub(r"</table>", "</table></div>", body_html)
    return body_html


def parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def format_date(dt: datetime, locale: str) -> str:
    months_en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    months_fr = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    months_es = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."]
    months = {"en": months_en, "fr": months_fr, "es": months_es}[locale]
    return f"{months[dt.month - 1]} {dt.day}, {dt.year}"


def article_dir_paths(slug: str) -> dict[str, str]:
    return {
        "en": f"/blog/{slug}.html",
        "fr": f"/fr/blog/{slug}.html",
        "es": f"/es/blog/{slug}.html",
    }


def index_paths() -> dict[str, str]:
    return {"en": "/blog/index.html", "fr": "/fr/blog/index.html", "es": "/es/blog/index.html"}


def site_paths(locale: str) -> dict[str, str]:
    """Relative paths from blog pages (index or article) to site assets."""
    if locale == "en":
        return {
            "assets": "../assets",
            "css": "../css",
            "js": "../js",
            "home": "../index.html",
            "services_prefix": "../services",
            "blog_index": "index.html",
        }
    return {
        "assets": "../../assets",
        "css": "../../css",
        "js": "../../js",
        "home": "../index.html",
        "services_prefix": "../services",
        "blog_index": "index.html",
    }


def blog_url(locale: str, slug: str | None = None) -> str:
    prefix = LOCALE_META[locale]["prefix"]
    if slug:
        return f"{BASE}{prefix}/blog/{slug}.html"
    return f"{BASE}{prefix}/blog/index.html"


def load_article(folder: Path) -> dict | None:
    yaml_path = folder / "article.yaml"
    if not yaml_path.exists():
        return None
    meta = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if not meta or not meta.get("slug"):
        return None
    bodies = {}
    for loc in LOCALES:
        md_path = folder / f"{loc}.md"
        if md_path.exists():
            bodies[loc] = md_path.read_text(encoding="utf-8")
    meta["_folder"] = folder
    meta["_bodies"] = bodies
    meta["_publish_dt"] = parse_dt(str(meta["publish_at"]))
    return meta


def load_all_articles() -> list[dict]:
    articles = []
    if not CONTENT_DIR.exists():
        return articles
    for folder in sorted(CONTENT_DIR.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        article = load_article(folder)
        if article:
            articles.append(article)
    articles.sort(key=lambda a: a["_publish_dt"], reverse=True)
    return articles


def publish_due(now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    changed = False
    for folder in CONTENT_DIR.iterdir():
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        yaml_path = folder / "article.yaml"
        if not yaml_path.exists():
            continue
        meta = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        if meta.get("status") != "scheduled":
            continue
        if parse_dt(str(meta["publish_at"])) <= now:
            meta["status"] = "published"
            yaml_path.write_text(
                yaml.dump(meta, sort_keys=False, allow_unicode=True, default_flow_style=False),
                encoding="utf-8",
            )
            changed = True
            print(f"Published: {meta.get('slug', folder.name)}")
    return changed


def published_articles(articles: list[dict]) -> list[dict]:
    return [a for a in articles if a.get("status") == "published"]


def hreflang_block(page: str, slug: str | None = None) -> str:
    if page == "index":
        urls = index_paths()
    else:
        urls = article_dir_paths(slug or "")
    lines = [
        f'    <link rel="alternate" hreflang="en" href="{BASE}{urls["en"]}">',
        f'    <link rel="alternate" hreflang="fr-CA" href="{BASE}{urls["fr"]}">',
        f'    <link rel="alternate" hreflang="es" href="{BASE}{urls["es"]}">',
        f'    <link rel="alternate" hreflang="x-default" href="{BASE}{urls["en"]}">',
    ]
    return "\n".join(lines)


def mega_menu(locale: str, paths: dict[str, str], mobile: bool = False) -> str:
    items = []
    role = "" if mobile else ' role="menuitem"'
    for slug, icon, labels in SERVICES:
        title, sub = labels[locale]
        href = f'{paths["services_prefix"]}/{slug}.html'
        items.append(
            f'<a href="{href}" class="mega-item"{role}>\n'
            f'                                <div class="mega-icon">{icon}</div>\n'
            f"                                <div>\n"
            f"                                    <h4>{html.escape(title)}</h4>\n"
            f"                                    <p>{html.escape(sub)}</p>\n"
            f"                                </div>\n"
            f"                            </a>"
        )
    indent = "                " if mobile else ""
    return f"\n{indent}".join(items)


def lang_switcher(locale: str, slug: str | None = None) -> str:
    urls = index_paths() if slug is None else article_dir_paths(slug)
    parts = []
    for loc, hreflang, lang_attr in [("en", "en", "en"), ("fr", "fr-CA", "fr-CA"), ("es", "es", "es")]:
        active = " active" if loc == locale else ""
        parts.append(
            f'<a href="{urls[loc]}" class="lang-switch-btn{active}" hreflang="{hreflang}" lang="{lang_attr}">'
            f"{loc.upper()}</a>"
        )
    return "\n                ".join(parts)


def render_breadcrumb(locale: str, category: str, title: str, canonical: str) -> str:
    ui = UI[locale]
    paths = site_paths(locale)
    blog_index = f"{BASE}{LOCALE_META[locale]['prefix']}/blog/index.html"
    return f"""    <nav class="blog-breadcrumb" aria-label="Breadcrumb">
        <ol class="blog-breadcrumb__list" itemscope itemtype="https://schema.org/BreadcrumbList">
            <li class="blog-breadcrumb__item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                <a href="{paths['home']}" itemprop="item"><span itemprop="name">{html.escape(ui['home'])}</span></a>
                <meta itemprop="position" content="1">
            </li>
            <li class="blog-breadcrumb__item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                <a href="{paths['blog_index']}" itemprop="item"><span itemprop="name">{html.escape(ui['insights'])}</span></a>
                <meta itemprop="position" content="2">
            </li>
            <li class="blog-breadcrumb__item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                <a href="{paths['blog_index']}" itemprop="item"><span itemprop="name">{html.escape(category)}</span></a>
                <meta itemprop="position" content="3">
            </li>
            <li class="blog-breadcrumb__item blog-breadcrumb__item--current" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem" aria-current="page">
                <span itemprop="name">{html.escape(title)}</span>
                <meta itemprop="item" content="{canonical}">
                <meta itemprop="position" content="4">
            </li>
        </ol>
    </nav>"""


def render_nav(locale: str, active: str, slug: str | None = None) -> str:
    ui = UI[locale]
    paths = site_paths(locale)
    insights_active = " active" if active == "insights" else ""
    home = paths["home"]
    blog_href = paths["blog_index"]

    return f"""<nav class="sticky top-4 z-50 w-[94%] max-w-6xl mx-auto mt-4" id="mainNav">
    <div class="nav-bar-inner pl-5 pr-3 py-3 rounded-full bg-white/50 backdrop-blur-xl border border-white/60 shadow-lg shadow-yellow-200/40 ring-1 ring-black/5">
        <div class="shrink-0">
            <a href="{home}" class="yuzu-logo yuzu-logo--horizontal yuzu-logo--nav" aria-label="Yuzu Solutions">
                <object type="image/svg+xml" data="{paths['assets']}/yuzu-horizontal.svg" class="yuzu-logo__media" aria-hidden="true"></object>
            </a>
        </div>
        <div class="nav-bar-center">
            <div class="nav-pill-group" id="navPillGroup">
                <a href="{home}#vision" class="nav-pill-item">{ui['vision']}</a>
                <div class="nav-services-wrap" id="servicesNavWrap">
                    <a href="{home}#our-recipes" class="nav-pill-btn" id="servicesNavBtn" aria-haspopup="true" aria-expanded="false">
                        {ui['services']} <span class="nav-chevron">▾</span>
                    </a>
                    <div class="mega-menu" id="servicesMegaMenu" role="menu">
                        <div class="mega-menu-grid">
{mega_menu(locale, paths)}
                        </div>
                    </div>
                </div>
                <a href="{blog_href}" class="nav-pill-item{insights_active}">{ui['insights']}</a>
                <a href="{home}#founder" class="nav-pill-item">{ui['team']}</a>
            </div>
        </div>
        <div class="nav-bar-end">
            <div class="lang-switch hidden sm:flex" role="navigation" aria-label="Language">
                {lang_switcher(locale, slug)}
            </div>
            <a href="https://calendly.com/adrienyvin/30min" class="nav-cta-desktop px-4 sm:px-5 py-2 bg-yellow-500 text-white text-sm font-bold rounded-full hover:bg-yellow-600 shadow-sm transition whitespace-nowrap" target="_blank" rel="noopener noreferrer">{ui['get_started']}</a>
            <button type="button" class="nav-hamburger" id="navHamburger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavPanel">
                <span class="nav-hamburger-box" aria-hidden="true"><span></span><span></span><span></span></span>
            </button>
        </div>
    </div>
    <div class="mobile-nav-panel" id="mobileNavPanel" aria-hidden="true">
        <div class="mobile-nav-backdrop" id="mobileNavBackdrop"></div>
        <div class="mobile-nav-sheet" role="dialog" aria-label="Navigation menu">
            <a href="{home}#vision" class="mobile-nav-link">{ui['vision']}</a>
            <div class="mobile-nav-services-row">
                <a href="{home}#our-recipes" class="mobile-nav-link">{ui['services']}</a>
                <button type="button" class="mobile-nav-chevron-btn" id="mobileServicesToggle" aria-expanded="false" aria-controls="mobileServicesSub" aria-label="Show service categories">
                    <span class="nav-chevron" aria-hidden="true">▾</span>
                </button>
            </div>
            <div class="mobile-nav-sub" id="mobileServicesSub">
{mega_menu(locale, paths, mobile=True)}
            </div>
            <a href="{blog_href}" class="mobile-nav-link">{ui['insights']}</a>
            <a href="{home}#founder" class="mobile-nav-link">{ui['team']}</a>
            <div class="mobile-nav-footer">
                <div class="lang-switch sm:hidden" role="navigation" aria-label="Language">
                {lang_switcher(locale, slug)}
            </div>
                <a href="https://calendly.com/adrienyvin/30min" class="mobile-nav-cta" target="_blank" rel="noopener noreferrer">{ui['get_started']}</a>
            </div>
        </div>
    </div>
</nav>"""


def render_footer(locale: str) -> str:
    paths = site_paths(locale)
    return f"""<footer class="site-footer site-footer--compact mt-auto">
    <div class="site-footer__inner">
        <a href="{paths['home']}" class="yuzu-logo yuzu-logo--horizontal yuzu-logo--footer yuzu-logo--on-dark" aria-label="Yuzu Solutions">
            <object type="image/svg+xml" data="{paths['assets']}/yuzu-horizontal.svg" class="yuzu-logo__media" aria-hidden="true"></object>
        </a>
        <p class="site-footer__quip">Powered by yuzu, ETL, and the courage to finally delete that 47-tab spreadsheet.</p>
        <p class="site-footer__copy">© 2026 Yuzu.solutions</p>
    </div>
</footer>"""


def head_common(
    locale: str,
    title: str,
    description: str,
    canonical: str,
    page: str,
    slug: str | None,
    og_type: str = "website",
    published_iso: str | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
) -> str:
    lm = LOCALE_META[locale]
    feed_path = index_paths()[locale].replace("index.html", "feed.xml")
    esc_title = html.escape(title)
    esc_desc = html.escape(description)
    article_meta = ""
    if og_type == "article" and published_iso:
        article_meta = f'\n    <meta property="article:published_time" content="{published_iso}">'
    json_ld = ""
    if page == "article" and slug and published_iso:
        home_name = UI[locale]["home"]
        insights_name = UI[locale]["insights"]
        category_name = category or CATEGORIES.get("workflows", {}).get(locale, "Insights")
        keywords_json = json.dumps(", ".join(tags)) if tags else None
        keywords_field = f',\n          "keywords": {keywords_json}' if keywords_json else ""
        json_ld = f"""
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@graph": [
        {{
          "@type": "BreadcrumbList",
          "itemListElement": [
            {{ "@type": "ListItem", "position": 1, "name": {json.dumps(home_name)}, "item": "{BASE}{lm['prefix'] or '/'}" }},
            {{ "@type": "ListItem", "position": 2, "name": {json.dumps(insights_name)}, "item": "{blog_url(locale)}" }},
            {{ "@type": "ListItem", "position": 3, "name": {json.dumps(category_name)}, "item": "{blog_url(locale)}" }},
            {{ "@type": "ListItem", "position": 4, "name": {json.dumps(title)}, "item": "{canonical}" }}
          ]
        }},
        {{
          "@type": "BlogPosting",
          "headline": {json.dumps(title)},
          "description": {json.dumps(description)},
          "datePublished": "{published_iso}",
          "dateModified": "{published_iso}",
          "author": {{ "@type": "Person", "name": "Adrien Yvin" }},
          "publisher": {{ "@type": "Organization", "name": "Yuzu.solutions", "url": "{BASE}/" }},
          "mainEntityOfPage": {{ "@type": "WebPage", "@id": "{canonical}" }},
          "articleSection": {json.dumps(category_name)},
          "inLanguage": "{lm['html_lang']}",
          "url": "{canonical}"{keywords_field}
        }}
      ]
    }}
    </script>"""
    elif page == "index":
        json_ld = f"""
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": {json.dumps(UI[locale]['rss_title'])},
      "description": {json.dumps(description)},
      "url": "{blog_url(locale)}",
      "publisher": {{ "@type": "Organization", "name": "Yuzu.solutions", "url": "{BASE}/" }},
      "inLanguage": "{lm['html_lang']}"
    }}
    </script>"""

    paths = site_paths(locale)
    return f"""    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{esc_title} | Yuzu.solutions</title>
    <meta name="description" content="{esc_desc}">
    <meta property="og:type" content="{og_type}">
    <meta property="og:site_name" content="Yuzu.solutions">
    <meta property="og:title" content="{esc_title}">
    <meta property="og:description" content="{esc_desc}">
    <meta property="og:url" content="{canonical}">
    <meta property="og:image" content="{BASE}/assets/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="🍋 Yuzu.solutions">{article_meta}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="{BASE}/assets/og-image.png">
    <link rel="icon" href="{paths['assets']}/favicon.svg" type="image/svg+xml">
    <link rel="canonical" href="{canonical}">
{hreflang_block(page, slug)}
    <meta property="og:locale" content="{lm['og_locale']}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="author" content="Adrien Yvin">
    <meta name="theme-color" content="#F9F9F9">
    <link rel="alternate" type="application/rss+xml" title="{html.escape(UI[locale]['rss_title'])}" href="{BASE}{feed_path}">
    <link rel="alternate" type="text/plain" href="{BASE}/llms.txt" title="LLM-readable site summary">{json_ld}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{paths['css']}/design-tokens.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="{paths['js']}/tailwind-config.js"></script>
    <link rel="stylesheet" href="{paths['css']}/site.css">
    <link rel="stylesheet" href="{paths['css']}/blog-themes.css">
    <link rel="stylesheet" href="{paths['css']}/logo.css">"""


def render_article_page(article: dict, locale: str) -> str:
    slug = article["slug"]
    ui = UI[locale]
    title = article["title"][locale]
    description = article["description"][locale]
    body_md = article["_bodies"].get(locale, "")
    body_html = enhance_prose(MD.convert(body_md))
    MD.reset()
    dt = article["_publish_dt"]
    date_str = format_date(dt, locale)
    published_iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    category = CATEGORIES.get(article.get("category", ""), {}).get(locale, article.get("category", ""))
    tags = article.get("tags") or []
    tag_html = "".join(f'<span class="blog-tag">{html.escape(t)}</span>' for t in tags)
    canonical = blog_url(locale, slug)
    theme = theme_class(slug)

    return f"""<!DOCTYPE html>
<html lang="{LOCALE_META[locale]['html_lang']}">
<head>
{head_common(locale, title, description, canonical, "article", slug, "article", published_iso, category, tags)}
</head>
<body class="min-h-screen flex flex-col nav-on-blog blog-article-page {theme}">
{render_nav(locale, "insights", slug)}
<main class="blog-article-shell">
{render_breadcrumb(locale, category, title, canonical)}
    <article class="blog-article">
        <header class="blog-article-hero">
            <span class="blog-category-pill">{html.escape(category)}</span>
            <h1 class="blog-article-title">{html.escape(title)}</h1>
            <p class="blog-article-meta">{ui['by']} {html.escape(article.get('author', 'Adrien Yvin'))} · <time datetime="{published_iso}">{date_str}</time></p>
            {f'<div class="blog-tags">{tag_html}</div>' if tag_html else ''}
        </header>
        <div class="blog-prose-card">
            <div class="blog-prose">
                {body_html}
            </div>
        </div>
    </article>
</main>
{render_footer(locale)}
<script src="{site_paths(locale)['js']}/site.js"></script>
<script src="{site_paths(locale)['js']}/nav.js"></script>
</body>
</html>
"""


def render_index_page(articles: list[dict], locale: str) -> str:
    ui = UI[locale]
    description = ui["blog_sub"]
    canonical = blog_url(locale)
    cards = []
    for article in articles:
        slug = article["slug"]
        title = article["title"][locale]
        desc = article["description"][locale]
        dt = article["_publish_dt"]
        date_str = format_date(dt, locale)
        category = CATEGORIES.get(article.get("category", ""), {}).get(locale, "")
        card_theme = theme_class(slug)
        cards.append(
            f"""        <article class="blog-card {card_theme}">
            <span class="blog-category-pill">{html.escape(category)}</span>
            <h2 class="blog-card-title"><a href="{slug}.html">{html.escape(title)}</a></h2>
            <p class="blog-card-excerpt">{html.escape(desc)}</p>
            <div class="blog-card-footer">
                <time datetime="{dt.strftime('%Y-%m-%d')}">{date_str}</time>
                <a href="{slug}.html" class="blog-card-link">{ui['read_more']} →</a>
            </div>
        </article>"""
        )
    grid = "\n".join(cards) if cards else f'        <p class="text-stone-600">{html.escape(description)}</p>'

    return f"""<!DOCTYPE html>
<html lang="{LOCALE_META[locale]['html_lang']}">
<head>
{head_common(locale, ui['blog_heading'], description, canonical, "index", None)}
</head>
<body class="min-h-screen flex flex-col nav-on-blog blog-index-page">
{render_nav(locale, "insights")}
<main class="blog-index-shell">
    <header class="blog-index-hero">
        <h1 class="blog-index-title">{html.escape(ui['blog_heading'])}</h1>
        <p class="blog-index-sub">{html.escape(ui['blog_sub'])}</p>
    </header>
    <div class="blog-grid">
{grid}
    </div>
</main>
{render_footer(locale)}
<script src="{site_paths(locale)['js']}/site.js"></script>
<script src="{site_paths(locale)['js']}/nav.js"></script>
</body>
</html>
"""


def render_rss(articles: list[dict], locale: str) -> str:
    ui = UI[locale]
    channel = Element("rss", version="2.0")
    ch = SubElement(channel, "channel")
    SubElement(ch, "title").text = ui["rss_title"]
    SubElement(ch, "link").text = blog_url(locale)
    SubElement(ch, "description").text = ui["blog_sub"]
    SubElement(ch, "language").text = LOCALE_META[locale]["html_lang"]
    for article in articles[:20]:
        item = SubElement(ch, "item")
        slug = article["slug"]
        title = article["title"][locale]
        desc = article["description"][locale]
        dt = article["_publish_dt"]
        SubElement(item, "title").text = title
        SubElement(item, "link").text = blog_url(locale, slug)
        SubElement(item, "guid", isPermaLink="true").text = blog_url(locale, slug)
        SubElement(item, "pubDate").text = format_datetime(dt, usegmt=True)
        SubElement(item, "description").text = desc
    xml = b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(channel, encoding="utf-8")
    return xml.decode("utf-8")


def output_dir(locale: str) -> Path:
    if locale == "en":
        return SITE_ROOT / "blog"
    return SITE_ROOT / locale / "blog"


def write_manifest(articles: list[dict]) -> None:
    published = published_articles(articles)
    manifest = {
        "index_urls": index_paths(),
        "posts": [
            {
                "slug": a["slug"],
                "title": a["title"],
                "publish_at": a["_publish_dt"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                "lastmod": a["_publish_dt"].strftime("%Y-%m-%d"),
                "urls": article_dir_paths(a["slug"]),
            }
            for a in published
        ],
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def inject_homepage_teasers(articles: list[dict]) -> None:
    published = published_articles(articles)[:3]
    if not published:
        return

    teasers = {
        "en": {
            "heading": "Latest from Insights",
            "more": "View all insights →",
            "more_href": "blog/index.html",
        },
        "fr": {
            "heading": "Derniers articles du blogue",
            "more": "Voir tout le blogue →",
            "more_href": "blog/index.html",
        },
        "es": {
            "heading": "Últimos del blog",
            "more": "Ver todo el blog →",
            "more_href": "blog/index.html",
        },
    }

    for locale in LOCALES:
        if locale == "en":
            index_path = SITE_ROOT / "index.html"
        else:
            index_path = SITE_ROOT / locale / "index.html"
        if not index_path.exists():
            continue
        ui = teasers[locale]
        items = "\n".join(
            f'                <li><a href="blog/{a["slug"]}.html">{html.escape(a["title"][locale])}</a></li>'
            for a in published
        )
        block = f"""<!-- BLOG_TEASER_START -->
        <section class="blog-home-teaser max-w-3xl mx-auto px-6 pb-16" aria-labelledby="blog-teaser-heading">
            <h2 id="blog-teaser-heading">{html.escape(ui['heading'])}</h2>
            <ul class="blog-home-teaser-list">
{items}
            </ul>
            <a href="{ui['more_href']}" class="blog-home-teaser-more">{html.escape(ui['more'])}</a>
        </section>
        <!-- BLOG_TEASER_END -->"""
        text = index_path.read_text(encoding="utf-8")
        if "<!-- BLOG_TEASER_START -->" in text:
            text = re.sub(
                r"<!-- BLOG_TEASER_START -->.*?<!-- BLOG_TEASER_END -->",
                block,
                text,
                flags=re.DOTALL,
            )
        else:
            text = text.replace(
                '<footer class="site-footer',
                block + '\n\n<footer class="site-footer',
                1,
            )
        index_path.write_text(text, encoding="utf-8")


def build(publish_due_flag: bool = False, teasers_only: bool = False) -> bool:
    yaml_changed = False
    if publish_due_flag:
        yaml_changed = publish_due()

    articles = load_all_articles()
    published = published_articles(articles)

    if teasers_only:
        inject_homepage_teasers(articles)
        print("Updated homepage blog teasers.")
        return yaml_changed

    write_blog_themes_css()

    for locale in LOCALES:
        out = output_dir(locale)
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(render_index_page(published, locale), encoding="utf-8")
        (out / "feed.xml").write_text(render_rss(published, locale), encoding="utf-8")
        for article in published:
            (out / f"{article['slug']}.html").write_text(
                render_article_page(article, locale), encoding="utf-8"
            )

    write_manifest(articles)
    inject_homepage_teasers(articles)
    print(f"Built {len(published)} published article(s) × {len(LOCALES)} locales.")
    return yaml_changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Build blog HTML from markdown sources.")
    parser.add_argument(
        "--publish-due",
        action="store_true",
        help="Flip scheduled articles to published when publish_at has passed.",
    )
    parser.add_argument(
        "--teasers-only",
        action="store_true",
        help="Only refresh homepage blog teaser blocks (run after build_locales.py).",
    )
    args = parser.parse_args()
    build(publish_due_flag=args.publish_due, teasers_only=args.teasers_only)


if __name__ == "__main__":
    main()

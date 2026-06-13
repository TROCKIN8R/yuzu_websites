#!/usr/bin/env python3
"""Apply canonical SVG logo markup across static HTML pages."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "yuzu_github_page"


def paths_for(p):
    parts = p.relative_to(ROOT).parts
    if len(parts) == 1:
        return "index.html", "assets/", "css/"
    if len(parts) == 2 and parts[0] in ("fr", "es"):
        return "index.html", "../assets/", "../css/"
    if len(parts) == 2 and parts[0] == "services":
        return "../index.html", "../assets/", "../css/"
    if len(parts) == 3 and parts[1] == "services":
        return "../index.html", "../../assets/", "../../css/"
    return "index.html", "assets/", "css/"


def nav(home, assets):
    return f"""        <div class="shrink-0">
            <a href="{home}" class="yuzu-logo yuzu-logo--horizontal yuzu-logo--nav" aria-label="Yuzu Solutions">
                <object type="image/svg+xml" data="{assets}yuzu-horizontal.svg" class="yuzu-logo__media" aria-hidden="true"></object>
            </a>
        </div>"""


def footer(home, assets):
    return f"""    <div class="mb-4 flex justify-center">
        <a href="{home}" class="yuzu-logo yuzu-logo--horizontal yuzu-logo--footer yuzu-logo--on-dark" aria-label="Yuzu Solutions">
            <object type="image/svg+xml" data="{assets}yuzu-horizontal.svg" class="yuzu-logo__media" aria-hidden="true"></object>
        </a>
    </div>"""


BRAND = """
<section id="brand" class="py-20 px-6 bg-gray-950">
    <div class="max-w-5xl mx-auto text-center mb-12">
        <span class="text-yellow-500 font-bold uppercase tracking-widest text-sm">✦ Logo System</span>
        <h2 class="text-3xl md:text-4xl font-extrabold text-white mt-3">Three lockups, one mark</h2>
        <p class="mt-3 text-stone-400 max-w-2xl mx-auto">Mark, horizontal, and stacked SVG lockups — geometry fixed, palette via CSS tokens.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div class="rounded-2xl bg-[#0F1213] p-8 flex flex-col items-center justify-center gap-4 min-h-[220px]">
            <span class="font-mono text-xs uppercase tracking-widest text-stone-500">01 · Mark</span>
            <div class="yuzu-logo--mark-on-dark">
                <object type="image/svg+xml" data="{assets}yuzu-mark.svg" class="yuzu-logo__media max-h-24 w-auto" aria-label="Yuzu Solutions mark"></object>
            </div>
        </div>
        <div class="rounded-2xl bg-[#0F1213] p-8 flex flex-col items-center justify-center gap-4 min-h-[220px]">
            <span class="font-mono text-xs uppercase tracking-widest text-stone-500">02 · Horizontal</span>
            <object type="image/svg+xml" data="{assets}yuzu-horizontal.svg" class="yuzu-logo__media max-h-16 w-auto" aria-label="Yuzu Solutions horizontal lockup"></object>
        </div>
        <div class="rounded-2xl bg-[#0F1213] p-8 flex flex-col items-center justify-center gap-4 min-h-[220px]">
            <span class="font-mono text-xs uppercase tracking-widest text-stone-500">03 · Stacked</span>
            <span class="yuzu-logo yuzu-logo--stacked yuzu-logo--on-dark">
                <object type="image/svg+xml" data="{assets}yuzu-stacked.svg" class="yuzu-logo__media" aria-label="Yuzu Solutions stacked lockup"></object>
            </span>
        </div>
    </div>
</section>"""

NAV_RE = re.compile(
    r'<div class="shrink-0">\s*<a href="[^"]*" class="yuzu-logo yuzu-logo--horizontal yuzu-logo--nav"[^>]*>.*?</a>\s*</div>',
    re.S,
)
OLD_NAV_RE = re.compile(
    r'<div class="text-xl sm:text-2xl font-extrabold tracking-tighter shrink-0">\s*'
    r'<a href="[^"]*" class="hover:text-yellow-600 transition-colors">Yuzu<span class="text-yellow-500">\.'
    r'</span>solutions</a>\s*</div>',
    re.S,
)
FOOT_RE = re.compile(
    r'<div class="mb-[34] flex justify-center">\s*'
    r'<a href="[^"]*" class="yuzu-logo yuzu-logo--(?:stacked|horizontal) yuzu-logo--footer yuzu-logo--on-dark"[^>]*>.*?</a>\s*</div>',
    re.S,
)
OLD_FOOT_INDEX_RE = re.compile(
    r'<p class="mb-4">\s*<span class="text-2xl mr-2">🍋</span>\s*'
    r'<span class="font-bold text-gray-300 tracking-wider">Yuzu\.solutions</span>\s*</p>',
    re.S,
)
OLD_FOOT_SERVICE_RE = re.compile(
    r'<p>\s*<span class="text-xl mr-1">🍋</span>\s*'
    r'<span class="font-bold text-gray-300">Yuzu\.solutions</span>\s*</p>',
    re.S,
)


def apply_nav(text, home, assets):
    if NAV_RE.search(text):
        return NAV_RE.sub(nav(home, assets), text, 1)
    if OLD_NAV_RE.search(text):
        return OLD_NAV_RE.sub(nav(home, assets), text, 1)
    return text


def apply_footer(text, home, assets):
    if FOOT_RE.search(text):
        return FOOT_RE.sub(footer(home, assets), text, 1)
    if OLD_FOOT_INDEX_RE.search(text):
        return OLD_FOOT_INDEX_RE.sub(footer(home, assets), text, 1)
    if OLD_FOOT_SERVICE_RE.search(text):
        return OLD_FOOT_SERVICE_RE.sub(footer(home, assets), text, 1)
    return text


def apply_logo_css(text, css_prefix):
    link = f'<link rel="stylesheet" href="{css_prefix}logo.css">'
    if link in text:
        return text
    site_css = f'<link rel="stylesheet" href="{css_prefix}site.css">'
    if site_css in text:
        return text.replace(site_css, f"{site_css}\n    {link}", 1)
    return text


def apply_favicon(text, assets):
    return re.sub(
        r'<link rel="icon" href="[^"]*(?:lemon-emoji\.png|yuzu-mark\.(?:png|svg))" type="image/(?:png|svg\+xml)">',
        f'<link rel="icon" href="{assets}yuzu-mark.svg" type="image/svg+xml">',
        text,
        count=1,
    )


def apply_brand(text, assets):
    brand = BRAND.format(assets=assets)
    if 'id="brand"' in text:
        return re.sub(
            r'<section id="brand" class="py-20 px-6 bg-gray-950">.*?</section>',
            brand.strip(),
            text,
            count=1,
            flags=re.S,
        )
    return text.replace(
        '</header>\n\n<section id="vision"',
        f'</header>\n{brand}\n<section id="vision"',
        1,
    )


def transform(path, text):
    home, assets, css_prefix = paths_for(path)
    out = text
    out = apply_nav(out, home, assets)
    out = apply_footer(out, home, assets)
    out = apply_logo_css(out, css_prefix)
    out = apply_favicon(out, assets)
    out = out.replace('yuzu-mark.png', 'yuzu-mark.svg')
    out = out.replace('yuzu-horizontal.png', 'yuzu-horizontal.svg')
    out = out.replace('lemon-emoji.png', 'yuzu-mark.svg')
    out = out.replace(
        '"logo": "https://yuzu.solutions/assets/yuzu-mark.png"',
        '"logo": "https://yuzu.solutions/assets/yuzu-mark.svg"',
    )
    parts = path.relative_to(ROOT).parts
    if path.name == 'index.html' and (
        parts == ('index.html',) or (len(parts) == 2 and parts[0] in ('fr', 'es'))
    ):
        out = apply_brand(out, assets)
    return out


def main(paths=None):
    html_paths = paths or sorted(ROOT.rglob('*.html'))
    for path in html_paths:
        text = path.read_text(encoding='utf-8')
        out = transform(path, text)
        if out != text:
            path.write_text(out, encoding='utf-8')
            print('updated', path.relative_to(ROOT))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Reorder services: Accelerator, Core, Detox, Single Pour, First Press, Zest."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SLUG_ORDER = [
    'bi-ai-enablement.html',
    'infrastructure-data.html',
    'technical-debt.html',
    'bi-dashboard-delivery.html',
    'mvp-builds.html',
    'ai-automation.html',
]
KEY_ORDER = ['enablement', 'infra', 'debt', 'delivery', 'mvp', 'ai']

SERVICE_SLUGS = '|'.join(s.replace('.html', '') for s in SLUG_ORDER)
ITEM_RE = re.compile(
    rf'(<a href="[^"]*(?:{SERVICE_SLUGS})\.html" class="mega-item"[^>]*>.*?</a>)',
    re.DOTALL,
)


def slug_from_item(item: str) -> str:
    m = re.search(r'href="([^"]+)"', item)
    return m.group(1).split('/')[-1] if m else ''


def reorder_item_block(block: str) -> str:
    items = ITEM_RE.findall(block)
    if len(items) != 6:
        return block
    by_slug = {slug_from_item(i): i for i in items}
    return '\n'.join(by_slug[s] for s in SLUG_ORDER)


def patch_mega_menus(text: str) -> str:
    def grid_repl(m):
        return m.group(1) + reorder_item_block(m.group(2)) + m.group(3)

    text = re.sub(
        r'(<div class="mega-menu-grid">\n)([\s\S]*?)(\n\s*</div>\n\s*</div>\n\s*</div>)',
        grid_repl,
        text,
        count=1,
    )

    def mobile_repl(m):
        inner = m.group(2)
        if 'bi-ai-enablement' not in inner:
            return m.group(0)
        return m.group(1) + reorder_item_block(inner) + m.group(3)

    return re.sub(
        r'(<div class="mobile-nav-sub[^"]*" id="mobileServicesSub"[^>]*>\n)([\s\S]*?)(\n\s*</div>\n\s*<a href="(?:\.\./index\.html#founder|#founder))',
        mobile_repl,
        text,
        count=1,
    )


def set_picker_active(block: str, active: bool) -> str:
    block = re.sub(r' class="service-card active"', ' class="service-card"', block)
    block = re.sub(r' aria-selected="true"', ' aria-selected="false"', block)
    if active:
        block = re.sub(
            r'(<button type="button" class="service-card)(" data-service="enablement" role="tab" )aria-selected="false"',
            r'\1 active\2aria-selected="true"',
            block,
            count=1,
        )
    return block


def patch_service_menu(text: str) -> str:
    m = re.search(
        r'(<div class="services-menu" role="tablist"[^>]*>\n)([\s\S]*?)(\n\s*</div>\n\n\s*<div class="service-detail-panel"|\n\s*</div>\n\n\s*<div class="service-detail-panel")',
        text,
    )
    if not m:
        return text

    block_re = re.compile(
        r'<div class="service-picker" data-service="(enablement|infra|debt|delivery|mvp|ai)">[\s\S]*?</div>\n\s*</div>',
    )
    blocks = {bm.group(1): bm.group(0) for bm in block_re.finditer(m.group(2))}
    if set(blocks.keys()) != set(KEY_ORDER):
        print('picker keys mismatch', blocks.keys())
        return text

    ordered = [set_picker_active(blocks[k], k == 'enablement') for k in KEY_ORDER]
    return text[: m.start()] + m.group(1) + '\n'.join(ordered) + m.group(3) + text[m.end() :]


FOOTER_ITEMS = {
    'en': [
        ('services/bi-ai-enablement.html', 'BI &amp; AI Enablement'),
        ('services/infrastructure-data.html', 'Infrastructure &amp; Data'),
        ('services/technical-debt.html', 'Technical Debt &amp; Rescue'),
        ('services/bi-dashboard-delivery.html', 'BI &amp; Dashboard Delivery'),
        ('services/mvp-builds.html', 'MVP Builds'),
        ('services/ai-automation.html', 'AI &amp; Automation'),
    ],
    'fr': [
        ('services/bi-ai-enablement.html', 'Activation BI et IA'),
        ('services/infrastructure-data.html', 'Infrastructure et données'),
        ('services/technical-debt.html', 'Dette technique et sauvetage'),
        ('services/bi-dashboard-delivery.html', 'Livraison BI et tableaux de bord'),
        ('services/mvp-builds.html', 'Constructions MVP'),
        ('services/ai-automation.html', 'IA et automatisation'),
    ],
    'es': [
        ('services/bi-ai-enablement.html', 'Activación BI e IA'),
        ('services/infrastructure-data.html', 'Infraestructura y datos'),
        ('services/technical-debt.html', 'Deuda técnica y rescate'),
        ('services/bi-dashboard-delivery.html', 'Entrega BI y dashboards'),
        ('services/mvp-builds.html', 'Desarrollos MVP'),
        ('services/ai-automation.html', 'IA y automatización'),
    ],
}


def patch_footer_recipes(text: str, lang: str) -> str:
    block = '\n'.join(
        f'                    <li><a href="{href}">{label}</a></li>' for href, label in FOOTER_ITEMS[lang]
    )
    return re.sub(
        r'<nav class="site-footer__nav" aria-label="Services">\s*<h2 class="site-footer__nav-title">Recipes</h2>\s*<ul>[\s\S]*?</ul>\s*</nav>',
        f'<nav class="site-footer__nav" aria-label="Services">\n                <h2 class="site-footer__nav-title">Recipes</h2>\n                <ul>\n{block}\n                </ul>\n            </nav>',
        text,
        count=1,
    )


def index_lang(path: Path) -> str:
    if 'fr' in path.parts:
        return 'fr'
    if 'es' in path.parts:
        return 'es'
    return 'en'


def main():
    for path in ROOT.rglob('*.html'):
        text = path.read_text(encoding='utf-8')
        original = text
        if 'mega-menu-grid' in text and 'bi-ai-enablement' in text:
            text = patch_mega_menus(text)
        if 'services-menu' in text and 'service-detail-panel' in text:
            text = patch_service_menu(text)
            if path.name == 'index.html':
                text = patch_footer_recipes(text, index_lang(path))
        if text != original:
            path.write_text(text, encoding='utf-8')
            print('patched', path.relative_to(ROOT))


if __name__ == '__main__':
    main()

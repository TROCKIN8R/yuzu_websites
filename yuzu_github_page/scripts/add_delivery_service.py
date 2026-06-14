#!/usr/bin/env python3
"""Add BI & Dashboard Delivery service between Detox and First Press."""
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

NAV_EN_DESKTOP = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item" role="menuitem{current}">
                                <div class="mega-icon">📊</div>
                                <div>
                                    <h4>BI &amp; Dashboard Delivery</h4>
                                    <p>Semantic models, exec dashboards &amp; self-serve BI · The Single Pour</p>
                                </div>
                            </a>'''

NAV_EN_MOBILE = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item{current}">
                    <div class="mega-icon">📊</div>
                    <div>
                        <h4>BI &amp; Dashboard Delivery</h4>
                        <p>Semantic models, exec dashboards &amp; self-serve BI · The Single Pour</p>
                    </div>
                </a>'''

NAV_FR_DESKTOP = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item" role="menuitem{current}">
                                <div class="mega-icon">📊</div>
                                <div>
                                    <h4>Livraison BI et tableaux de bord</h4>
                                    <p>Modèles sémantiques, tableaux exécutifs et BI libre-service · La verse unique</p>
                                </div>
                            </a>'''

NAV_FR_MOBILE = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item{current}">
                    <div class="mega-icon">📊</div>
                    <div>
                        <h4>Livraison BI et tableaux de bord</h4>
                        <p>Modèles sémantiques, tableaux exécutifs et BI libre-service · La verse unique</p>
                    </div>
                </a>'''

NAV_ES_DESKTOP = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item" role="menuitem{current}">
                                <div class="mega-icon">📊</div>
                                <div>
                                    <h4>Entrega BI y dashboards</h4>
                                    <p>Modelos semánticos, dashboards ejecutivos y autoservicio · El vertido único</p>
                                </div>
                            </a>'''

NAV_ES_MOBILE = '''<a href="{prefix}bi-dashboard-delivery.html" class="mega-item{current}">
                    <div class="mega-icon">📊</div>
                    <div>
                        <h4>Entrega BI y dashboards</h4>
                        <p>Modelos semánticos, dashboards ejecutivos y autoservicio · El vertido único</p>
                    </div>
                </a>'''

PICKER_EN = '''<div class="service-picker" data-service="delivery">
            <button type="button" class="service-card" data-service="delivery" role="tab" aria-selected="false">
                <span class="service-card-icon" aria-hidden="true">📊</span>
                <span class="service-card-body">
                    <span class="service-card-title">BI &amp; Dashboard Delivery</span>
                    <span class="service-card-tag">The Single Pour</span>
                </span>
            </button>
                <div class="service-detail-anchor" data-service="delivery" hidden aria-hidden="true"></div>
            </div>'''

PICKER_FR = '''<div class="service-picker" data-service="delivery">
            <button type="button" class="service-card" data-service="delivery" role="tab" aria-selected="false">
                <span class="service-card-icon" aria-hidden="true">📊</span>
                <span class="service-card-body">
                    <span class="service-card-title">Livraison BI et tableaux de bord</span>
                    <span class="service-card-tag">La verse unique</span>
                </span>
            </button>
                <div class="service-detail-anchor" data-service="delivery" hidden aria-hidden="true"></div>
            </div>'''

PICKER_ES = '''<div class="service-picker" data-service="delivery">
            <button type="button" class="service-card" data-service="delivery" role="tab" aria-selected="false">
                <span class="service-card-icon" aria-hidden="true">📊</span>
                <span class="service-card-body">
                    <span class="service-card-title">Entrega BI y dashboards</span>
                    <span class="service-card-tag">El vertido único</span>
                </span>
            </button>
                <div class="service-detail-anchor" data-service="delivery" hidden aria-hidden="true"></div>
            </div>'''


def slug_from_item(item: str) -> str:
    m = re.search(r'href="([^"]+)"', item)
    return m.group(1).split('/')[-1] if m else ''


def reorder_item_block(block: str) -> str:
    items = ITEM_RE.findall(block)
    if len(items) != 6:
        return block
    by_slug = {slug_from_item(i): i for i in items}
    return '\n'.join(by_slug[s] for s in SLUG_ORDER)


def inject_nav_if_missing(text: str, lang: str, prefix: str) -> str:
    if 'bi-dashboard-delivery.html' in text:
        return reorder_mega_menus(text)

    if lang == 'fr':
        desk, mob = NAV_FR_DESKTOP, NAV_FR_MOBILE
    elif lang == 'es':
        desk, mob = NAV_ES_DESKTOP, NAV_ES_MOBILE
    else:
        desk, mob = NAV_EN_DESKTOP, NAV_EN_MOBILE

    debt_end = re.search(
        rf'(<a href="{re.escape(prefix)}technical-debt\.html" class="mega-item"[^>]*>.*?</a>)',
        text,
        re.DOTALL,
    )
    if not debt_end:
        return text

    insert = '\n' + desk.format(prefix=prefix, current='') + '\n'
    text = text[: debt_end.end()] + insert + text[debt_end.end() :]

    debt_end_m = re.search(
        rf'(<a href="{re.escape(prefix)}technical-debt\.html" class="mega-item"[^>]*>.*?</a>)',
        text,
        re.DOTALL,
    )
    if debt_end_m:
        insert_m = '\n' + mob.format(prefix=prefix, current='') + '\n'
        # second occurrence is mobile if desktop was first - find mobile section
        pass

    # mobile: insert after second technical-debt occurrence or in mobileServicesSub
    mob_sec = re.search(
        r'(<div class="mobile-nav-sub[^"]*" id="mobileServicesSub"[^>]*>\n)([\s\S]*?)(\n\s*</div>\n\s*<a href="(?:\.\./index\.html#founder|#founder))',
        text,
    )
    if mob_sec and 'bi-dashboard-delivery' not in mob_sec.group(2):
        inner = mob_sec.group(2)
        m = re.search(
            rf'(<a href="{re.escape(prefix)}technical-debt\.html" class="mega-item"[^>]*>.*?</a>)',
            inner,
            re.DOTALL,
        )
        if m:
            new_inner = inner[: m.end()] + '\n' + mob.format(prefix=prefix, current='') + inner[m.end() :]
            text = text[: mob_sec.start(2)] + new_inner + text[mob_sec.end(2) :]

    return reorder_mega_menus(text)


def reorder_mega_menus(text: str) -> str:
    def grid_repl(m):
        inner = reorder_item_block(m.group(2))
        return m.group(1) + inner + m.group(3)

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


def patch_index_picker(text: str, picker: str) -> str:
    if 'data-service="delivery"' in text:
        return patch_index_service_menu(text)
    anchor = '<div class="service-detail-anchor" data-service="debt" hidden aria-hidden="true"></div>\n            </div>'
    if anchor not in text:
        return text
    return text.replace(anchor, anchor + '\n' + picker, 1)


def patch_index_service_menu(text: str) -> str:
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
        print('picker mismatch', blocks.keys())
        return text

    def set_active(block: str, active: bool) -> str:
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

    ordered = [set_active(blocks[k], k == 'enablement') for k in KEY_ORDER]
    return text[: m.start()] + m.group(1) + '\n'.join(ordered) + m.group(3) + text[m.end() :]


def file_lang(path: Path) -> str:
    if 'fr' in path.parts:
        return 'fr'
    if 'es' in path.parts:
        return 'es'
    return 'en'


def nav_prefix(path: Path) -> str:
    if path.name == 'index.html':
        return 'services/'
    return ''


def main():
    for path in ROOT.rglob('*.html'):
        if path.name == 'bi-dashboard-delivery.html':
            continue
        text = path.read_text(encoding='utf-8')
        if 'mega-menu-grid' not in text or 'technical-debt' not in text:
            continue
        lang = file_lang(path)
        prefix = nav_prefix(path)
        new_text = inject_nav_if_missing(text, lang, prefix)
        if path.name == 'index.html' and 'services-menu' in text:
            picker = {'en': PICKER_EN, 'fr': PICKER_FR, 'es': PICKER_ES}[lang]
            new_text = patch_index_picker(new_text, picker)
        if new_text != text:
            path.write_text(new_text, encoding='utf-8')
            print('patched', path.relative_to(ROOT))


if __name__ == '__main__':
    main()

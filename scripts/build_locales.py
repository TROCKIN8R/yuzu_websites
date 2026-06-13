#!/usr/bin/env python3
"""Build fr/ and es/ locale copies of the Yuzu.solutions static site."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "yuzu_github_page"
BASE = "https://yuzu.solutions"
TODAY = date.today().isoformat()

SERVICE_SLUGS = [
    "ai-automation",
    "infrastructure-data",
    "technical-debt",
    "mvp-builds",
]

LOCALES = {
    "fr": {"html_lang": "fr-CA", "hreflang": "fr-CA", "og_locale": "fr_CA", "prefix": "/fr"},
    "es": {"html_lang": "es", "hreflang": "es", "og_locale": "es_ES", "prefix": "/es"},
}

LANG_SWITCH_CSS = """
/* Language switcher */
.lang-switch {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #F5F5F4;
    border-radius: 9999px;
    padding: 3px;
}
.lang-switch-btn {
    padding: 6px 12px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #57534E;
    text-decoration: none;
    transition: all 0.2s ease;
}
.lang-switch-btn:hover { color: #1C1917; }
.lang-switch-btn.active {
    background: #1C1917;
    color: #FFFFFF;
}
"""

# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def page_url(locale: str | None, page: str) -> str:
    """page: 'home' or service slug; locale: None/'en', 'fr', or 'es'."""
    if page == "home":
        if locale == "fr":
            return f"{BASE}/fr/"
        if locale == "es":
            return f"{BASE}/es/"
        return f"{BASE}/"
    path = f"services/{page}.html"
    if locale == "fr":
        return f"{BASE}/fr/{path}"
    if locale == "es":
        return f"{BASE}/es/{path}"
    return f"{BASE}/{path}"


def page_urls(page: str) -> dict[str, str]:
    if page == "home":
        return {"en": "/", "fr": "/fr/", "es": "/es/"}
    return {
        "en": f"/services/{page}.html",
        "fr": f"/fr/services/{page}.html",
        "es": f"/es/services/{page}.html",
    }


def hreflang_block(page: str) -> str:
    urls = page_urls(page)
    lines = [
        f'    <link rel="alternate" hreflang="en" href="{BASE}{urls["en"]}">',
        f'    <link rel="alternate" hreflang="fr-CA" href="{BASE}{urls["fr"]}">',
        f'    <link rel="alternate" hreflang="es" href="{BASE}{urls["es"]}">',
        f'    <link rel="alternate" hreflang="x-default" href="{BASE}{urls["en"]}">',
    ]
    return "\n".join(lines)


def og_locale_block(locale: str | None) -> str:
    if locale == "fr":
        return '    <meta property="og:locale" content="fr_CA">'
    if locale == "es":
        return '    <meta property="og:locale" content="es_ES">'
    return '    <meta property="og:locale" content="en_US">'


def lang_switcher(page: str, active_locale: str, extra_class: str = "") -> str:
    urls = page_urls(page)
    cls = "lang-switch" + (f" {extra_class}" if extra_class else "")
    parts = [f'            <div class="{cls}" role="navigation" aria-label="Language">']
    for code, key in [("EN", "en"), ("FR", "fr"), ("ES", "es")]:
        active = " active" if active_locale == key else ""
        hreflang = "fr-CA" if key == "fr" else key
        parts.append(
            f'                <a href="{urls[key]}" class="lang-switch-btn{active}" '
            f'hreflang="{hreflang}" lang="{hreflang}">{code}</a>'
        )
    parts.append("            </div>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Head / switcher injection
# ---------------------------------------------------------------------------

def strip_i18n_head(html: str) -> str:
    html = re.sub(r"\s*<link[^>]*hreflang[^>]*>\s*", "\n", html)
    html = re.sub(r'\s*<meta[^>]*property="og:locale"[^>]*>\s*', "\n", html)
    return html


def inject_head(html: str, page: str, locale: str | None) -> str:
    html = strip_i18n_head(html)
    lang = LOCALES[locale]["html_lang"] if locale in LOCALES else "en"
    html = re.sub(r'<html lang="[^"]*">', f'<html lang="{lang}">', html, count=1)
    canonical = page_url(locale, page)
    html = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{canonical}">',
        html,
        count=1,
    )
    if 'property="og:url"' in html:
        html = re.sub(
            r'<meta property="og:url" content="[^"]*">',
            f'<meta property="og:url" content="{canonical}">',
            html,
            count=1,
        )
    block = hreflang_block(page) + "\n" + og_locale_block(locale)
    html = html.replace(
        f'<link rel="canonical" href="{canonical}">',
        f'<link rel="canonical" href="{canonical}">\n{block}',
        1,
    )
    return html


def inject_lang_switcher(html: str, page: str, active_locale: str) -> str:
    # Remove any existing desktop switcher (plain or "hidden sm:flex"); the
    # mobile "sm:hidden" switcher is left in place and refreshed separately.
    html = re.sub(
        r'\s*<div class="lang-switch(?: hidden sm:flex)?"[^>]*>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL,
    )
    desktop = lang_switcher(page, active_locale, "hidden sm:flex")
    html = re.sub(
        r'(<a href="[^"]*" class="[^"]*bg-yellow-500[^"]*">)',
        desktop + "\n            \\1",
        html,
        count=1,
    )
    # Refresh the mobile slide-out switcher with localized URLs + active state.
    mobile = lang_switcher(page, active_locale, "sm:hidden").strip()
    html = re.sub(
        r'<div class="lang-switch sm:hidden"[^>]*>.*?</div>',
        lambda _m: mobile,
        html,
        count=1,
        flags=re.DOTALL,
    )
    return html


def inject_lang_css_inline(html: str) -> str:
    if ".lang-switch" in html:
        return html
    return html.replace("</style>", LANG_SWITCH_CSS + "\n    </style>", 1)


def apply_replacements(html: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in sorted(pairs, key=lambda x: len(x[0]), reverse=True):
        html = html.replace(old, new)
    return html


def fix_paths_for_locale(html: str, depth: int) -> str:
    if depth == 1:
        html = html.replace('href="assets/', 'href="../assets/')
        html = html.replace('src="assets/', 'src="../assets/')
        html = html.replace('href="css/', 'href="../css/')
        html = html.replace('href="js/', 'href="../js/')
        html = html.replace('src="js/', 'src="../js/')
        html = html.replace(
            'href="#" class="hover:text-yellow-600',
            'href="index.html" class="hover:text-yellow-600',
        )
        html = html.replace('href="/sitemap.xml"', 'href="../sitemap.xml"')
    elif depth == 2:
        html = html.replace('href="../assets/', 'href="../../assets/')
        html = html.replace('src="../assets/', 'src="../../assets/')
        html = html.replace('href="../css/', 'href="../../css/')
        html = html.replace('href="../js/', 'href="../../js/')
        html = html.replace('src="../js/', 'src="../../js/')
    return html


# ---------------------------------------------------------------------------
# Index translation pairs
# ---------------------------------------------------------------------------

INDEX_FR: list[tuple[str, str]] = [
    # <head> meta
    ("<title>Yuzu.solutions | If life gives you Yuzu, make a dashboard</title>",
     "<title>Yuzu.solutions | Si la vie te donne du yuzu, presse-le en tableau de bord</title>"),
    ('content="We turn raw, complex data into refreshing, automated insights. BI, Fabric, automation, and execution-first consulting."',
     'content="On transforme des données brutes et complexes en insights rafraîchissants et automatisés. BI, Fabric, automatisation et conseil axé sur l\'exécution."'),
    ('content="Yuzu.solutions | If life gives you Yuzu, make a dashboard"',
     'content="Yuzu.solutions | Si la vie te donne du yuzu, presse-le en tableau de bord"'),
    ('content="We turn raw, complex data into refreshing, automated insights."',
     'content="On transforme des données brutes et complexes en insights rafraîchissants et automatisés."'),
    ('"description": "Execution-first data consulting. Microsoft Fabric, Power BI, AI automation, and BI leadership."',
     '"description": "Conseil en données axé sur l\'exécution. Microsoft Fabric, Power BI, automatisation IA et leadership BI."'),
    ('"inLanguage": "en"', '"inLanguage": "fr-CA"'),
    ('"description": "Boutique data and BI consultancy specializing in Microsoft Fabric, Power BI, AI automation, and hands-on engineering execution."',
     '"description": "Cabinet boutique en données et BI, spécialisé en Microsoft Fabric, Power BI, automatisation IA et exécution technique sur le terrain."'),
    ('"slogan": "If life gives you Yuzu, make a dashboard."',
     '"slogan": "Si la vie te donne du yuzu, presse-le en tableau de bord."'),
    ('"name": "Data & BI Services"', '"name": "Services données et BI"'),
    ('"name": "What makes Yuzu.solutions different from traditional consultants?"',
     '"name": "Qu\'est-ce qui distingue Yuzu.solutions des consultants traditionnels?"'),
    ('"text": "Yuzu.solutions spends roughly 80% of engagement time on hands-on engineering — building pipelines, writing code, and deploying agents — rather than meetings and slide decks. Strategy emerges from execution."',
     '"text": "Yuzu.solutions consacre environ 80 % du temps de mandat à l\'ingénierie sur le terrain — pipelines, code et agents — plutôt qu\'aux réunions et aux présentations. La stratégie émerge de l\'exécution."'),
    ('"name": "What services does Yuzu.solutions offer?"',
     '"name": "Quels services offre Yuzu.solutions?"'),
    ('"text": "Four core services: AI & Automation, Infrastructure & Data, Technical Debt & Rescue, and MVP Builds."',
     '"text": "Quatre piliers : IA et automatisation, infrastructure et données, dette technique et sauvetage, et constructions MVP."'),
    ('"name": "What technologies does Yuzu.solutions specialize in?"',
     '"name": "Dans quelles technologies Yuzu.solutions se spécialise-t-il?"'),
    ('"text": "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC, and AI agent development."',
     '"text": "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC et développement d\'agents IA."'),
    ('"name": "Who does Yuzu.solutions work with?"',
     '"name": "Avec qui Yuzu.solutions travaille-t-il?"'),
    ('"text": "Growing SMBs graduating from Excel, enterprises consolidating siloed data systems, and post-merger teams needing a unified reporting stack."',
     '"text": "PME en croissance qui sortent d\'Excel, entreprises qui unifient des systèmes de données en silos, et équipes post-fusion qui ont besoin d\'une pile de reporting unifiée."'),
    # Nav
    ('<a href="#impact" class="nav-pill-item">Vision</a>', '<a href="#impact" class="nav-pill-item">Vision</a>'),
    ("Services <span class=\"nav-chevron\">▾</span>", "Services <span class=\"nav-chevron\">▾</span>"),
    ('<a href="#founder" class="nav-pill-item">Founder</a>', '<a href="#founder" class="nav-pill-item">Fondateur</a>'),
    ('<a href="#services" class="md:hidden text-sm font-semibold hover:text-yellow-600">Services</a>',
     '<a href="#services" class="md:hidden text-sm font-semibold hover:text-yellow-600">Services</a>'),
    ('<a href="#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Founder</a>',
     '<a href="#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Fondateur</a>'),
    ('>Get Started</a>', '>Commencer</a>'),
    # Mega menu
    ("<p>Agents, workflows &amp; LLM integrations · The Zest</p>",
     "<p>Agents, flux de travail et intégrations LLM · Le zeste</p>"),
    ("<p>Fabric lakehouses, ETL &amp; semantic models · The Core</p>",
     "<p>Lakehouses Fabric, ETL et modèles sémantiques · Le cœur</p>"),
    ("<p>Legacy fixes, performance &amp; model cleanup · The Detox</p>",
     "<p>Correctifs legacy, performance et nettoyage de modèles · Le détox</p>"),
    ("<p>Internal tools, portals &amp; rapid prototypes · The First Press</p>",
     "<p>Outils internes, portails et prototypes rapides · La première pressée</p>"),
    # Hero
    (">Welcome to the future of BI</span>", ">Bienvenue dans le futur de la BI</span>"),
    ("If life gives you <span class=\"text-yellow-500\">Yuzu</span>, make a dashboard.",
     "Si la vie te donne du <span class=\"text-yellow-500\">yuzu</span>, presse-le en tableau de bord."),
    (">We turn raw, complex data into refreshing, automated insights.</p>",
     ">On transforme des données brutes et complexes en insights rafraîchissants et automatisés.</p>"),
    (">Contact Us</a>", ">Nous contacter</a>"),
    ('aria-label="Yuzu data juicer turning lemons into dashboards and data"',
     'aria-label="Presse-yuzu de données transformant les citrons en tableaux de bord"'),
    # Impact
    (">The Execution Dashboard</h2>", ">Le tableau de bord d'exécution</h2>"),
    ("This section visualizes our core philosophy. While traditional firms spend your budget on endless roadmap meetings, Yuzu.solutions flips the model. Interact with the chart below to see how we reallocate project time towards building, automating, and delivering actual software.",
     "Cette section illustre notre philosophie. Alors que les firmes traditionnelles dépensent votre budget en réunions de feuille de route sans fin, Yuzu.solutions inverse le modèle. Interagissez avec le graphique pour voir comment on réalloue le temps vers la construction, l'automatisation et la livraison de vrais logiciels."),
    (">Traditional Consulting</button>", ">Conseil traditionnel</button>"),
    (">Yuzu Execution</button>", ">Exécution Yuzu</button>"),
    ("<strong>The Yuzu Squeeze:</strong> 80% of our engagement time is spent engineering solutions, writing code, and deploying agents. Strategy is the byproduct of building.",
     "<strong>La pressée Yuzu :</strong> 80 % de notre temps de mandat est consacré à l'ingénierie, au code et au déploiement d'agents. La stratégie est le sous-produit de la construction."),
    ("<strong>Traditional Approach:</strong> You pay for overhead. Most of the engagement is spent planning to build, rather than actually building.",
     "<strong>Approche traditionnelle :</strong> Vous payez pour la surcharge. La majeure partie du mandat sert à planifier de construire, plutôt qu'à construire réellement."),
    # Clients
    (">🍋 Right Fruit, Right Press</span>", ">🍋 Le bon fruit, le bon pressoir</span>"),
    (">Who We Work With</h2>", ">Avec qui on travaille</h2>"),
    ("Whether you're squeezing your first warehouse or wringing sense out of a decade of spreadsheets — we've got the juicer for that.",
     "Que vous pressiez votre premier entrepôt ou que vous tentiez de tirer du sens d'une décennie de feuilles de calcul — on a le presseur qu'il vous faut."),
    (">Growing Companies</h3>", ">Entreprises en croissance</h3>"),
    ("SMBs outgrowing Excel, ready for their first warehouse and governed reporting. Time to trade the squeeze-by-hand for a real press.",
     "PME qui dépassent Excel, prêtes pour leur premier entrepôt et un reporting gouverné. Il est temps d'échanger la pression à la main pour un vrai pressoir."),
    (">Enterprise Consolidation</h3>", ">Consolidation d'entreprise</h3>"),
    ("Larger orgs unifying siloed systems, conflicting KPIs, and years of accumulated data. One orchard, one juice standard.",
     "Grandes organisations qui unifient des systèmes en silos, des KPI conflictuels et des années de données accumulées. Un verger, un standard de jus."),
    (">Post-Merger Integration</h3>", ">Intégration post-fusion</h3>"),
    ("Merging teams that need one stack, one source of truth, and one reporting culture. Two groves, one blend — no pulp left behind.",
     "Équipes en fusion qui ont besoin d'une pile, d'une source de vérité et d'une culture de reporting commune. Deux vergers, un mélange — sans pulpe oubliée."),
    # Services section
    (">What We Do <span class=\"text-gray-400 font-normal text-3xl\">(The Pulp & The Juice)</span></h2>",
     ">Ce qu'on fait <span class=\"text-gray-400 font-normal text-3xl\">(La pulpe et le jus)</span></h2>"),
    ("Explore our core engineering capabilities below. Select a technical pillar on the left to unpack how we replace manual labor with scalable systems. This interactive module details the exact technical outputs you receive when working with us.",
     "Explorez nos capacités d'ingénierie ci-dessous. Sélectionnez un pilier technique à gauche pour voir comment on remplace le travail manuel par des systèmes évolutifs. Ce module interactif détaille les livrables techniques exacts que vous recevez en travaillant avec nous."),
    ("AI &amp; Automation <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Zest</span>",
     "IA et automatisation <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">Le zeste</span>"),
    ("Infrastructure &amp; Data <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Core</span>",
     "Infrastructure et données <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">Le cœur</span>"),
    ("Technical Debt &amp; Rescue <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Detox</span>",
     "Dette technique et sauvetage <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">Le détox</span>"),
    ("MVP Builds <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The First Press</span>",
     "Constructions MVP <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">La première pressée</span>"),
    (">See dashboards &amp; workflows →</a>", ">Voir tableaux de bord et flux →</a>"),
    (">Key Deliverables</h5>", ">Livrables clés</h5>"),
    # Process
    (">How We Work <span class=\"text-gray-400 font-normal text-3xl\">(The Squeeze)</span></h2>",
     ">Comment on travaille <span class=\"text-gray-400 font-normal text-3xl\">(La pressée)</span></h2>"),
    ("No account managers. No bloated timelines. Just direct technical partnership focused on clean execution.",
     "Pas de gestionnaires de compte. Pas de délais gonflés. Juste un partenariat technique direct axé sur une exécution propre."),
    (">Direct</h3>", ">Direct</h3>"),
    ("You deal with me, not a middleman with a fancy suit. Direct communication with the engineer building your systems ensures requirements are never lost in translation.",
     "Vous traitez avec moi, pas avec un intermédiaire en costume. Une communication directe avec l'ingénieur qui construit vos systèmes garantit que les exigences ne se perdent jamais en traduction."),
    (">Clean</h3>", ">Propre</h3>"),
    ("I provide documented, maintainable code with standard CI/CD. I build systems that run themselves, so you don't have to babysit them after deployment.",
     "Je livre du code documenté et maintenable avec un CI/CD standard. Je construis des systèmes qui tournent tout seuls, pour que vous n'ayez pas à les surveiller après le déploiement."),
    (">Integrated</h3>", ">Intégré</h3>"),
    ("When I propose a solution, the roadmap comes for free. You aren't paying for a plan; you're paying for the juice. Strategy is the natural byproduct of technical mastery.",
     "Quand je propose une solution, la feuille de route est incluse. Vous ne payez pas pour un plan ; vous payez pour le jus. La stratégie est le sous-produit naturel de la maîtrise technique."),
    # Founder
    (">🍋 The Head Squeezer</span>", ">🍋 Le presse-chef</span>"),
    (">About the Founder</h2>", ">À propos du fondateur</h2>"),
    ("One senior specialist, zero middlemen, and a serious grudge against zest-less dashboards.",
     "Un spécialiste senior, zéro intermédiaire, et une rancune sérieuse contre les tableaux de bord sans zeste."),
    ('alt="Adrien Yvin — Data Platform Architect and founder of Yuzu.solutions"',
     'alt="Adrien Yvin — architecte de plateforme de données et fondateur de Yuzu.solutions"'),
    (">Data Platform Architect &amp; BI Leader</p>", ">Architecte de plateforme de données et leader BI</p>"),
    ("Seven years immersed in data — from ETL pipelines at an energy utility to machine-learning pricing models inside a",
     "Sept ans plongé dans les données — des pipelines ETL chez un distributeur d'énergie aux modèles de tarification par apprentissage automatique dans une"),
    ("$4B packaging company</strong>. Currently leading a BI squad at",
     "entreprise d'emballage de 4 G$</strong>. Actuellement chef d'une escouade BI chez"),
    ("architecting Microsoft Fabric solutions that turn raw transactional data into boardroom-ready decisions.",
     "architecturant des solutions Microsoft Fabric qui transforment les données transactionnelles brutes en décisions prêtes pour la salle de conseil."),
    ("brings that same precision directly to you — one senior specialist who gets hands dirty in the pipes, owns every medallion layer, and delivers reports you can stake decisions on.",
     "apporte cette même précision directement à vous — un spécialiste senior qui met les mains dans les tuyaux, possède chaque couche médaillon et livre des rapports sur lesquels vous pouvez baser vos décisions."),
    (">Years in Data</div>", ">Années en données</div>"),
    (">Companies</div>", ">Entreprises</div>"),
    (">Languages</div>", ">Langues</div>"),
    ("> Experience</h4>", "> Expérience</h4>"),
    (">Expert BI Analyst &amp; Squad Leader</p>", ">Analyste BI expert et chef d'escouade</p>"),
    (">Business Intelligence Analyst</p>", ">Analyste en intelligence d'affaires</p>"),
    (">BI Consultant</p>", ">Consultant BI</p>"),
    (">BI Intern</p>", ">Stagiaire BI</p>"),
    ("> Core Stack</h4>", "> Stack principal</h4>"),
    # FAQ
    (">Common Questions</h2>", ">Questions fréquentes</h2>"),
    ("What makes Yuzu.solutions different from traditional consultants?",
     "Qu'est-ce qui distingue Yuzu.solutions des consultants traditionnels?"),
    ("We spend roughly 80% of engagement time on hands-on engineering — building pipelines, writing code, and deploying agents — rather than meetings and slide decks. Strategy emerges from execution, not the other way around.",
     "On consacre environ 80 % du temps de mandat à l'ingénierie sur le terrain — pipelines, code et agents — plutôt qu'aux réunions et aux présentations. La stratégie émerge de l'exécution, pas l'inverse."),
    ("What services do you offer?", "Quels services offrez-vous?"),
    ("Four core pillars:", "Quatre piliers :"),
    ("What technologies do you specialize in?", "Dans quelles technologies vous spécialisez-vous?"),
    ("Who do you work with?", "Avec qui travaillez-vous?"),
    ("Growing SMBs graduating from Excel, enterprises consolidating siloed data systems, and post-merger teams needing one stack, one source of truth, and one reporting culture.",
     "PME en croissance qui sortent d'Excel, entreprises qui unifient des systèmes en silos, et équipes post-fusion qui ont besoin d'une pile, d'une source de vérité et d'une culture de reporting commune."),
    # Footer
    ("© 2026 Yuzu.solutions. Extracting answers. Automating the grind.",
     "© 2026 Yuzu.solutions. On extrait les réponses. On automatise la corvée."),
    (">FAQ</a>", ">FAQ</a>"),
    (">Sitemap</a>", ">Plan du site</a>"),
    # Chart JS
    ("label: 'Meetings/Strategy'", "label: 'Réunions/Stratégie'"),
    ("label: 'PowerPoint/Docs'", "label: 'PowerPoint/Docs'"),
    ("label: 'Actual Engineering'", "label: 'Ingénierie réelle'"),
    ("label: 'Discovery/Diagnosis'", "label: 'Découverte/Diagnostic'"),
    ("label: 'Architecture Prep'", "label: 'Préparation architecture'"),
    ("label: 'Hands-on Engineering'", "label: 'Ingénierie sur le terrain'"),
    ("text: '% of Engagement Time'", "text: '% du temps de mandat'"),
    ("labels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']",
     "labels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']"),
    # serviceData JS
    ('title: "AI & Automation"',
     'title: "IA et automatisation"'),
    ('desc: "Your manual workflows are low-hanging fruit. I build and deploy agents to handle the heavy lifting, connecting your apps and databases with glue code that actually sticks."',
     'desc: "Vos flux manuels sont des fruits à portée de main. Je construis et déploie des agents pour le gros œuvre, connectant vos apps et bases de données avec du code glue qui tient vraiment."'),
    ('list: ["Autonomous Agents", "API Integration Glue Code", "Custom LLM Wrappers"]',
     'list: ["Agents autonomes", "Code glue d\'intégration API", "Enveloppes LLM sur mesure"]'),
    ('title: "Infrastructure & Data"',
     'title: "Infrastructure et données"'),
    ('desc: "I build the backbone. From IaC that doesn\'t break to data pipelines that deliver clean results, I ensure your foundation is rock solid and scales effortlessly."',
     'desc: "Je construis l\'épine dorsale. De l\'IaC qui ne casse pas aux pipelines qui livrent des résultats propres, je m\'assure que votre fondation est solide et évolue sans effort."'),
    ('list: ["Terraform/IaC Deployments", "Resilient ETL Pipelines", "Secure API Gateways"]',
     'list: ["Déploiements Terraform/IaC", "Pipelines ETL résilients", "Passerelles API sécurisées"]'),
    ('title: "Technical Debt & Rescue"',
     'title: "Dette technique et sauvetage"'),
    ('desc: "Got legacy code that\'s gone sour? I find the root cause, refactor the mess, and get your production environment back to peak freshness without bringing the system down."',
     'desc: "Du code legacy qui a tourné? Je trouve la cause racine, refactorise le chaos et remet votre production au frais sans faire tomber le système."'),
    ('list: ["Legacy Code Refactoring", "Latency Bottleneck Fixes", "Production Hotfixes"]',
     'list: ["Refactorisation de code legacy", "Correctifs de goulots de latence", "Correctifs de production"]'),
    ('title: "MVP Builds"',
     'title: "Constructions MVP"'),
    ('desc: "Need a new tool? I ship fast, clean, and maintainable applications designed to last long after the initial rollout. We build for the future, not just the demo."',
     'desc: "Besoin d\'un nouvel outil? Je livre vite, propre et maintenable — conçu pour durer bien après le déploiement initial. On construit pour l\'avenir, pas juste pour la démo."'),
    ('list: ["Custom Internal Tools", "Modern Stack Architecture", "Rapid Prototyping"]',
     'list: ["Outils internes sur mesure", "Architecture stack moderne", "Prototypage rapide"]'),
    # Default detail panel
    (">AI & Automation</h4>", ">IA et automatisation</h4>"),
    ("Your manual workflows are low-hanging fruit. I build and deploy agents to handle the heavy lifting, connecting your apps and databases with glue code that actually sticks.",
     "Vos flux manuels sont des fruits à portée de main. Je construis et déploie des agents pour le gros œuvre, connectant vos apps et bases de données avec du code glue qui tient vraiment."),
    (">Autonomous Agents</li>", ">Agents autonomes</li>"),
    (">API Integration Glue Code</li>", ">Code glue d'intégration API</li>"),
    (">Custom LLM Wrappers</li>", ">Enveloppes LLM sur mesure</li>"),
    # Mega menu h4 titles
    ("<h4>AI &amp; Automation</h4>", "<h4>IA et automatisation</h4>"),
    ("<h4>Infrastructure &amp; Data</h4>", "<h4>Infrastructure et données</h4>"),
    ("<h4>Technical Debt &amp; Rescue</h4>", "<h4>Dette technique et sauvetage</h4>"),
    ("<h4>MVP Builds</h4>", "<h4>Constructions MVP</h4>"),
    # JSON-LD service URLs (hasOfferCatalog only)
    ('"url": "https://yuzu.solutions/services/ai-automation.html"',
     '"url": "https://yuzu.solutions/fr/services/ai-automation.html"'),
    ('"url": "https://yuzu.solutions/services/infrastructure-data.html"',
     '"url": "https://yuzu.solutions/fr/services/infrastructure-data.html"'),
    ('"url": "https://yuzu.solutions/services/technical-debt.html"',
     '"url": "https://yuzu.solutions/fr/services/technical-debt.html"'),
    ('"url": "https://yuzu.solutions/services/mvp-builds.html"',
     '"url": "https://yuzu.solutions/fr/services/mvp-builds.html"'),
    # llms.txt links
    ('href="https://yuzu.solutions/llms.txt"', 'href="https://yuzu.solutions/llms-fr.txt"'),
    ('href="/llms.txt"', 'href="llms-fr.txt"'),
    # FAQ service link labels
    ('>AI &amp; Automation</a>', '>IA et automatisation</a>'),
    ('>Infrastructure &amp; Data</a>', '>Infrastructure et données</a>'),
    ('>Technical Debt &amp; Rescue</a>', '>Dette technique et sauvetage</a>'),
    ('>MVP Builds</a>', '>Constructions MVP</a>'),
    ("Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC, and AI agent development with Cursor and Copilot.",
     "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC et développement d'agents IA avec Cursor et Copilot."),
    # Chart insight JS strings
    ("insightText.innerHTML = '<p class=\"text-lg\"><strong>Traditional Approach:</strong> You pay for overhead. Most of the engagement is spent planning to build, rather than actually building.</p>';",
     "insightText.innerHTML = '<p class=\"text-lg\"><strong>Approche traditionnelle :</strong> Vous payez pour la surcharge. La majeure partie du mandat sert à planifier de construire, plutôt qu\\'à construire réellement.</p>';"),
    ("insightText.innerHTML = '<p class=\"text-lg\"><strong>The Yuzu Squeeze:</strong> 80% of our engagement time is spent engineering solutions, writing code, and deploying agents. Strategy is the byproduct of building.</p>';",
     "insightText.innerHTML = '<p class=\"text-lg\"><strong>La pressée Yuzu :</strong> 80 % de notre temps de mandat est consacré à l\\'ingénierie, au code et au déploiement d\\'agents. La stratégie est le sous-produit de la construction.</p>';"),
]

INDEX_ES: list[tuple[str, str]] = [
    ("<title>Yuzu.solutions | If life gives you Yuzu, make a dashboard</title>",
     "<title>Yuzu.solutions | Si la vida te da yuzu, exprímelo en dashboard</title>"),
    ('content="We turn raw, complex data into refreshing, automated insights. BI, Fabric, automation, and execution-first consulting."',
     'content="Convertimos datos crudos y complejos en insights refrescantes y automatizados. BI, Fabric, automatización y consultoría centrada en la ejecución."'),
    ('content="Yuzu.solutions | If life gives you Yuzu, make a dashboard"',
     'content="Yuzu.solutions | Si la vida te da yuzu, exprímelo en dashboard"'),
    ('content="We turn raw, complex data into refreshing, automated insights."',
     'content="Convertimos datos crudos y complejos en insights refrescantes y automatizados."'),
    ('"description": "Execution-first data consulting. Microsoft Fabric, Power BI, AI automation, and BI leadership."',
     '"description": "Consultoría de datos centrada en la ejecución. Microsoft Fabric, Power BI, automatización con IA y liderazgo BI."'),
    ('"inLanguage": "en"', '"inLanguage": "es"'),
    ('"description": "Boutique data and BI consultancy specializing in Microsoft Fabric, Power BI, AI automation, and hands-on engineering execution."',
     '"description": "Consultoría boutique en datos y BI, especializada en Microsoft Fabric, Power BI, automatización con IA y ejecución técnica práctica."'),
    ('"slogan": "If life gives you Yuzu, make a dashboard."',
     '"slogan": "Si la vida te da yuzu, exprímelo en dashboard."'),
    ('"name": "Data & BI Services"', '"name": "Servicios de datos y BI"'),
    ('"name": "What makes Yuzu.solutions different from traditional consultants?"',
     '"name": "¿Qué diferencia a Yuzu.solutions de los consultores tradicionales?"'),
    ('"text": "Yuzu.solutions spends roughly 80% of engagement time on hands-on engineering — building pipelines, writing code, and deploying agents — rather than meetings and slide decks. Strategy emerges from execution."',
     '"text": "Yuzu.solutions dedica aproximadamente el 80 % del tiempo del proyecto a ingeniería práctica — pipelines, código y agentes — en lugar de reuniones y presentaciones. La estrategia surge de la ejecución."'),
    ('"name": "What services does Yuzu.solutions offer?"',
     '"name": "¿Qué servicios ofrece Yuzu.solutions?"'),
    ('"text": "Four core services: AI & Automation, Infrastructure & Data, Technical Debt & Rescue, and MVP Builds."',
     '"text": "Cuatro pilares: IA y automatización, infraestructura y datos, deuda técnica y rescate, y desarrollos MVP."'),
    ('"name": "What technologies does Yuzu.solutions specialize in?"',
     '"name": "¿En qué tecnologías se especializa Yuzu.solutions?"'),
    ('"text": "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC, and AI agent development."',
     '"text": "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC y desarrollo de agentes de IA."'),
    ('"name": "Who does Yuzu.solutions work with?"',
     '"name": "¿Con quién trabaja Yuzu.solutions?"'),
    ('"text": "Growing SMBs graduating from Excel, enterprises consolidating siloed data systems, and post-merger teams needing a unified reporting stack."',
     '"text": "PYMEs en crecimiento que superan Excel, empresas que consolidan sistemas de datos en silos y equipos post-fusión que necesitan una pila de reporting unificada."'),
    ('<a href="#founder" class="nav-pill-item">Founder</a>', '<a href="#founder" class="nav-pill-item">Fundador</a>'),
    ('<a href="#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Founder</a>',
     '<a href="#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Fundador</a>'),
    ('>Get Started</a>', '>Empezar</a>'),
    ("<p>Agents, workflows &amp; LLM integrations · The Zest</p>",
     "<p>Agentes, flujos de trabajo e integraciones LLM · El toque cítrico</p>"),
    ("<p>Fabric lakehouses, ETL &amp; semantic models · The Core</p>",
     "<p>Lakehouses Fabric, ETL y modelos semánticos · El núcleo</p>"),
    ("<p>Legacy fixes, performance &amp; model cleanup · The Detox</p>",
     "<p>Correcciones legacy, rendimiento y limpieza de modelos · El detox</p>"),
    ("<p>Internal tools, portals &amp; rapid prototypes · The First Press</p>",
     "<p>Herramientas internas, portales y prototipos rápidos · El primer exprimido</p>"),
    (">Welcome to the future of BI</span>", ">Bienvenido al futuro del BI</span>"),
    ("If life gives you <span class=\"text-yellow-500\">Yuzu</span>, make a dashboard.",
     "Si la vida te da <span class=\"text-yellow-500\">yuzu</span>, exprímelo en dashboard."),
    (">We turn raw, complex data into refreshing, automated insights.</p>",
     ">Convertimos datos crudos y complejos en insights refrescantes y automatizados.</p>"),
    (">Contact Us</a>", ">Contáctanos</a>"),
    ('aria-label="Yuzu data juicer turning lemons into dashboards and data"',
     'aria-label="Exprimidor de datos yuzu que convierte limones en dashboards"'),
    (">The Execution Dashboard</h2>", ">El dashboard de ejecución</h2>"),
    ("This section visualizes our core philosophy. While traditional firms spend your budget on endless roadmap meetings, Yuzu.solutions flips the model. Interact with the chart below to see how we reallocate project time towards building, automating, and delivering actual software.",
     "Esta sección visualiza nuestra filosofía. Mientras las firmas tradicionales gastan tu presupuesto en reuniones de hoja de ruta interminables, Yuzu.solutions invierte el modelo. Interactúa con el gráfico para ver cómo reasignamos el tiempo hacia construir, automatizar y entregar software real."),
    (">Traditional Consulting</button>", ">Consultoría tradicional</button>"),
    (">Yuzu Execution</button>", ">Ejecución Yuzu</button>"),
    ("<strong>The Yuzu Squeeze:</strong> 80% of our engagement time is spent engineering solutions, writing code, and deploying agents. Strategy is the byproduct of building.",
     "<strong>El exprimido Yuzu:</strong> el 80 % de nuestro tiempo se dedica a ingeniería, código y despliegue de agentes. La estrategia es el subproducto de construir."),
    ("<strong>Traditional Approach:</strong> You pay for overhead. Most of the engagement is spent planning to build, rather than actually building.",
     "<strong>Enfoque tradicional:</strong> pagas por la sobrecarga. La mayor parte del proyecto se gasta planificando construir, en lugar de construir de verdad."),
    (">🍋 Right Fruit, Right Press</span>", ">🍋 La fruta correcta, el exprimidor correcto</span>"),
    (">Who We Work With</h2>", ">Con quién trabajamos</h2>"),
    ("Whether you're squeezing your first warehouse or wringing sense out of a decade of spreadsheets — we've got the juicer for that.",
     "Ya sea que estés exprimiendo tu primer almacén o sacando sentido de una década de hojas de cálculo — tenemos el exprimidor para eso."),
    (">Growing Companies</h3>", ">Empresas en crecimiento</h3>"),
    ("SMBs outgrowing Excel, ready for their first warehouse and governed reporting. Time to trade the squeeze-by-hand for a real press.",
     "PYMEs que superan Excel, listas para su primer almacén y reporting gobernado. Hora de cambiar el exprimido a mano por una prensa de verdad."),
    (">Enterprise Consolidation</h3>", ">Consolidación empresarial</h3>"),
    ("Larger orgs unifying siloed systems, conflicting KPIs, and years of accumulated data. One orchard, one juice standard.",
     "Organizaciones grandes unificando sistemas en silos, KPI conflictivos y años de datos acumulados. Un huerto, un estándar de jugo."),
    (">Post-Merger Integration</h3>", ">Integración post-fusión</h3>"),
    ("Merging teams that need one stack, one source of truth, and one reporting culture. Two groves, one blend — no pulp left behind.",
     "Equipos en fusión que necesitan una pila, una fuente de verdad y una cultura de reporting común. Dos huertos, una mezcla — sin pulpa olvidada."),
    (">What We Do <span class=\"text-gray-400 font-normal text-3xl\">(The Pulp & The Juice)</span></h2>",
     ">Qué hacemos <span class=\"text-gray-400 font-normal text-3xl\">(La pulpa y el jugo)</span></h2>"),
    ("Explore our core engineering capabilities below. Select a technical pillar on the left to unpack how we replace manual labor with scalable systems. This interactive module details the exact technical outputs you receive when working with us.",
     "Explora nuestras capacidades de ingeniería abajo. Selecciona un pilar técnico a la izquierda para ver cómo reemplazamos el trabajo manual con sistemas escalables. Este módulo interactivo detalla los entregables técnicos exactos que recibes al trabajar con nosotros."),
    ("AI &amp; Automation <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Zest</span>",
     "IA y automatización <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">El toque cítrico</span>"),
    ("Infrastructure &amp; Data <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Core</span>",
     "Infraestructura y datos <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">El núcleo</span>"),
    ("Technical Debt &amp; Rescue <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The Detox</span>",
     "Deuda técnica y rescate <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">El detox</span>"),
    ("MVP Builds <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">The First Press</span>",
     "Desarrollos MVP <span class=\"text-sm font-normal text-yellow-600 uppercase tracking-wider ml-1\">El primer exprimido</span>"),
    (">See dashboards &amp; workflows →</a>", ">Ver dashboards y flujos →</a>"),
    (">Key Deliverables</h5>", ">Entregables clave</h5>"),
    (">How We Work <span class=\"text-gray-400 font-normal text-3xl\">(The Squeeze)</span></h2>",
     ">Cómo trabajamos <span class=\"text-gray-400 font-normal text-3xl\">(El exprimido)</span></h2>"),
    ("No account managers. No bloated timelines. Just direct technical partnership focused on clean execution.",
     "Sin gestores de cuenta. Sin plazos inflados. Solo asociación técnica directa centrada en una ejecución limpia."),
    ("You deal with me, not a middleman with a fancy suit. Direct communication with the engineer building your systems ensures requirements are never lost in translation.",
     "Tratas conmigo, no con un intermediario con traje. La comunicación directa con el ingeniero que construye tus sistemas garantiza que los requisitos nunca se pierdan en la traducción."),
    ("I provide documented, maintainable code with standard CI/CD. I build systems that run themselves, so you don't have to babysit them after deployment.",
     "Entrego código documentado y mantenible con CI/CD estándar. Construyo sistemas que se ejecutan solos, para que no tengas que vigilarlos después del despliegue."),
    ("When I propose a solution, the roadmap comes for free. You aren't paying for a plan; you're paying for the juice. Strategy is the natural byproduct of technical mastery.",
     "Cuando propongo una solución, la hoja de ruta viene incluida. No pagas por un plan; pagas por el jugo. La estrategia es el subproducto natural de la maestría técnica."),
    (">🍋 The Head Squeezer</span>", ">🍋 El maestro exprimidor</span>"),
    (">About the Founder</h2>", ">Sobre el fundador</h2>"),
    ("One senior specialist, zero middlemen, and a serious grudge against zest-less dashboards.",
     "Un especialista senior, cero intermediarios y una seria aversión a los dashboards sin toque cítrico."),
    ('alt="Adrien Yvin — Data Platform Architect and founder of Yuzu.solutions"',
     'alt="Adrien Yvin — arquitecto de plataforma de datos y fundador de Yuzu.solutions"'),
    (">Data Platform Architect &amp; BI Leader</p>", ">Arquitecto de plataforma de datos y líder BI</p>"),
    ("Seven years immersed in data — from ETL pipelines at an energy utility to machine-learning pricing models inside a",
     "Siete años inmerso en datos — desde pipelines ETL en una utility energética hasta modelos de precios con aprendizaje automático en una"),
    ("$4B packaging company</strong>. Currently leading a BI squad at",
     "empresa de empaques de US$4B</strong>. Actualmente liderando un equipo BI en"),
    ("architecting Microsoft Fabric solutions that turn raw transactional data into boardroom-ready decisions.",
     "arquitecturando soluciones Microsoft Fabric que convierten datos transaccionales crudos en decisiones listas para la sala de juntas."),
    ("brings that same precision directly to you — one senior specialist who gets hands dirty in the pipes, owns every medallion layer, and delivers reports you can stake decisions on.",
     "lleva esa misma precisión directamente a ti — un especialista senior que ensucia las manos en las tuberías, posee cada capa medallion y entrega informes en los que puedes basar decisiones."),
    (">Years in Data</div>", ">Años en datos</div>"),
    (">Companies</div>", ">Empresas</div>"),
    (">Languages</div>", ">Idiomas</div>"),
    ("> Experience</h4>", "> Experiencia</h4>"),
    (">Expert BI Analyst &amp; Squad Leader</p>", ">Analista BI experto y líder de equipo</p>"),
    (">Business Intelligence Analyst</p>", ">Analista de inteligencia de negocios</p>"),
    (">BI Consultant</p>", ">Consultor BI</p>"),
    (">BI Intern</p>", ">Pasante BI</p>"),
    ("> Core Stack</h4>", "> Stack principal</h4>"),
    (">Common Questions</h2>", ">Preguntas frecuentes</h2>"),
    ("What makes Yuzu.solutions different from traditional consultants?",
     "¿Qué diferencia a Yuzu.solutions de los consultores tradicionales?"),
    ("We spend roughly 80% of engagement time on hands-on engineering — building pipelines, writing code, and deploying agents — rather than meetings and slide decks. Strategy emerges from execution, not the other way around.",
     "Dedicamos aproximadamente el 80 % del tiempo a ingeniería práctica — pipelines, código y agentes — en lugar de reuniones y presentaciones. La estrategia surge de la ejecución, no al revés."),
    ("What services do you offer?", "¿Qué servicios ofrecen?"),
    ("Four core pillars:", "Cuatro pilares:"),
    ("What technologies do you specialize in?", "¿En qué tecnologías se especializan?"),
    ("Who do you work with?", "¿Con quién trabajan?"),
    ("Growing SMBs graduating from Excel, enterprises consolidating siloed data systems, and post-merger teams needing one stack, one source of truth, and one reporting culture.",
     "PYMEs en crecimiento que superan Excel, empresas que consolidan sistemas en silos y equipos post-fusión que necesitan una pila, una fuente de verdad y una cultura de reporting común."),
    ("© 2026 Yuzu.solutions. Extracting answers. Automating the grind.",
     "© 2026 Yuzu.solutions. Exprimimos respuestas. Automatizamos el trabajo pesado."),
    (">Sitemap</a>", ">Mapa del sitio</a>"),
    ("label: 'Meetings/Strategy'", "label: 'Reuniones/Estrategia'"),
    ("label: 'Actual Engineering'", "label: 'Ingeniería real'"),
    ("label: 'Discovery/Diagnosis'", "label: 'Descubrimiento/Diagnóstico'"),
    ("label: 'Architecture Prep'", "label: 'Preparación de arquitectura'"),
    ("label: 'Hands-on Engineering'", "label: 'Ingeniería práctica'"),
    ("text: '% of Engagement Time'", "text: '% del tiempo del proyecto'"),
    ('title: "AI & Automation"', 'title: "IA y automatización"'),
    ('desc: "Your manual workflows are low-hanging fruit. I build and deploy agents to handle the heavy lifting, connecting your apps and databases with glue code that actually sticks."',
     'desc: "Tus flujos manuales son fruta al alcance. Construyo y despliego agentes para el trabajo pesado, conectando tus apps y bases de datos con código glue que realmente pega."'),
    ('list: ["Autonomous Agents", "API Integration Glue Code", "Custom LLM Wrappers"]',
     'list: ["Agentes autónomos", "Código glue de integración API", "Envoltorios LLM personalizados"]'),
    ('title: "Infrastructure & Data"', 'title: "Infraestructura y datos"'),
    ('desc: "I build the backbone. From IaC that doesn\'t break to data pipelines that deliver clean results, I ensure your foundation is rock solid and scales effortlessly."',
     'desc: "Construyo la columna vertebral. Desde IaC que no se rompe hasta pipelines que entregan resultados limpios, aseguro que tu base sea sólida y escale sin esfuerzo."'),
    ('list: ["Terraform/IaC Deployments", "Resilient ETL Pipelines", "Secure API Gateways"]',
     'list: ["Despliegues Terraform/IaC", "Pipelines ETL resilientes", "Pasarelas API seguras"]'),
    ('title: "Technical Debt & Rescue"', 'title: "Deuda técnica y rescate"'),
    ('desc: "Got legacy code that\'s gone sour? I find the root cause, refactor the mess, and get your production environment back to peak freshness without bringing the system down."',
     'desc: "¿Código legacy agrio? Encuentro la causa raíz, refactorizo el desorden y devuelvo tu producción al máximo frescor sin tumbar el sistema."'),
    ('list: ["Legacy Code Refactoring", "Latency Bottleneck Fixes", "Production Hotfixes"]',
     'list: ["Refactorización de código legacy", "Correcciones de cuellos de botella", "Hotfixes de producción"]'),
    ('title: "MVP Builds"', 'title: "Desarrollos MVP"'),
    ('desc: "Need a new tool? I ship fast, clean, and maintainable applications designed to last long after the initial rollout. We build for the future, not just the demo."',
     'desc: "¿Necesitas una herramienta nueva? Entrego rápido, limpio y mantenible — diseñado para durar mucho después del despliegue inicial. Construimos para el futuro, no solo para la demo."'),
    ('list: ["Custom Internal Tools", "Modern Stack Architecture", "Rapid Prototyping"]',
     'list: ["Herramientas internas personalizadas", "Arquitectura de stack moderna", "Prototipado rápido"]'),
    (">AI & Automation</h4>", ">IA y automatización</h4>"),
    ("Your manual workflows are low-hanging fruit. I build and deploy agents to handle the heavy lifting, connecting your apps and databases with glue code that actually sticks.",
     "Tus flujos manuales son fruta al alcance. Construyo y despliego agentes para el trabajo pesado, conectando tus apps y bases de datos con código glue que realmente pega."),
    (">Autonomous Agents</li>", ">Agentes autónomos</li>"),
    (">API Integration Glue Code</li>", ">Código glue de integración API</li>"),
    (">Custom LLM Wrappers</li>", ">Envoltorios LLM personalizados</li>"),
    ("<h4>AI &amp; Automation</h4>", "<h4>IA y automatización</h4>"),
    ("<h4>Infrastructure &amp; Data</h4>", "<h4>Infraestructura y datos</h4>"),
    ("<h4>Technical Debt &amp; Rescue</h4>", "<h4>Deuda técnica y rescate</h4>"),
    ("<h4>MVP Builds</h4>", "<h4>Desarrollos MVP</h4>"),
    ('"url": "https://yuzu.solutions/services/ai-automation.html"',
     '"url": "https://yuzu.solutions/es/services/ai-automation.html"'),
    ('"url": "https://yuzu.solutions/services/infrastructure-data.html"',
     '"url": "https://yuzu.solutions/es/services/infrastructure-data.html"'),
    ('"url": "https://yuzu.solutions/services/technical-debt.html"',
     '"url": "https://yuzu.solutions/es/services/technical-debt.html"'),
    ('"url": "https://yuzu.solutions/services/mvp-builds.html"',
     '"url": "https://yuzu.solutions/es/services/mvp-builds.html"'),
    ('href="https://yuzu.solutions/llms.txt"', 'href="https://yuzu.solutions/llms-es.txt"'),
    ('href="/llms.txt"', 'href="llms-es.txt"'),
    ('>AI &amp; Automation</a>', '>IA y automatización</a>'),
    ('>Infrastructure &amp; Data</a>', '>Infraestructura y datos</a>'),
    ('>Technical Debt &amp; Rescue</a>', '>Deuda técnica y rescate</a>'),
    ('>MVP Builds</a>', '>Desarrollos MVP</a>'),
    ("Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC, and AI agent development with Cursor and Copilot.",
     "Microsoft Fabric, Power BI, SQL, DAX, Python, scikit-learn, BigQuery, Snowflake, Tableau, ETL/ELT, Terraform/IaC y desarrollo de agentes de IA con Cursor y Copilot."),
    ("insightText.innerHTML = '<p class=\"text-lg\"><strong>Traditional Approach:</strong> You pay for overhead. Most of the engagement is spent planning to build, rather than actually building.</p>';",
     "insightText.innerHTML = '<p class=\"text-lg\"><strong>Enfoque tradicional:</strong> pagas por la sobrecarga. La mayor parte del proyecto se gasta planificando construir, en lugar de construir de verdad.</p>';"),
    ("insightText.innerHTML = '<p class=\"text-lg\"><strong>The Yuzu Squeeze:</strong> 80% of our engagement time is spent engineering solutions, writing code, and deploying agents. Strategy is the byproduct of building.</p>';",
     "insightText.innerHTML = '<p class=\"text-lg\"><strong>El exprimido Yuzu:</strong> el 80 % de nuestro tiempo se dedica a ingeniería, código y despliegue de agentes. La estrategia es el subproducto de construir.</p>';"),
]

# ---------------------------------------------------------------------------
# Service page translation pairs
# ---------------------------------------------------------------------------

def _svc_json_urls(locale: str, slug: str) -> list[tuple[str, str]]:
    en = f'"url": "https://yuzu.solutions/services/{slug}.html"'
    loc = f'"url": "https://yuzu.solutions/{locale}/services/{slug}.html"'
    return [(en, loc)]


SERVICE_NAV_FR: list[tuple[str, str]] = [
    ('<a href="../index.html#founder" class="nav-pill-item">Founder</a>',
     '<a href="../index.html#founder" class="nav-pill-item">Fondateur</a>'),
    ('<a href="../index.html#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Founder</a>',
     '<a href="../index.html#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Fondateur</a>'),
    ('>Get Started</a>', '>Commencer</a>'),
    ('← Back to Services</a>', '← Retour aux services</a>'),
    ("<h4>AI &amp; Automation</h4>", "<h4>IA et automatisation</h4>"),
    ("<h4>Infrastructure &amp; Data</h4>", "<h4>Infrastructure et données</h4>"),
    ("<h4>Technical Debt &amp; Rescue</h4>", "<h4>Dette technique et sauvetage</h4>"),
    ("<h4>MVP Builds</h4>", "<h4>Constructions MVP</h4>"),
    ("<p>Agents, workflows &amp; LLM integrations · The Zest</p>",
     "<p>Agents, flux de travail et intégrations LLM · Le zeste</p>"),
    ("<p>Fabric lakehouses, ETL &amp; semantic models · The Core</p>",
     "<p>Lakehouses Fabric, ETL et modèles sémantiques · Le cœur</p>"),
    ("<p>Legacy fixes, performance &amp; model cleanup · The Detox</p>",
     "<p>Correctifs legacy, performance et nettoyage de modèles · Le détox</p>"),
    ("<p>Internal tools, portals &amp; rapid prototypes · The First Press</p>",
     "<p>Outils internes, portails et prototypes rapides · La première pressée</p>"),
    ('"name": "Home"', '"name": "Accueil"'),
    ('href="https://yuzu.solutions/llms.txt"', 'href="https://yuzu.solutions/llms-fr.txt"'),
    ('title="LLM-readable site summary"', 'title="Résumé du site lisible par LLM"'),
]

SERVICE_NAV_ES: list[tuple[str, str]] = [
    ('<a href="../index.html#founder" class="nav-pill-item">Founder</a>',
     '<a href="../index.html#founder" class="nav-pill-item">Fundador</a>'),
    ('<a href="../index.html#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Founder</a>',
     '<a href="../index.html#founder" class="md:hidden text-sm font-semibold hover:text-yellow-600">Fundador</a>'),
    ('>Get Started</a>', '>Empezar</a>'),
    ('← Back to Services</a>', '← Volver a servicios</a>'),
    ("<h4>AI &amp; Automation</h4>", "<h4>IA y automatización</h4>"),
    ("<h4>Infrastructure &amp; Data</h4>", "<h4>Infraestructura y datos</h4>"),
    ("<h4>Technical Debt &amp; Rescue</h4>", "<h4>Deuda técnica y rescate</h4>"),
    ("<h4>MVP Builds</h4>", "<h4>Desarrollos MVP</h4>"),
    ("<p>Agents, workflows &amp; LLM integrations · The Zest</p>",
     "<p>Agentes, flujos de trabajo e integraciones LLM · El toque cítrico</p>"),
    ("<p>Fabric lakehouses, ETL &amp; semantic models · The Core</p>",
     "<p>Lakehouses Fabric, ETL y modelos semánticos · El núcleo</p>"),
    ("<p>Legacy fixes, performance &amp; model cleanup · The Detox</p>",
     "<p>Correcciones legacy, rendimiento y limpieza de modelos · El detox</p>"),
    ("<p>Internal tools, portals &amp; rapid prototypes · The First Press</p>",
     "<p>Herramientas internas, portales y prototipos rápidos · El primer exprimido</p>"),
    ('"name": "Home"', '"name": "Inicio"'),
    ('href="https://yuzu.solutions/llms.txt"', 'href="https://yuzu.solutions/llms-es.txt"'),
    ('title="LLM-readable site summary"', 'title="Resumen del sitio legible por LLM"'),
]

SERVICE_BODY: dict[str, dict[str, list[tuple[str, str]]]] = {
    "ai-automation": {
        "fr": [
            ("<title>AI & Automation | Yuzu.solutions</title>",
             "<title>IA et automatisation | Yuzu.solutions</title>"),
            ('content="Autonomous agents, API integrations, and LLM wrappers. Automate invoice processing, workflows, and cross-system sync with Yuzu.solutions."',
             'content="Agents autonomes, intégrations API et enveloppes LLM. Automatisez le traitement des factures, les flux et la synchro inter-systèmes avec Yuzu.solutions."'),
            ('content="AI &amp; Automation | Yuzu.solutions"', 'content="IA et automatisation | Yuzu.solutions"'),
            ('content="Agents, workflows, and LLM integrations that automate the grind."',
             'content="Agents, flux et intégrations LLM qui automatisent la corvée."'),
            ('"name": "AI & Automation"', '"name": "IA et automatisation"'),
            ('"description": "Autonomous agents, API integrations, and LLM wrappers that automate invoice processing, support triage, and cross-system workflows."',
             '"description": "Agents autonomes, intégrations API et enveloppes LLM pour automatiser le traitement des factures, le triage du support et les flux inter-systèmes."'),
            ('"serviceType": "AI Automation Consulting"', '"serviceType": "Conseil en automatisation IA"'),
            (">🤖 The Zest</span>", ">🤖 Le zeste</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">AI & Automation</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">IA et automatisation</h1>"),
            ("Your manual workflows are low-hanging fruit. We build and deploy agents that read emails, call APIs, classify documents, and push clean data into your warehouse — so your team stops copy-pasting between tabs.",
             "Vos flux manuels sont des fruits à portée de main. On construit et déploie des agents qui lisent les courriels, appellent les API, classent les documents et poussent des données propres dans l'entrepôt — pour que votre équipe arrête de copier-coller entre les onglets."),
            (">What we automate</h2>", ">Ce qu'on automatise</h2>"),
            ("Invoice &amp; PO intake → ERP posting", "Réception factures et bons de commande → saisie ERP"),
            ("Customer support triage &amp; draft replies", "Triage du support client et brouillons de réponses"),
            ("Scheduled report generation &amp; distribution", "Génération et distribution de rapports planifiés"),
            ("Data quality alerts with root-cause hints", "Alertes qualité de données avec indices de cause racine"),
            ("Cross-system sync (CRM ↔ warehouse ↔ finance)", "Synchro inter-systèmes (CRM ↔ entrepôt ↔ finance)"),
            (">Typical stack</h2>", ">Stack typique</h2>"),
            ("Every agent ships with logging, retry logic, and a human-approval gate where it matters.",
             "Chaque agent est livré avec journalisation, logique de reprise et porte d'approbation humaine là où ça compte."),
            (">Example deliverables</h2>", ">Exemples de livrables</h2>"),
            ("Agent Operations Dashboard", "Tableau de bord des opérations d'agents"),
            ("Invoice Processing Workflow", "Flux de traitement des factures"),
            ("Agent deployment log", "Journal de déploiement d'agent"),
        ],
        "es": [
            ("<title>AI & Automation | Yuzu.solutions</title>",
             "<title>IA y automatización | Yuzu.solutions</title>"),
            ('content="Autonomous agents, API integrations, and LLM wrappers. Automate invoice processing, workflows, and cross-system sync with Yuzu.solutions."',
             'content="Agentes autónomos, integraciones API y envoltorios LLM. Automatiza facturas, flujos y sincronización entre sistemas con Yuzu.solutions."'),
            ('content="AI &amp; Automation | Yuzu.solutions"', 'content="IA y automatización | Yuzu.solutions"'),
            ('content="Agents, workflows, and LLM integrations that automate the grind."',
             'content="Agentes, flujos e integraciones LLM que automatizan el trabajo pesado."'),
            ('"name": "AI & Automation"', '"name": "IA y automatización"'),
            ('"description": "Autonomous agents, API integrations, and LLM wrappers that automate invoice processing, support triage, and cross-system workflows."',
             '"description": "Agentes autónomos, integraciones API y envoltorios LLM que automatizan facturas, triaje de soporte y flujos entre sistemas."'),
            ('"serviceType": "AI Automation Consulting"', '"serviceType": "Consultoría en automatización con IA"'),
            (">🤖 The Zest</span>", ">🤖 El toque cítrico</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">AI & Automation</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">IA y automatización</h1>"),
            ("Your manual workflows are low-hanging fruit. We build and deploy agents that read emails, call APIs, classify documents, and push clean data into your warehouse — so your team stops copy-pasting between tabs.",
             "Tus flujos manuales son fruta al alcance. Construimos y desplegamos agentes que leen correos, llaman APIs, clasifican documentos y envían datos limpios al almacén — para que tu equipo deje de copiar y pegar entre pestañas."),
            (">What we automate</h2>", ">Qué automatizamos</h2>"),
            ("Invoice &amp; PO intake → ERP posting", "Recepción de facturas y OC → registro en ERP"),
            ("Customer support triage &amp; draft replies", "Triaje de soporte y borradores de respuesta"),
            ("Scheduled report generation &amp; distribution", "Generación y distribución programada de informes"),
            ("Data quality alerts with root-cause hints", "Alertas de calidad de datos con pistas de causa raíz"),
            ("Cross-system sync (CRM ↔ warehouse ↔ finance)", "Sincronización entre sistemas (CRM ↔ almacén ↔ finanzas)"),
            (">Typical stack</h2>", ">Stack típico</h2>"),
            ("Every agent ships with logging, retry logic, and a human-approval gate where it matters.",
             "Cada agente incluye registro, reintentos y aprobación humana donde importa."),
            (">Example deliverables</h2>", ">Entregables de ejemplo</h2>"),
            ("Agent Operations Dashboard", "Panel de operaciones de agentes"),
            ("Invoice Processing Workflow", "Flujo de procesamiento de facturas"),
            ("Agent deployment log", "Registro de despliegue de agente"),
        ],
    },
    "infrastructure-data": {
        "fr": [
            ("<title>Infrastructure & Data | Yuzu.solutions</title>",
             "<title>Infrastructure et données | Yuzu.solutions</title>"),
            ('content="Microsoft Fabric lakehouses, medallion ETL, Power BI semantic models, and enterprise data platforms built by Yuzu.solutions."',
             'content="Lakehouses Microsoft Fabric, ETL médaillon, modèles sémantiques Power BI et plateformes de données d\'entreprise par Yuzu.solutions."'),
            ('content="Infrastructure &amp; Data | Yuzu.solutions"', 'content="Infrastructure et données | Yuzu.solutions"'),
            ('content="Microsoft Fabric lakehouses, ETL pipelines, and governed semantic models."',
             'content="Lakehouses Fabric, pipelines ETL et modèles sémantiques gouvernés."'),
            ('"name": "Infrastructure & Data"', '"name": "Infrastructure et données"'),
            ('"description": "Microsoft Fabric lakehouses, medallion architecture, ETL pipelines, Power BI semantic models, and governed enterprise data platforms."',
             '"description": "Lakehouses Microsoft Fabric, architecture médaillon, pipelines ETL, modèles sémantiques Power BI et plateformes de données gouvernées."'),
            ('"serviceType": "Data Engineering & BI Consulting"', '"serviceType": "Conseil en ingénierie de données et BI"'),
            (">🏗️ The Core</span>", ">🏗️ Le cœur</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Infrastructure & Data</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Infrastructure et données</h1>"),
            ("We build the backbone — Microsoft Fabric lakehouses, medallion layers, governed semantic models, and ETL pipelines that don't break on month-end. Raw transactional data in, boardroom-ready KPIs out.",
             "On construit l'épine dorsale — lakehouses Microsoft Fabric, couches médaillon, modèles sémantiques gouvernés et pipelines ETL qui ne lâchent pas à la fin du mois. Données transactionnelles brutes entrantes, KPI prêts pour la salle de conseil sortants."),
            (">What we build</h2>", ">Ce qu'on construit</h2>"),
            ("Bronze → Silver → Gold medallion architecture", "Architecture médaillon Bronze → Argent → Or"),
            ("Incremental ETL with data quality gates", "ETL incrémental avec portes de qualité de données"),
            ("Power BI semantic models &amp; RLS", "Modèles sémantiques Power BI et RLS"),
            ("Cross-region replication &amp; DR patterns", "Réplication inter-régions et schémas de reprise"),
            ("Cost monitoring &amp; capacity planning", "Surveillance des coûts et planification de capacité"),
            (">Typical stack</h2>", ">Stack typique</h2>"),
            (">Example deliverables</h2>", ">Exemples de livrables</h2>"),
            ("Medallion Lakehouse Architecture", "Architecture lakehouse médaillon"),
            ("Pipeline Health Monitor", "Moniteur de santé des pipelines"),
            ("Executive KPI Dashboard", "Tableau de bord KPI exécutif"),
        ],
        "es": [
            ("<title>Infrastructure & Data | Yuzu.solutions</title>",
             "<title>Infraestructura y datos | Yuzu.solutions</title>"),
            ('content="Microsoft Fabric lakehouses, medallion ETL, Power BI semantic models, and enterprise data platforms built by Yuzu.solutions."',
             'content="Lakehouses Microsoft Fabric, ETL medallion, modelos semánticos Power BI y plataformas de datos empresariales por Yuzu.solutions."'),
            ('content="Infrastructure &amp; Data | Yuzu.solutions"', 'content="Infraestructura y datos | Yuzu.solutions"'),
            ('content="Microsoft Fabric lakehouses, ETL pipelines, and governed semantic models."',
             'content="Lakehouses Fabric, pipelines ETL y modelos semánticos gobernados."'),
            ('"name": "Infrastructure & Data"', '"name": "Infraestructura y datos"'),
            ('"description": "Microsoft Fabric lakehouses, medallion architecture, ETL pipelines, Power BI semantic models, and governed enterprise data platforms."',
             '"description": "Lakehouses Microsoft Fabric, arquitectura medallion, pipelines ETL, modelos semánticos Power BI y plataformas de datos gobernadas."'),
            ('"serviceType": "Data Engineering & BI Consulting"', '"serviceType": "Consultoría en ingeniería de datos y BI"'),
            (">🏗️ The Core</span>", ">🏗️ El núcleo</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Infrastructure & Data</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Infraestructura y datos</h1>"),
            ("We build the backbone — Microsoft Fabric lakehouses, medallion layers, governed semantic models, and ETL pipelines that don't break on month-end. Raw transactional data in, boardroom-ready KPIs out.",
             "Construimos la columna vertebral — lakehouses Microsoft Fabric, capas medallion, modelos semánticos gobernados y pipelines ETL que no fallan a fin de mes. Datos transaccionales crudos entran, KPI listos para la junta salen."),
            (">What we build</h2>", ">Qué construimos</h2>"),
            ("Bronze → Silver → Gold medallion architecture", "Arquitectura medallion Bronce → Plata → Oro"),
            ("Incremental ETL with data quality gates", "ETL incremental con compuertas de calidad de datos"),
            ("Power BI semantic models &amp; RLS", "Modelos semánticos Power BI y RLS"),
            ("Cross-region replication &amp; DR patterns", "Replicación entre regiones y patrones de DR"),
            ("Cost monitoring &amp; capacity planning", "Monitoreo de costos y planificación de capacidad"),
            (">Typical stack</h2>", ">Stack típico</h2>"),
            (">Example deliverables</h2>", ">Entregables de ejemplo</h2>"),
            ("Medallion Lakehouse Architecture", "Arquitectura lakehouse medallion"),
            ("Pipeline Health Monitor", "Monitor de salud de pipelines"),
            ("Executive KPI Dashboard", "Dashboard ejecutivo de KPI"),
        ],
    },
    "technical-debt": {
        "fr": [
            ("<title>Technical Debt & Rescue | Yuzu.solutions</title>",
             "<title>Dette technique et sauvetage | Yuzu.solutions</title>"),
            ('content="Legacy Power BI recovery, model refactoring, and report performance fixes. Cut refresh times from hours to minutes with Yuzu.solutions."',
             'content="Récupération Power BI legacy, refactorisation de modèles et correctifs de performance. Passez de heures à minutes pour le rafraîchissement avec Yuzu.solutions."'),
            ('content="Technical Debt &amp; Rescue | Yuzu.solutions"', 'content="Dette technique et sauvetage | Yuzu.solutions"'),
            ('content="Legacy report fixes, performance recovery, and semantic model cleanup."',
             'content="Correctifs de rapports legacy, récupération de performance et nettoyage de modèles sémantiques."'),
            ('"name": "Technical Debt & Rescue"', '"name": "Dette technique et sauvetage"'),
            ('"description": "Legacy Power BI recovery, DAX and model refactoring, report refresh optimization, and production hotfixes without downtime."',
             '"description": "Récupération Power BI legacy, refactorisation DAX et modèles, optimisation du rafraîchissement et correctifs de production sans interruption."'),
            ('"serviceType": "Technical Debt Remediation"', '"serviceType": "Remédiation de dette technique"'),
            (">🛠️ The Detox</span>", ">🛠️ Le détox</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Technical Debt & Rescue</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Dette technique et sauvetage</h1>"),
            ("Got legacy reports that take 40 minutes to refresh? A semantic model nobody dares touch? We diagnose the root cause, refactor the mess, and get your production environment back to peak freshness — without bringing the system down.",
             "Des rapports legacy qui prennent 40 minutes à rafraîchir? Un modèle sémantique que personne n'ose toucher? On diagnostique la cause racine, refactorise le chaos et remet la production au frais — sans faire tomber le système."),
            (">Common rescue missions</h2>", ">Missions de sauvetage courantes</h2>"),
            ("Report refresh times from hours → minutes", "Temps de rafraîchissement de heures → minutes"),
            ("Broken DAX measures &amp; circular dependencies", "Mesures DAX cassées et dépendances circulaires"),
            ("Duplicate tables across 15 workbook copies", "Tables dupliquées dans 15 copies de classeur"),
            ("Failed scheduled refreshes &amp; gateway issues", "Rafraîchissements planifiés échoués et problèmes de passerelle"),
            ("Post-migration data reconciliation", "Réconciliation de données post-migration"),
            (">Our approach</h2>", ">Notre approche</h2>"),
            ("Profile &amp; benchmark current state", "Profiler et benchmarker l'état actuel"),
            ("Identify top 3 bottlenecks (usually 80% of pain)", "Identifier les 3 principaux goulots (souvent 80 % de la douleur)"),
            ("Fix in a staging environment, validate with stakeholders", "Corriger en staging, valider avec les parties prenantes"),
            ("Cut over with rollback plan — zero downtime", "Bascule avec plan de retour arrière — zéro interruption"),
            (">Example deliverables</h2>", ">Exemples de livrables</h2>"),
            ("Performance Recovery Report", "Rapport de récupération de performance"),
            ("Root Cause Analysis Timeline", "Chronologie d'analyse de cause racine"),
            ("Data Model Cleanup", "Nettoyage du modèle de données"),
        ],
        "es": [
            ("<title>Technical Debt & Rescue | Yuzu.solutions</title>",
             "<title>Deuda técnica y rescate | Yuzu.solutions</title>"),
            ('content="Legacy Power BI recovery, model refactoring, and report performance fixes. Cut refresh times from hours to minutes with Yuzu.solutions."',
             'content="Recuperación Power BI legacy, refactorización de modelos y correcciones de rendimiento. Reduce tiempos de actualización de horas a minutos con Yuzu.solutions."'),
            ('content="Technical Debt &amp; Rescue | Yuzu.solutions"', 'content="Deuda técnica y rescate | Yuzu.solutions"'),
            ('content="Legacy report fixes, performance recovery, and semantic model cleanup."',
             'content="Correcciones de informes legacy, recuperación de rendimiento y limpieza de modelos semánticos."'),
            ('"name": "Technical Debt & Rescue"', '"name": "Deuda técnica y rescate"'),
            ('"description": "Legacy Power BI recovery, DAX and model refactoring, report refresh optimization, and production hotfixes without downtime."',
             '"description": "Recuperación Power BI legacy, refactorización DAX y de modelos, optimización de actualización e hotfixes de producción sin tiempo de inactividad."'),
            ('"serviceType": "Technical Debt Remediation"', '"serviceType": "Remediación de deuda técnica"'),
            (">🛠️ The Detox</span>", ">🛠️ El detox</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Technical Debt & Rescue</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Deuda técnica y rescate</h1>"),
            ("Got legacy reports that take 40 minutes to refresh? A semantic model nobody dares touch? We diagnose the root cause, refactor the mess, and get your production environment back to peak freshness — without bringing the system down.",
             "¿Informes legacy que tardan 40 minutos en actualizarse? ¿Un modelo semántico que nadie se atreve a tocar? Diagnosticamos la causa raíz, refactorizamos el desorden y devolvemos tu producción al máximo frescor — sin tumbar el sistema."),
            (">Common rescue missions</h2>", ">Misiones de rescate comunes</h2>"),
            ("Report refresh times from hours → minutes", "Tiempos de actualización de horas → minutos"),
            ("Broken DAX measures &amp; circular dependencies", "Medidas DAX rotas y dependencias circulares"),
            ("Duplicate tables across 15 workbook copies", "Tablas duplicadas en 15 copias de libro"),
            ("Failed scheduled refreshes &amp; gateway issues", "Actualizaciones programadas fallidas y problemas de gateway"),
            ("Post-migration data reconciliation", "Reconciliación de datos post-migración"),
            (">Our approach</h2>", ">Nuestro enfoque</h2>"),
            ("Profile &amp; benchmark current state", "Perfilar y evaluar el estado actual"),
            ("Identify top 3 bottlenecks (usually 80% of pain)", "Identificar los 3 cuellos de botella principales (usualmente el 80 % del dolor)"),
            ("Fix in a staging environment, validate with stakeholders", "Corregir en staging, validar con stakeholders"),
            ("Cut over with rollback plan — zero downtime", "Corte con plan de rollback — cero tiempo de inactividad"),
            (">Example deliverables</h2>", ">Entregables de ejemplo</h2>"),
            ("Performance Recovery Report", "Informe de recuperación de rendimiento"),
            ("Root Cause Analysis Timeline", "Línea de tiempo de análisis de causa raíz"),
            ("Data Model Cleanup", "Limpieza del modelo de datos"),
        ],
    },
    "mvp-builds": {
        "fr": [
            ("<title>MVP Builds | Yuzu.solutions</title>",
             "<title>Constructions MVP | Yuzu.solutions</title>"),
            ('content="Internal tools, pricing engines, and customer portals shipped in 6–8 weeks. Fast, maintainable MVP builds by Yuzu.solutions."',
             'content="Outils internes, moteurs de tarification et portails clients livrés en 6 à 8 semaines. MVPs rapides et maintenables par Yuzu.solutions."'),
            ('content="MVP Builds | Yuzu.solutions"', 'content="Constructions MVP | Yuzu.solutions"'),
            ('content="Fast, clean internal tools and MVPs built to last beyond the demo."',
             'content="Outils internes rapides et propres, MVPs conçus pour durer au-delà de la démo."'),
            ('"name": "MVP Builds"', '"name": "Constructions MVP"'),
            ('"description": "Fast, maintainable internal tools, pricing engines, customer portals, and ML prototypes — shipped in 6–8 weeks."',
             '"description": "Outils internes, moteurs de tarification, portails clients et prototypes ML rapides et maintenables — livrés en 6 à 8 semaines."'),
            ('"serviceType": "MVP Software Development"', '"serviceType": "Développement logiciel MVP"'),
            (">🚀 The First Press</span>", ">🚀 La première pressée</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">MVP Builds</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Constructions MVP</h1>"),
            ("Need a new internal tool, pricing engine, or customer portal? We ship fast, clean, and maintainable applications designed to last long after the demo. Built for the future, not just the pitch deck.",
             "Besoin d'un nouvel outil interne, moteur de tarification ou portail client? On livre vite, propre et maintenable — conçu pour durer bien après la démo. Construit pour l'avenir, pas juste pour le pitch deck."),
            (">What we ship</h2>", ">Ce qu'on livre</h2>"),
            ("Internal pricing &amp; quoting tools", "Outils internes de tarification et devis"),
            ("Inventory &amp; allocation dashboards", "Tableaux de bord d'inventaire et d'allocation"),
            ("Customer self-service portals", "Portails libre-service client"),
            ("Proof-of-concept ML classifiers", "Classificateurs ML preuve de concept"),
            ("API-first micro-apps with auth", "Micro-apps API-first avec authentification"),
            (">Typical timeline</h2>", ">Calendrier typique</h2>"),
            ("Discovery + wireframes", "Découverte + wireframes"),
            ("Core build + API integration", "Construction principale + intégration API"),
            ("UAT with pilot users", "UAT avec utilisateurs pilotes"),
            ("Production deploy + handoff docs", "Déploiement production + docs de passation"),
            (">Example deliverables</h2>", ">Exemples de livrables</h2>"),
            ("Delivery Sprint Board", "Tableau de sprint de livraison"),
            ("Solution Architecture", "Architecture de solution"),
        ],
        "es": [
            ("<title>MVP Builds | Yuzu.solutions</title>",
             "<title>Desarrollos MVP | Yuzu.solutions</title>"),
            ('content="Internal tools, pricing engines, and customer portals shipped in 6–8 weeks. Fast, maintainable MVP builds by Yuzu.solutions."',
             'content="Herramientas internas, motores de precios y portales de clientes en 6–8 semanas. MVPs rápidos y mantenibles por Yuzu.solutions."'),
            ('content="MVP Builds | Yuzu.solutions"', 'content="Desarrollos MVP | Yuzu.solutions"'),
            ('content="Fast, clean internal tools and MVPs built to last beyond the demo."',
             'content="Herramientas internas rápidas y limpias, MVPs hechos para durar más allá de la demo."'),
            ('"name": "MVP Builds"', '"name": "Desarrollos MVP"'),
            ('"description": "Fast, maintainable internal tools, pricing engines, customer portals, and ML prototypes — shipped in 6–8 weeks."',
             '"description": "Herramientas internas, motores de precios, portales de clientes y prototipos ML rápidos y mantenibles — entregados en 6–8 semanas."'),
            ('"serviceType": "MVP Software Development"', '"serviceType": "Desarrollo de software MVP"'),
            (">🚀 The First Press</span>", ">🚀 El primer exprimido</span>"),
            ("<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">MVP Builds</h1>",
             "<h1 class=\"text-4xl md:text-6xl font-extrabold text-gray-900 mt-2\">Desarrollos MVP</h1>"),
            ("Need a new internal tool, pricing engine, or customer portal? We ship fast, clean, and maintainable applications designed to last long after the demo. Built for the future, not just the pitch deck.",
             "¿Necesitas una herramienta interna, motor de precios o portal de clientes? Entregamos rápido, limpio y mantenible — diseñado para durar mucho después de la demo. Hecho para el futuro, no solo para el pitch deck."),
            (">What we ship</h2>", ">Qué entregamos</h2>"),
            ("Internal pricing &amp; quoting tools", "Herramientas internas de precios y cotización"),
            ("Inventory &amp; allocation dashboards", "Dashboards de inventario y asignación"),
            ("Customer self-service portals", "Portales de autoservicio para clientes"),
            ("Proof-of-concept ML classifiers", "Clasificadores ML de prueba de concepto"),
            ("API-first micro-apps with auth", "Micro-apps API-first con autenticación"),
            (">Typical timeline</h2>", ">Cronograma típico</h2>"),
            ("Discovery + wireframes", "Descubrimiento + wireframes"),
            ("Core build + API integration", "Construcción principal + integración API"),
            ("UAT with pilot users", "UAT con usuarios piloto"),
            ("Production deploy + handoff docs", "Despliegue a producción + documentación de entrega"),
            (">Example deliverables</h2>", ">Entregables de ejemplo</h2>"),
            ("Delivery Sprint Board", "Tablero de sprint de entrega"),
            ("Solution Architecture", "Arquitectura de solución"),
        ],
    },
}

LLMS_FR: list[tuple[str, str]] = [
    ("> If life gives you Yuzu, make a dashboard. Execution-first data consulting — we build the press, not PowerPoints.",
     "> Si la vie te donne du yuzu, presse-le en tableau de bord. Conseil en données axé sur l'exécution — on construit le pressoir, pas des PowerPoints."),
    ("Yuzu.solutions is a boutique data & BI consultancy founded by Adrien Yvin",
     "Yuzu.solutions est un cabinet boutique en données et BI fondé par Adrien Yvin"),
    ("## Core positioning", "## Positionnement"),
    ("- **Philosophy:** 80% engineering execution, 20% discovery — strategy is the byproduct of building.",
     "- **Philosophie :** 80 % exécution technique, 20 % découverte — la stratégie est le sous-produit de la construction."),
    ("- **Model:** Direct partnership with a senior specialist. No account managers, no bloated timelines.",
     "- **Modèle :** Partenariat direct avec un spécialiste senior. Pas de gestionnaires de compte, pas de délais gonflés."),
    ("## Who we work with", "## Avec qui on travaille"),
    ("- **Growing companies:** SMBs outgrowing Excel, ready for their first warehouse and governed reporting.",
     "- **Entreprises en croissance :** PME qui dépassent Excel, prêtes pour leur premier entrepôt et un reporting gouverné."),
    ("## Founder — Adrien Yvin", "## Fondateur — Adrien Yvin"),
    ("## Frequently asked questions", "## Questions fréquentes"),
    ("## Key pages", "## Pages clés"),
    ("- Homepage: https://yuzu.solutions/", "- Accueil : https://yuzu.solutions/fr/"),
    ("## Contact", "## Contact"),
    ("Get started via the website: https://yuzu.solutions/#founder",
     "Commencer via le site : https://yuzu.solutions/fr/#founder"),
    ("- LLM summary: https://yuzu.solutions/llms.txt", "- Résumé LLM : https://yuzu.solutions/llms-fr.txt"),
]

LLMS_ES: list[tuple[str, str]] = [
    ("> If life gives you Yuzu, make a dashboard. Execution-first data consulting — we build the press, not PowerPoints.",
     "> Si la vida te da yuzu, exprímelo en dashboard. Consultoría de datos centrada en la ejecución — construimos la prensa, no PowerPoints."),
    ("Yuzu.solutions is a boutique data & BI consultancy founded by Adrien Yvin",
     "Yuzu.solutions es una consultoría boutique en datos y BI fundada por Adrien Yvin"),
    ("## Core positioning", "## Posicionamiento"),
    ("- **Philosophy:** 80% engineering execution, 20% discovery — strategy is the byproduct of building.",
     "- **Filosofía:** 80 % ejecución técnica, 20 % descubrimiento — la estrategia es subproducto de construir."),
    ("- **Model:** Direct partnership with a senior specialist. No account managers, no bloated timelines.",
     "- **Modelo:** Asociación directa con un especialista senior. Sin gestores de cuenta, sin plazos inflados."),
    ("## Who we work with", "## Con quién trabajamos"),
    ("- **Growing companies:** SMBs outgrowing Excel, ready for their first warehouse and governed reporting.",
     "- **Empresas en crecimiento:** PYMEs que superan Excel, listas para su primer almacén y reporting gobernado."),
    ("## Founder — Adrien Yvin", "## Fundador — Adrien Yvin"),
    ("## Frequently asked questions", "## Preguntas frecuentes"),
    ("## Key pages", "## Páginas clave"),
    ("- Homepage: https://yuzu.solutions/", "- Inicio : https://yuzu.solutions/es/"),
    ("## Contact", "## Contacto"),
    ("Get started via the website: https://yuzu.solutions/#founder",
     "Empezar vía el sitio : https://yuzu.solutions/es/#founder"),
    ("- LLM summary: https://yuzu.solutions/llms.txt", "- Resumen LLM : https://yuzu.solutions/llms-es.txt"),
]


def pristine_html(html: str) -> str:
    """Strip prior hreflang / lang-switch injections for idempotent rebuilds."""
    html = strip_i18n_head(html)
    # Only the desktop switcher is regenerated from scratch; the mobile
    # "sm:hidden" switcher stays and is refreshed in place by inject_lang_switcher.
    return re.sub(
        r'\s*<div class="lang-switch(?: hidden sm:flex)?"[^>]*>.*?</div>\s*',
        "\n",
        html,
        flags=re.DOTALL,
    )


def add_lang_css() -> None:
    css_path = ROOT / "css" / "site.css"
    css = css_path.read_text(encoding="utf-8")
    if ".lang-switch" not in css:
        css_path.write_text(css.rstrip() + "\n" + LANG_SWITCH_CSS, encoding="utf-8")


def build_index(locale: str, pristine: str) -> None:
    pairs = INDEX_FR if locale == "fr" else INDEX_ES
    html = apply_replacements(pristine, pairs)
    html = fix_paths_for_locale(html, 1)
    html = inject_lang_css_inline(html)
    html = inject_head(html, "home", locale)
    html = inject_lang_switcher(html, "home", locale)
    out = ROOT / locale / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")


def build_service(locale: str, slug: str, pristine: str) -> None:
    nav = SERVICE_NAV_FR if locale == "fr" else SERVICE_NAV_ES
    body = SERVICE_BODY[slug][locale]
    json_urls = _svc_json_urls(locale, slug)
    breadcrumb_item = (
        f'"item": "https://yuzu.solutions/services/{slug}.html"',
        f'"item": "https://yuzu.solutions/{locale}/services/{slug}.html"',
    )
    home_item = (
        '"item": "https://yuzu.solutions/"',
        f'"item": "https://yuzu.solutions/{locale}/"',
    )
    pairs = nav + body + json_urls + [breadcrumb_item, home_item]
    html = apply_replacements(pristine, pairs)
    html = fix_paths_for_locale(html, 2)
    html = inject_head(html, slug, locale)
    html = inject_lang_switcher(html, slug, locale)
    out = ROOT / locale / "services" / f"{slug}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")


def patch_english_pages(pristine_index: str, pristine_services: dict[str, str]) -> None:
    html = inject_lang_css_inline(pristine_index)
    html = inject_head(html, "home", None)
    html = inject_lang_switcher(html, "home", "en")
    (ROOT / "index.html").write_text(html, encoding="utf-8")

    for slug in SERVICE_SLUGS:
        html = pristine_services[slug]
        html = inject_head(html, slug, None)
        html = inject_lang_switcher(html, slug, "en")
        (ROOT / "services" / f"{slug}.html").write_text(html, encoding="utf-8")


def write_sitemap() -> None:
    pages = ["home", *SERVICE_SLUGS]
    locales = [None, "fr", "es"]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for page in pages:
        for locale in locales:
            loc = page_url(locale, page)
            rels = page_urls(page)
            lines.append("  <url>")
            lines.append(f"    <loc>{loc}</loc>")
            lines.append(f"    <lastmod>{TODAY}</lastmod>")
            if page == "home":
                lines.append("    <changefreq>weekly</changefreq>")
                lines.append("    <priority>1.0</priority>")
            else:
                lines.append("    <changefreq>monthly</changefreq>")
                lines.append("    <priority>0.9</priority>")
            for hl, key in [("en", "en"), ("fr-CA", "fr"), ("es", "es"), ("x-default", "en")]:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{hl}" '
                    f'href="{BASE}{rels[key]}"/>'
                )
            lines.append("  </url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_llms_locales(pristine_llms: str) -> None:
    fr = apply_replacements(pristine_llms, LLMS_FR)
    es = apply_replacements(pristine_llms, LLMS_ES)
    (ROOT / "llms-fr.txt").write_text(fr, encoding="utf-8")
    (ROOT / "llms-es.txt").write_text(es, encoding="utf-8")

    lang_block = (
        "\n## Languages / Langues / Idiomas\n\n"
        "- English: https://yuzu.solutions/llms.txt\n"
        "- Français (Canada): https://yuzu.solutions/llms-fr.txt\n"
        "- Español: https://yuzu.solutions/llms-es.txt\n"
    )
    updated = pristine_llms.rstrip()
    if "## Languages" not in updated:
        updated += lang_block
    (ROOT / "llms.txt").write_text(updated + "\n", encoding="utf-8")


def main() -> None:
    pristine_index = pristine_html((ROOT / "index.html").read_text(encoding="utf-8"))
    pristine_services = {
        slug: pristine_html((ROOT / "services" / f"{slug}.html").read_text(encoding="utf-8"))
        for slug in SERVICE_SLUGS
    }
    pristine_llms = (ROOT / "llms.txt").read_text(encoding="utf-8")

    add_lang_css()

    for locale in ("fr", "es"):
        build_index(locale, pristine_index)
        for slug in SERVICE_SLUGS:
            build_service(locale, slug, pristine_services[slug])

    patch_english_pages(pristine_index, pristine_services)
    write_sitemap()
    write_llms_locales(pristine_llms)
    print("Built fr/ and es/ locales, patched EN pages, sitemap, and llms files.")


if __name__ == "__main__":
    main()

Microsoft publie des mises à jour Power BI chaque mois. La plupart ne demandent pas un projet de migration. Une partie des livraisons **d'avril à juin 2026** sont de petits changements à fort levier, activables cette semaine sans replatformer l'entrepôt.

Cet article filtre les [résumés juin 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264), [avril 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-April-2026-Feature-Summary/ba-p/5173904) et posts GA connexes vers des actions concrètes pour admins BI et auteurs de rapports.

## 1. Org apps avec audiences (disponibilité générale)

Les **org apps** repensent les apps workspace Fabric : plusieurs apps par workspace, branding, pages Overview et navigation maîtrisée. Mi-2026, elles sont en **GA**, avec **audiences** : une surface app, contenu et visibilité nav différents par groupe (direction, managers, terrain).

Pourquoi c'est mieux que « partage le lien workspace » :

- Découverte dans **Recent** et listes d'items sans étape d'installation
- **Plusieurs org apps par workspace** ou **une app + audiences**
- Partage : assignation des audiences directement à l'octroi d'accès

**Victoire cette semaine :** Choisissez le workspace le plus bruyant. Créez une org app avec deux audiences (ex. Direction vs Analyste). Ajoutez une page **Overview**. Retirez la page wiki « quel lien est officiel ? ».

Les apps workspace legacy restent supportées. Planifiez la nouvelle distribution sur org apps.

## 2. Page d'atterrissage du rapport (GA)

**Set as landing page** épingle la page que les viewers doivent voir en premier (clic droit onglet ou volet format). GA dans la vague mai 2026. L'org app mène au rapport ; la landing page mène à la **bonne** page.

**Cible :** packs board, arbres de KPI, rapports dont la page 1 est encore du brouillon 2022.

## 3. Slicer date picker (preview)

Le **date picker** pour slicers (preview juin 2026) attaque la corvée de réouvrir les rapports chaque mois pour reset les plages. Vous publiez un défaut **relatif** (ex. 12 derniers mois ancrés à la dernière date de données). Les viewers gardent le choix manuel dans un seul contrôle.

Activez via **Options > Preview features** dans Desktop, puis option **Date picker** sur un slicer date.

## 4. Fonctions DAX définies par l'utilisateur (GA)

Les **UDF DAX** sont GA en juin 2026. Définissez une fonction (signature typée, paramètres optionnels), réutilisez dans mesures, colonnes et calculs visuels. Les UDF vivent dans le modèle, suivent les renommages, s'éditent en **modélisation web** ou Model View Desktop.

Exemples rentables :

- Conversion devise ou jours ouvrés partagés
- Calculs de marge approuvés référencés partout
- Snippets TMDL versionnés en Git avec le modèle

**Règle d'équipe :** UDF approuvées = bibliothèque partagée. Revue PR avant ajout au modèle golden.

## 5. Copilot en modélisation web (preview)

Juin 2026 : **Copilot en modélisation web** dans le service. Langage naturel pour analyser la structure, renommer tables/colonnes, relations et brouillons de mesures dans le navigateur.

**Garde-fou :** workspaces **Dev/Test** d'abord. Copilot propose ; humains approuvent avant promote. Pair avec Fabric Git pour que les renommages passent en PR.

## 6. Copilot sur Power BI mobile (élargi)

Avril 2026 : **Copilot in-report mobile** passe des prompts figés au **chat multi-tours** ancré au rapport ouvert, avec **citations vers les visuels**. Dictée vocale iOS pour les check-ins exec hors bureau.

**Victoire :** Activez sur vos trois rapports les plus consultés sur mobile. Ajoutez des exemples de questions qui marchent vs desktop.

## 7. Auto-expand matrice et slicers taille fixe

- **Auto-expand matrice (GA) :** Nouveaux niveaux de hiérarchie expandables par défaut. Aide **Personalize this visual** quand les matrices semblent vides repliées.
- **Layout taille fixe card/button/list slicer (GA avril) :** Contrôle pixel quand « fit to space » casse sur thèmes sombres.

## 8. PBIR default-on : hygiène dev, pas flash utilisateur

Microsoft reprend le déploiement **PBIR default-on** dans le service en juin 2026, Desktop visé plus tard été. PBIR aligne PBIX et **PBIP** pour Git, CI/CD et édition programmatique. PBIX reste le format auteur ; le changement est surtout métadonnées internes.

**PBIP + GitHub :** continuez. Opt-in Desktop si pas fait. **PBIX seul :** pas de formation ; surveillez les notes de release juin/juillet.

**Desktop Bridge (preview)** relie l'auteur agent à Desktop pour les **agent skills** rapport. R&D jusqu'à gouvernance prête.

## 9. Azure Maps et tooltips (UX visible, faible effort)

- **Sélection forme Azure Maps activée par défaut (GA juin) :** Lasso région et sélection temps de trajet visibles sans config auteur.
- **Mode phrase tooltip (GA juin) :** Expliquer les métriques en langage clair sans page tooltip custom.

Vérifiez les **paramètres tenant Azure Maps** si les cartes ont cassé après la refonte 2025 (Desktop avril 2025+ requis).

## Reporter (preview vs victoires quotidiennes)

Les annonces Build 2026 (**Agent Skills**, **Fabric Apps sur modèles**) sont réelles mais pour un **workspace pilote** avec capacité Copilot, Git et règles de sign-off. Pas des « petites victoires » si vous combattez encore les échecs de refresh.

| Adopter maintenant | Piloter à part |
|--------------------|----------------|
| Org apps + audiences | Agent skills rapport |
| Landing + Overview | Fabric Apps sémantiques |
| UDF DAX modèle golden | Desktop Bridge |
| Date picker (preview) | Fabric IQ M365 (Frontier) |
| Copilot mobile chat | Copilot modélisation web en Prod |

## Checklist une après-midi

1. Créer ou upgrader une **org app** avec deux audiences et Overview
2. **Landing page** sur le rapport exec principal
3. **Date picker** sur un rapport ops mensuel (preview)
4. Extraire un pattern DAX répété en **UDF** en Dev
5. Confirmer tenant **Azure Maps** et version Desktop minimale
6. Parcourir le [résumé juin 2026](https://community.fabric.microsoft.com/t5/Power-BI-Updates-Blog/Power-BI-June-2026-Feature-Summary/ba-p/5193264) pour un tweak visuel GA (couleur icône slicer, padding axe, hover card)

Ces gestes ne remplacent pas une migration Fabric. Ils réduisent le frottement pendant que Microsoft pousse la BI agentique, et offrent une meilleure porte d'entrée ce trimestre.

Prioriser audiences org app ou standards UDF ? [Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min).

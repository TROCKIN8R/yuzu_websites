Fabric Git relie les items workspace à un dépôt distant. Le dur n'est pas le bouton Connect. C'est d'accord sur la façon de brancher.

## Pattern 1 : trunk-based pour petites équipes

Tout le monde merge vite vers `main`. Branches feature de quelques heures. Fonctionne quand :

- Équipe 2–5 personnes proches
- Modèles qui changent souvent par petits increments
- Revue PR à chaque merge

Sync Fabric Git avant le standup. Peu de conflits si les fichiers sont par item.

## Pattern 2 : branche feature par changement (défaut recommandé)

Une branche par ticket. Merge via PR. Fonctionne quand :

- Plusieurs analystes sur le même modèle sémantique
- CI (DAX, diff TMDL, dry-run deploy)
- Audit demande qui a approuvé la mesure

**Règle :** nom de branche = ID tracker.

## Quoi committer depuis Fabric

- Modèles sémantiques (TMDL / PBIP)
- Rapports liés
- Notebooks et pipelines alimentant Gold

Pas d'items brouillon expérimentaux. Workspace Dev pour tests, sync seulement quand promu.

## Éviter la douleur de merge sur modèles

- **Modèles séparés par domaine** si possible
- **Un owner par modèle** par sprint
- Tabular Editor pour edits bulk, un commit
- Jamais deux renommages de tables sur la même branche

## Git + pipelines de déploiement

Git = vérité d'intention. Pipelines déplacent Dev → Test → Prod :

1. Merge `main` → sync Dev
2. Pipeline → Test après tests
3. Promote Prod après sign-off

GitHub Actions pour notifications et tests externes.

## Checklist semaine 1

1. Connecter workspace Dev au repo
2. Commit initial du modèle golden
3. PR obligatoire pour le 2e changement
4. Documenter nommage branches dans README

Conflit TMDL ? [Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min).

Les pipelines de déploiement sont le rail de promotion BI. Ils marchent quand chaque stage a un rôle, pas quand Dev est le cimetière des rapports.

## Rôles des stages (restez simples)

| Stage | Rôle |
|-------|------|
| Dev | Intégration et essais |
| Test | QA, UAT, RLS, perf |
| Prod | Utilisateurs finaux et abonnements |

**Règle :** pas d'édition directe en Prod. Hotfix = Dev → Test → Prod.

## Automatiser en premier

1. **Règles dataset** (paramètres, refresh) à la promotion
2. **Rapports seuls** si le DAX n'a pas changé
3. **Refresh post-deploy** en Test
4. **Webhook Slack/Teams** si promote échoue

## Dataset complet vs rapport seul

**Dataset + rapports** si relations, mesures ou RLS changent.

**Rapports seuls** si layout, thèmes, signets seulement.

Sinon : « champ introuvable » en Prod lundi 8h.

## Git vs pipelines

- **Git :** historique, revue, rollback
- **Pipeline :** isolation environnements, promote pour approbateurs

Merge `main` → sync Dev, pipeline vers Test/Prod.

## Garde-fous utiles

- Checklist sign-off en Test
- Diff schéma entre stages
- Pause abonnements sur breaking changes

## Anti-patterns

- Prod = zone de fix live
- Test sauté pour « petit » RLS
- 40 rapports sans règles dataset

Commencez par un modèle golden et trois rapports. Un mois vert avant d'ajouter tout le département.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour revue pipeline Fabric.

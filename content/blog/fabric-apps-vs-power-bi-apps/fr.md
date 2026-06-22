Microsoft Fabric propose désormais deux notions d'« app » différentes. Elles se ressemblent en réunion. Elles ne règlent pas les mêmes problèmes.

## Apps Power BI : la compilation de rapports

Une **app Power BI**, c'est le classique : compilation read-only de rapports et tableaux de bord d'un workspace, publiée à une audience avec permissions centralisées.

**Idéal pour :**

- Tableaux de bord exécutifs et packs mensuels
- Self-service où l'utilisateur consomme sans modifier
- Remplacer les liens workspace bruyants par une entrée unique

**Limites :**

- Lecture seule pour les utilisateurs finaux
- Pas d'écriture ni de formulaires opérationnels
- Centré rapports, pas application web complète

Si l'objectif est « un lien pour le pack finance », l'app Power BI reste le bon choix.

## Apps Fabric : la webapp read/write sur vos données

Une **app Fabric** (app builder Fabric / Power Apps dans l'écosystème Fabric) est une application web qui peut **lire et écrire** sur les items du workspace : tables lakehouse, entrepôt SQL, modèles sémantiques, notebooks ou pipelines.

Pensez outillage opérationnel :

- Validations et mises à jour de statut en table
- Saisie terrain depuis mobile
- CRUD léger sur données de référence sans App Service séparé

**Idéal pour :**

- Processus où l'utilisateur **modifie** des données
- Besoins qui dépassent « une page de rapport de plus »
- Équipes Fabric qui veulent une seule histoire sécurité et lignée

**Compromis :**

- Plus d'effort de build et test qu'une app de rapports
- UX, validation et erreurs à votre charge
- Gouvernance sur les chemins d'écriture, pas seulement RLS en lecture

## Aide décision rapide

| Question | Plutôt |
|----------|--------|
| Les utilisateurs ne font que consulter des KPI ? | App Power BI |
| Ils doivent soumettre ou modifier des enregistrements ? | App Fabric |
| Formulaires mobile-first ? | App Fabric |
| Catalogue de rapports certifiés ? | App Power BI |
| Écritures dans OneLake / entrepôt ? | App Fabric |

## Pattern hybride terrain

Gardez l'**app Power BI** comme porte d'entrée analytics. Ajoutez une **app Fabric** pour le workflow qui casse chaque mois (ajustements budget, corrections référentiel, log d'exceptions). Même workspace, mêmes groupes Entra, deux surfaces read vs write.

## Conseil déploiement

Pilotez l'app Fabric en non-prod avec schémas réels et RLS calqués sur Prod. Validez volume d'écriture et impact refresh avant diffusion large.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour cartographier read vs write avant d'engager l'équipe.

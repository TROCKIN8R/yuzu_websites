La BI batch fait tourner l'entreprise. Les ops veulent des minutes, pas un refresh nocturne. Le chemin temps réel Fabric relie Eventstream, Eventhouse et Power BI.

## La stack streaming dans Fabric

Flux typique :

1. **Eventstream** ingère IoT, événements app ou CDC
2. **Eventhouse (base KQL)** stocke tables haute vélocité
3. **Modèle sémantique ou DirectQuery** expose des vues curated à Power BI
4. **Dashboard Real-Time** optionnel pour tuiles ops sub-seconde

Pas besoin de tout importer en VertiPq. Agréguez en KQL, exposez des grains 5 min ou horaires à la BI.

## Power BI vs dashboards Real-Time

| Besoin | Surface |
|--------|---------|
| KPI exec avec drill-down | Rapport Power BI sur agrégat KQL |
| Mur NOC, statut ligne | Dashboard Real-Time |
| Batch + live | Hybride : historique Import + tuile live KQL |

## Gouvernance à haute vélocité

- **Rétention** sur tables brutes Eventhouse
- **PII scrubbing** dans Eventstream
- Workspace séparé expérimentation vs BI certifiée
- Libellés clairs **live** vs **delayed** sur les rapports

## Conseils dev BI

- Shaping complexe en **vues matérialisées KQL**, pas DAX sur milliards de lignes Import
- Tester coût requête en pic d'événements
- Nommer streams et bases comme un entrepôt (`ops.machine_events`)

## Pilote

Un métier, un type d'événement, un dashboard trois métriques. Deux semaines en parallèle du rapport batch.

Eventstream vers Power BI pour votre usine ou télémétrie app ? [Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min).

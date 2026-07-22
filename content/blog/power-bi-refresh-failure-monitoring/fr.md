Les échecs de refresh restent silencieux jusqu'au lundi matin. Le CFO a déjà capturé une tuile vide.

## Quoi surveiller en premier

| Signal | Où | Pourquoi |
|--------|-----|----------|
| Statut refresh | Paramètres dataset / historique Fabric | Premier indicateur |
| Performance gateway | Logs gateway on-premises | Timeouts déguisés en erreurs DAX |
| Throttling capacité | App Fabric Capacity Metrics | Refresh en file, pas en échec — mais cassé |
| Erreurs d'abonnement | Courriels Power BI | Les utilisateurs voient avant les ops |

Commencez par **un dataset certifié** alimentant les tableaux exécutifs.

## Alertes utiles

Une bonne alerte inclut dataset + workspace, dernier refresh réussi, propriétaire nommé et lien runbook. Routez vers Slack/Teams via Power Automate ou une GitHub Action légère.

## Runbook minimal

- Confirmer échec service vs gateway
- Relancer une fois ; capturer le message d'erreur
- Vérifier fenêtre maintenance source
- Si gateway : redémarrage planifié
- Communiquer l'ETA aux owners

## Notes Fabric

En Fabric, le refresh peut toucher un modèle lié à des shortcuts lakehouse. Vérifiez si l'échec vient du modèle ou d'un job Spark amont.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour brancher l'observabilité refresh à votre pipeline.
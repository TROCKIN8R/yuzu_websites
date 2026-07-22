L'architecture médaille est un classement pour tables lake. Dans Fabric, OneLake rend les dossiers réels — si l'équipe s'accorde sur le rôle de chaque couche.

## Responsabilités par couche

| Couche | Contient | À éviter |
|--------|----------|----------|
| **Bronze** | Ingest brut, historique complet | Noms métier |
| **Silver** | Entités nettoyées et conformes | KPI spécifiques à un rapport |
| **Gold** | Marts curés, grain fixé | JSON brut |

**Règle :** les consommateurs Power BI lisent le **Gold**. Les analystes explorent Silver. Les ingénieurs possèdent Bronze.

## Layout workspace Fabric

Utilisez des **shortcuts** vers un Bronze central si plusieurs domaines partagent la même source.

## Nommage

Documentez le grain dans la description Gold. Vous futur (et Copilot) en auront besoin.

## Attachement Power BI

Préférez **Direct Lake** sur Gold. Import depuis Gold seulement si le DAX l'exige.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour concevoir votre médaille sur OneLake.
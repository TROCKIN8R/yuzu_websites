Les rapports lents n'ont pas toujours besoin d'un SKU plus gros. Ils ont besoin de moins de mauvaises mesures au rendu.

## Diagnostiquer avant de réécrire

1. **Performance Analyzer** : noter la mesure dominante
2. **DAX Studio** Server Timings : séparer FE vs SE
3. **VertiPaq Analyzer** : colonnes haute cardinalité

Temps SE élevé → modèle. Temps FE élevé → DAX.

## Patterns nocifs

`SUMX` sur grosse table, `FILTER` sur table entière, `CALCULATE` imbriqués, itérateurs sur texte.

## Patterns utiles

`VAR`, groupes de mesures, mesures de base documentées, revue DAX Studio en PR.

Si le visuel scanne 40M lignes par clic, agrégez dans Gold plutôt que de tuner le DAX à l'infini.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) si le rapport reste lent après nettoyage.
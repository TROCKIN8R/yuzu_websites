La sécurité ligne (RLS) casse quand l'effectif bouge plus vite que votre DAX. Quelques patterns survivent aux réorganisations et aux audits.

## Pattern 1 : RLS pilotée par groupes Entra

Reliez `USERPRINCIPALNAME()` à une table **UserAccess** maintenue par l'IT, pas par des emails collés dans Excel.

Colonnes : UserEmail, Region, CostCenter, Role. Refresh depuis HR ou Entra chaque nuit.

## Pattern 2 : table pont many-to-many

L'utilisateur couvre plusieurs régions ou marques. Table **UserRegionBridge** :

`UserEmail | RegionKey`

Relations : Users → Bridge → Dimension Region → Fait.

Une règle scale quand marketing ajoute une région.

## Pattern 3 : sécurité dynamique sur dimension, pas fait

RLS sur **Region** ou **Customer**, pas sur le fait 40M lignes. Contexte filtre plus petit, requêtes plus rapides, validation plus simple.

## Tests avant promote pipeline

Minimum automatisé :

1. **Comptes test** Entra (accès total, restreint, aucun)
2. **View as role** dans Desktop avant commit
3. Script XMLA ou preview rôle Tabular Editor en CI

## Échecs fréquents

- Emails en dur dans le DAX
- RLS sur colonnes calculées qui casse le folding
- Comptes de service oubliés pour les abonnements

Documentez les rôles admin break-glass explicitement.

## Object-level security

OLS sur table/colonne pour PII (salaire, ID national). Combinez avec RLS : l'utilisateur voit la région mais pas la colonne salaire.

RLS sur un modèle live à 200 personnes ? [Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min).

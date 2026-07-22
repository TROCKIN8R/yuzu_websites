Le refresh incrémental économise des heures jusqu'à un filtre modifié qui recharge tout l'historique.

## Prérequis source

Colonne date fiable, requêtes filtrées, fuseau documenté.

## Paramètres

`RangeStart` / `RangeEnd`, période archive vs incrémentale alignée sur données tardives.

## Taille partitions

Volume modéré : incrément journalier. Gros volume : partitions mensuelles ou Direct Lake.

## Détecter full refresh silencieux

Durée refresh, lignes traitées, octets gateway — alerte si 2× baseline.

## Échecs fréquents

Filtre date retiré, source non indexée, clés merge incorrectes.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour revoir votre plus grosse table de faits.
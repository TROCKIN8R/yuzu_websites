Le choix de mode de stockage était Import vs DirectQuery. Fabric ajoute **Direct Lake** : interroger le parquet OneLake sans Import VertiPaq. Cela change la donne pour les gros modèles.

## Mode Import : la zone de confort

**Import** copie les données dans le moteur sémantique. Requêtes rapides. DAX complet. Fenêtres de refresh prévisibles.

**Choisir Import quand :**

- Jeu de données assez petit pour refresh nocturne
- DAX complexe, tables calculées, patterns legacy
- Les sources ne supportent pas la charge live query

**Attention :** double stockage (lake + modèle), chaînes de refresh longues, écart warehouse vs snapshot importé.

## DirectQuery : SQL live, compromis live

**DirectQuery** interroge la source à l'exécution du rapport. Pas de grosse copie locale.

**Choisir DirectQuery quand :**

- Données quasi temps réel et taille modèle interdit Import
- Source SQL ou entrepôt dimensionné pour la charge

**Attention :** visuels lents, DAX restreint, pics utilisateurs sur l'entrepôt.

## Direct Lake : interroger le lake sur place

**Direct Lake** lit les fichiers OneLake via le modèle sémantique sans Import complet. Moins de duplication, refresh plus court, alignement médaille.

**Choisir Direct Lake quand :**

- La couche Gold vit déjà dans OneLake
- Performance type Import sans doubler le stockage
- Capacité Fabric compatible

**Attention :** disponibilité régionale, tables mixtes, compétences lake à monter.

## Comparaison rapide

| Facteur | Import | DirectQuery | Direct Lake |
|---------|--------|-------------|-------------|
| Fraîcheur | Refresh planifié | Quasi live | Refresh + fichiers lake |
| Taille modèle | Pression haute | Basse | Moyenne |
| DAX | Maximum | Limité | En progression |

## Migration recommandée

Ne basculez pas 200 tables d'un coup. Démarrez un **nouveau domaine** en Direct Lake. Rapports parallèles un sprint. Comparez refresh, latence et confort dev. Puis décidez domaine par domaine.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour dimensionner Direct Lake sur votre lakehouse.

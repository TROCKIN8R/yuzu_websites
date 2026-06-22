Copilot dans Microsoft Fabric ne remplace pas votre modèle sémantique. C'est un accélérateur pour le travail BI répétitif, si vous lui donnez des garde-fous.

## Workflow 1 : Échafaudage de mesures

Demandez à Copilot de rédiger des mesures DAX à partir d'une spec en langage clair, puis révisez en PR comme tout autre code. Ne fusionnez jamais du DAX généré par IA sans un humain responsable de la définition métier.

**Pattern de prompt :** « Ajoute croissance revenus YoY avec intelligence temporelle sur Sales[OrderDate]. Utilise notre suffixe `_ YoY Growth`. »

## Workflow 2 : Documentation pipeline et notebooks

Les data engineers passent des heures à documenter notebooks Spark et étapes pipeline. Copilot peut générer une première passe de README à partir des commentaires et sorties de cellules. Les éditeurs valident encore l'exactitude contre le graphe de lignée réel.

## Workflow 3 : Q&R en langage naturel gouverné

Copilot pour Power BI fonctionne mieux quand le modèle sémantique est propre : noms de tables clairs, mesures documentées, RLS déjà testé. Corrigez le modèle d'abord ; Copilot ensuite.

## Ce qu'il faut éviter

- Laisser Copilot renommer des tables en production sans Git
- Utiliser du SQL généré dans des pipelines sans EXPLAIN / contrôles de volumétrie
- Sauter la revue PR parce que « l'IA l'a écrit »

## Prochaines étapes

Choisissez un rapport à fort turnover. Ajoutez trois mesures assistées Copilot via branche + PR. Mesurez le cycle time avant/après. Ces données vendent le workflow à la direction mieux qu'une démo éditeur.

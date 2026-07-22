La gouvernance n'est pas une slide trimestrielle. C'est une checklist courte avant chaque promote prod.

## Checklist pré-promotion

### Ownership et métadonnées

- [ ] Owner et backup nommés
- [ ] Définitions métier pour le top 10 mesures
- [ ] Refresh documenté avec fuseau et dépendances
- [ ] Groupe Entra pour l'accès workspace

### Qualité modèle

- [ ] Schéma en étoile ou exception documentée
- [ ] Colonnes inutiles masquées
- [ ] RLS / OLS testés (trois comptes)
- [ ] Pas de mesures dupliquées

### Contrôle des changements

- [ ] Git ou sync Fabric avant promote
- [ ] Changelog pour renommages breaking
- [ ] Smoke test rapport en Test

### Certification

- [ ] Certifié par approbateur nommé
- [ ] Modèles dépréciés signalés, pas supprimés en silence

## Spécifique Fabric

Documentez le mode de stockage par table et le lien vers Gold.

[Réservez un appel de 30 minutes](https://calendly.com/adrienyvin/30min) pour déployer cette gouvernance.
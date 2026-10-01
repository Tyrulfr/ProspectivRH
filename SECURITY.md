# Sécurité et données RH

ProspectivRH est destiné à manipuler à terme des données RH potentiellement
sensibles. Le dépôt GitHub public ne doit contenir que le code, la documentation,
les ressources graphiques autorisées et des données entièrement synthétiques.

## Signaler un problème

Ne publiez jamais de données personnelles ou de secrets dans une *issue*.
Utilisez le signalement privé de vulnérabilité GitHub s’il est activé, ou
contactez directement le propriétaire du dépôt.

## Principes d’architecture

- aucune connexion SQL institutionnelle depuis le navigateur public ;
- secrets conservés uniquement côté serveur dans une infrastructure privée ;
- contrôle de schéma, qualité, minimisation et pseudonymisation avant diffusion ;
- API publique limitée à la lecture de données agrégées autorisées ;
- journalisation des imports et des décisions de publication ;
- séparation stricte entre données brutes, données de travail et données
  publiables.

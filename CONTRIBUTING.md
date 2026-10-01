# Contribuer à ProspectivRH

## Principe

Le dépôt est public en lecture. Une personne extérieure peut proposer une
*pull request*, mais seuls les mainteneurs autorisés peuvent intégrer une
modification dans `main`.

## Cycle de contribution

1. Créer une branche courte depuis `main`.
2. Décrire clairement la modification et son impact sur les données.
3. Exécuter `pnpm run check`.
4. Ouvrir une *pull request*.
5. Faire relire la modification avant fusion.

## Règles relatives aux données

- Ne jamais versionner de données RH réelles ou nominatives.
- Ne jamais ajouter de secret, mot de passe ou chaîne de connexion.
- Utiliser exclusivement des données synthétiques dans les tests.
- Documenter toute nouvelle règle de normalisation ou de calcul.
- Préserver la traçabilité de la source et de la date de référence.

## Conventions techniques

- TypeScript strict pour le moteur et l’interface.
- Une règle métier nouvelle doit être accompagnée d’un test.
- Le frontend public ne doit contenir aucun secret ni accès SQL direct.
- Les sorties générées (`dist-public`, `release`, bundles Electron) ne sont pas
  versionnées.

## Vérifications locales

```bash
pnpm install
pnpm run check
```

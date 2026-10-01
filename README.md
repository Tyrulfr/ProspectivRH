# ProspectivRH

Application de prospective des ressources humaines pour analyser les effectifs,
anticiper les départs et préparer les stratégies de renouvellement des emplois et
des compétences à l’échelle de plusieurs établissements.

> **Statut : prototype en développement.** Les données affichées par défaut sont
> des données de démonstration. Aucun fichier RH réel n’est publié dans ce dépôt.

[Application publique](https://tyrulfr.github.io/ProspectivRH/) ·
[Code source GitHub](https://github.com/Tyrulfr/ProspectivRH)

## Finalité

ProspectivRH doit permettre de :

- consolider des données RH issues de plusieurs établissements ;
- suivre la démographie, les statuts, les corps et les missions ;
- estimer les départs selon l’horizon et l’âge de départ retenus ;
- simuler des stratégies de remplacement, de mobilité et de recrutement ;
- identifier les emplois et compétences à sécuriser ;
- préparer de futurs connecteurs vers les systèmes sources des établissements.

## Accès public et droits de modification

Le dépôt GitHub est public en lecture. Seuls le propriétaire du dépôt et les
collaborateurs explicitement autorisés peuvent pousser des modifications. Les
autres personnes peuvent uniquement proposer une modification par *pull request*.

La version GitHub Pages est une application statique :

- elle ne possède aucun accès direct aux bases RH institutionnelles ;
- elle n’expose aucune fonction d’écriture sur un serveur ;
- l’import éventuel d’un classeur est traité localement dans le navigateur ;
- un import local ne modifie jamais les données visibles par les autres visiteurs.

Les futures données multi-établissements devront transiter par une chaîne privée
d’intégration, de contrôle et d’anonymisation avant exposition au portail public.
Voir [l’architecture cible](docs/ARCHITECTURE.md).

## Démarrage dans VS Code

Prérequis : Node.js `>= 22.13` et pnpm `11.x`.

```bash
git clone https://github.com/Tyrulfr/ProspectivRH.git
cd ProspectivRH
pnpm install
pnpm run dev
```

Ouvrir ensuite <http://localhost:3000>.

Dans VS Code, les commandes principales sont également disponibles via
**Terminal → Exécuter la tâche** :

- `ProspectivRH : serveur local` ;
- `ProspectivRH : vérifications` ;
- `ProspectivRH : build public`.

## Commandes utiles

| Commande | Usage |
| --- | --- |
| `pnpm run dev` | Serveur local sur `localhost:3000` |
| `pnpm run lint` | Contrôle du code |
| `pnpm run test` | Build web et tests du moteur GPEC |
| `pnpm run public:build` | Génère le site statique dans `dist-public/` |
| `pnpm run check` | Lance lint, tests et build public |
| `pnpm run desktop:renderer` | Compile l’interface de l’application macOS |
| `pnpm run desktop:build` | Prépare le paquet Electron macOS |

## Organisation du projet

```text
app/                       interface principale
lib/gpec-engine.ts         règles de traitement et calculs GPEC
public/                    identité visuelle et ressources publiques
tests/                     tests automatisés
desktop/                   enveloppe de bureau Electron
docs/ARCHITECTURE.md       architecture actuelle et cible
.github/workflows/         intégration continue et GitHub Pages
vite.public.config.ts      build statique public
```

## Données et confidentialité

Les classeurs Excel, exports RH, bases locales et secrets sont exclus par
`.gitignore`. Ne jamais ajouter de données nominatives, même dans un test ou une
capture d’écran. Les jeux d’essai destinés au dépôt doivent être synthétiques et
ne permettre aucune ré-identification.

Le moteur actuel attend une feuille Excel nommée `Trame`. Les règles importées du
prototype VBA sont testées dans `tests/gpec-engine.test.mjs`.

## Publication

À chaque mise à jour validée de la branche `main`, GitHub Actions :

1. installe les dépendances ;
2. construit la version publique statique ;
3. publie l’artefact sur GitHub Pages.

La procédure détaillée figure dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Feuille de route

- définir le modèle de données commun inter-établissements ;
- créer une API de lecture séparée du portail public ;
- développer les connecteurs SQL/API dans une infrastructure privée ;
- ajouter validation, pseudonymisation et journalisation des flux ;
- gérer les habilitations des administrateurs de données ;
- industrialiser les scénarios prospectifs et les exports.

## Licence

Aucune licence open source n’est attribuée pour le moment. Le code est visible à
des fins de développement et d’évaluation ; sa réutilisation reste soumise à
l’autorisation du détenteur des droits.

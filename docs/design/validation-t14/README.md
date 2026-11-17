# Validation visuelle T14 | Écrans confirmés par PAN

PAN a confirmé les écrans le 9 novembre 2026 avant commit et PR. Salam relira la réalisation
et sa frontière avec le wallet. Ouvrir la [galerie HTML](index.html) dans un navigateur
pour comparer les étapes, ou [l’accueil](01-accueil.png) directement.

Les 15 captures du 9 novembre 2026 proviennent des vrais composants React Native
rendus avec React Native Web dans Edge sans fenêtre visible. Neuf vues montrent
les étapes et l’état d’indisponibilité ; deux vues montrent le bas des étapes longues ;
quatre vues vérifient l’accueil et ses actions après défilement à petite taille.
Les [mesures](mesures.json) relèvent les dimensions et une console sans erreur
pendant ce parcours. Aucun débordement horizontal du document n’a été relevé aux
largeurs 390, 360 et 320 pixels.

Le parcours examiné passe par l’entrée normale jusqu’au refus avant PIN, puis par
l’aperçu explicite : langue, préparation, code, confirmation, jetons, quiz et fin.
Seuls les jetons non Bitcoin `exemple01` à `exemple12` sont montrés. Les champs PIN
sont capturés vides. Aucune clé, phrase de récupération réelle ni donnée privée.

| Avant                                                                         | Proposition actuelle                                                    | Raison                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Des surfaces SVG suggéraient un objet.                                        | Un portefeuille original généré, bleu nuit et citron, occupe l’accueil. | Donner une présence matérielle lisible en prolongeant l’identité choisie. |
| Les choix du quiz pouvaient donner deux boutons puis un troisième plus large. | Trois choix de largeur égale, empilés sous 360 pixels.                  | Maintenir une composition régulière sans réduire le texte.                |
| Une aide n’indiquait pas son état d’ouverture.                                | Question explicite et état accessible développé/réduit.                 | Permettre de comprendre l’action avec la lecture assistée.                |

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092` et choisir « Essayer le parcours fictif » pour voir toutes
les étapes. Sur Expo Go compatible SDK 58 : `npm run mobile`, même réseau entre
téléphone et PC, puis scanner le QR.

Jest vérifie aussi le parcours avec une largeur de 320 et une échelle de texte de
2 : les consignes et actions restent disponibles, l’image facultative disparaît.
Il ne mesure pas la troncature réelle des pixels. Les essais Android avec clavier,
TalkBack, retours, arrière-plan, capture et arrêt du processus restent à conduire,
ainsi que les essais de compréhension avec les publics concernés.

L’aperçu ne crée pas de wallet. Le branchement natif, la récupération authentifiée
et les sauvegardes Lightning ne sont pas validés par ces images. Lire la
[recherche](../onboarding-recherche.md), la [direction](../onboarding-direction.md)
et le [suivi T14](../../planning/suivi-t14.md).

## Contrôles locaux du 9 novembre

- 123 tests mobiles réussis dans six suites.
- 113 tests des outils : 112 réussis, un lien fichier ignoré faute de permission
  Windows, aucun échec au passage final. Un premier passage sous forte charge
  avait dépassé les 100 ms du test VM ; la relance isolée a réussi.
- Format, ESLint, TypeScript et cohérence du dépôt vérifiés. Le garde T09 analyse
  les sources mobiles sans texte littéral détecté.
- `expo install --check` en ligne confirme l’alignement SDK 58. Une simulation
  `npm ci --ignore-scripts --dry-run` réussit avec le lockfile courant.
- L’export JavaScript Android de diagnostic réussit avec `--no-bytecode` :
  1042 modules, un bundle de 1,6 Mo et 21 ressources, dont le visuel de 676 Ko.
  La source pleine définition de l’illustration n’entre pas dans les ressources
  embarquées par cet export.

L’export standard en bytecode Hermes n’a pas réussi : la politique Windows
Application Control bloque l’exécutable du compilateur Hermes 260318099.0.5 livré
avec React Native 0.88.1. Aucun réglage de sécurité du système n’est changé.
L’export JavaScript sert au diagnostic ; il ne valide ni une compilation APK
ni le démarrage d’une version Android de production.

L’audit npm après installation relève 33 alertes, dont une faible et 32 modérées,
aucune élevée ou critique. Ce relevé porte sur l’ensemble des dépendances après
la migration ; il n’attribue pas ces alertes aux seuls ajouts T14. Aucun correctif
forcé ni mise à jour sans rapport n’est appliqué sur cette base.

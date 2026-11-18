# Validation visuelle | Retirer T25

Projet de Salam et PAN. PAN réalise T25 ; PAN a confirmé les nouveaux écrans le
12 novembre 2026 avant commit et PR. Salam relit le diff et les contrats.

Ce dossier réunit la [galerie](index.html), les captures des vrais composants
Web et les [mesures du parcours](mesures.json). Les situations sont entièrement
fictives et ne prouvent aucun transfert ni essai sur téléphone Android.

| Avant                                                             | Après                                                                                      | Pourquoi                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Aucun accès au retrait.                                           | Entrée séparée sous les trois actions principales de l’accueil.                            | Rendre le retrait trouvable en conservant la hiérarchie de l’accueil.         |
| Des icônes génériques identifient les choix.                      | Logos locaux Wave et Orange Money à deux flèches, accompagnés de leur nom.                 | Identifier l’opérateur sans dépendre d’un téléchargement pendant le parcours. |
| Les frais et l’effet de la confirmation ne sont pas consultables. | Montant destiné, frais fictifs, total et opérateur sont relus avant une action explicite.  | Permettre de corriger avant la soumission.                                    |
| Une panne pourrait pousser à recommencer.                         | La même demande garde sa référence et sa reprise ; l’incertitude ne devient pas un succès. | Éviter un second retrait et conserver une action compréhensible.              |

## Revoir le parcours

Depuis la racine : `npm run start --workspace @teranga-pay/mobile -- --lan --web`.
Choisir « Découvrir le projet », « Essayer l’accueil fictif », puis « Retirer en
cash ». L’atelier sous le formulaire change de situation. Préparer un prix ne
soumet rien ; « Confirmer le retrait simulé » est nécessaire pour continuer.

Les captures couvrent opérateurs, saisie, récapitulatif, succès et référence,
attente, réponse perdue, reprise de la même référence, refus, montant ou solde
insuffisant, prix absent/expiré et journal indisponible. Les largeurs 390, 360 et
320 pixels et une fenêtre de 360 × 460 examinent l’espace disponible. Cette
fenêtre réduite ne reproduit pas un clavier Android.

Les logos et leur provenance sont décrits dans
[assets/operators](../../../assets/operators/README.md). Aucun dessin ou couleur
n’est recréé pour Orange Money : seul le cadre de son pictogramme est affiché,
avec les flèches orange et noire.

## Preuves et limites

Les 27 captures inspectées ne présentent ni débordement horizontal ni erreur
console détecté. Les actions fixes restent visibles et mesurent au moins
48 pixels. Les six contrôles du dépôt passent : 919 tests mobiles, 114 tests
d’outillage réussis et un cas de lien symbolique ignoré sur Windows, format,
lint, types, 113 documents aux liens valides et 57 fichiers mobiles sans texte
visible en dur. Gitleaks ne détecte aucune fuite dans les sources mobiles.
La [preuve HTTP locale](integration.json) retrouve la même demande après
redémarrage de clients et serveurs distincts, avec une seule ligne de retrait
et un seul crédit fictif. Elle emploie un journal fichier acquitté avec fsync,
pas un appareil Android.
Commande ciblée :
`npm test -- --ci --runTestsByPath tests/withdraw-model.test.ts tests/withdraw-journal.test.ts tests/withdraw-preview.test.ts tests/withdraw-screen.test.tsx tests/navigation.test.tsx`.

Le test de grand texte à 320 pixels et facteur 2 ne remplace pas le réglage
système sur téléphone. TalkBack, clavier, retour matériel et reprise physique
restent à observer. Le fournisseur authentifié, son scope de journal et son accès
au serveur loopback restent à composer ; l’entrée normale ne les invente pas.
Lire le [suivi T25](../../planning/suivi-t25.md) et
l’[ADR 0019](../../decisions/0019-retrait-simule-et-reprise.md).

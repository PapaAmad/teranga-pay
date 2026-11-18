# Validation visuelle | T28

Ce dossier présente les états de réseau, de délai et de reprise des six parcours
essentiels, avec leurs vrais composants rendus sur le Web et des fournisseurs
fictifs isolés. Aucun paiement réel n’est exécuté. Ouvrir la
[galerie des 16 captures](index.html) et les [mesures](mesures.json).

Les captures couvrent les lectures lentes dans Accueil, Recevoir, Envoyer,
Encaisser, Historique et Retirer. Elles montrent les données précédentes,
les créations et confirmations incertaines, les réponses originales tardives,
la possibilité de revenir au portefeuille et une largeur de 320 pixels.
Une fenêtre de 360 × 460 vérifie un espace réduit, sans simuler le clavier Android.

Le parcours ne détecte aucune erreur console ni débordement horizontal. Les
actions fixes mesurées restent visibles et gardent au moins 48 pixels de hauteur.
Les tests de composants vérifient également qu’une page d’historique ayant dépassé
le délai reprend le même curseur, et qu’une confirmation lente ne propose pas de
nouvelle opération. Les tests de modèle couvrent les acquittements tardifs du
journal, le verrouillage, la suspension et la destruction de l’écran.

Le contrôle mobile complet passe : 1 112 tests dans 35 suites, dont 66 nouveaux
cas T28. Les captures du fournisseur fictif ne constituent pas une mesure du
transport natif, d’un serveur déployé ou d’une connexion physique interrompue.

PAN a confirmé les nouveaux écrans le 12 novembre 2026 avant commit ou PR T28.
La relecture de Salam reste distincte. Les captures
ne constituent ni un essai sur téléphone Android, ni une observation TalkBack,
ni une mesure du clavier réel ou de la composition du wallet natif.

Commande utile : `npm test -- --ci` depuis la racine.

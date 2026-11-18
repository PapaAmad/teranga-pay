# Validation visuelle | T27

Ce dossier rassemble le rendu Web des vrais composants Envoyer et Alerte T27,
avec des réponses fictives isolées et sans paiement réel. PAN a confirmé les
nouveaux écrans le 12 novembre 2026 avant commit ou PR. Salam assure ensuite la
relecture humaine, distincte de cette validation visuelle.

Ouvrir la [galerie des 15 captures](index.html), le [relevé de mesures](mesures.json)
et la [preuve HTTP T26](integration.json). Les captures couvrent le récapitulatif,
les motifs, le PIN après décision, l’analyse indisponible, son réessai, le délai
dépassé et le retour après annulation, aux largeurs de 390, 320 et 360 pixels.
Le parcours n’a détecté ni erreur console ni débordement horizontal. Les actions
fixes mesurées restent dans le cadre et gardent au moins 48 pixels de hauteur.
Une fenêtre de 360 × 460 vérifie un espace réduit, sans simuler une mesure Android.

Le contrôle HTTP utilise le vrai contrôleur et le port mobile T27 contre la vraie
route T26 de la PR #57, commit `fe055c5e3dba9a4f31eba0cf3385d117105c2feb`,
sur loopback. Quatre cas passent : score 30 sans confirmation supplémentaire,
score 50 avec confirmation, score 95 avec plusieurs motifs, puis serveur arrêté.
Chaque cas conserve zéro appel wallet avant l’appui final, puis exactement un
appel fictif après PIN et décision applicable. Les empreintes des sources mobiles
testées figurent dans le relevé. Aucun secret, wallet réel ni transfert Lightning
n’est utilisé.

Les tests mobiles couvrent également la grande police, le repli français depuis
le catalogue wolof vide, les réponses tardives et deux écrans du même wallet.
Les captures Web ne prouvent ni un essai sur téléphone Android, ni une vérification
TalkBack, ni la composition du wallet natif et du transport authentifié.

Commande utile depuis la racine : `npm test -- --ci`.

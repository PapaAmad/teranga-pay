# Suivi T27 | Alerte avant envoi

12 novembre 2026 | PAN | issue [#22](https://github.com/PapaAmad/teranga-pay/issues/22).

La branche `feat/T27-confirmation-alerte` part du dernier socle mobile T25,
`af8714d0c099cc27b7c445a4f2ded0692a4241de` (PR #78 ouverte). Elle ne prétend pas
que cette pile a été fusionnée dans `main`. T20 et T26 restent les dépendances du
plan ; les règles serveur sont relues sur la PR #57 de Salam, commit
`fe055c5e3dba9a4f31eba0cf3385d117105c2feb`.

## Périmètre

- Préparer un corps numérique sans identité, valider le contrat T26 et traduire
  ses sept motifs dans le contexte T09.
- Présenter l’alerte avant le PIN et permettre une annulation sans remise d’envoi.
- Distinguer l’indisponibilité de l’analyse, avec reprise explicite ou continuation
  volontaire sans analyse ; conserver les garde-fous T20.
- Fournir l’atelier fictif, les captures et les tests de logique et de composants.

Le transport authentifié, la composition du wallet natif et les essais réels
Android restent à faire avec Salam. Aucun nouveau service ni dépendance de
production n’est ajouté. Le cash-out reste celui de T25, explicitement simulé.

## État de validation

PAN a confirmé les écrans T27 le 12 novembre 2026 avant tout commit ou PR.
La publication est en préparation ; le Project privé #3 place encore l’issue #22
« En cours ». La relecture de Salam et la CI du commit publié restent à vérifier.

Le contrôle mobile complet passe : 1 046 tests dans 30 suites. T27 ajoute
78 cas de validation du contrat numérique et 48 cas de contrôleur/interface.
Un cas supplémentaire vérifie le devis fictif T20 lorsque l’horloge avance :
sa création et son expiration dérivent désormais d’une seule lecture d’horloge.
Les 114 tests d’outillage passent avec un cas de lien symbolique ignoré sur
Windows. Les 15 captures Web ne présentent ni erreur console ni débordement
horizontal détectés ; elles ne remplacent pas des essais Android ou TalkBack.

La vraie route T26 a passé ses 9 tests dans 2 suites depuis une copie exacte de
la PR #57, complétée avec les fichiers de support de sa base T13. La
[revue publiée](https://github.com/PapaAmad/teranga-pay/pull/57#pullrequestreview-5874359914)
consigne le contrat et les limites, sans remplacer une approbation humaine.
Une preuve HTTP locale relie le vrai contrôleur mobile à cette route : quatre
parcours passent, sans remise wallet avant le PIN et l’appui final. Le wallet
reste fictif ; l’arrêt du serveur exige une décision explicite de continuation.

L’auto-review a identifié puis corrigé une concurrence : une analyse tardive
pouvait masquer le résultat d’un envoi commencé sur un autre écran du même
wallet. Sept tests vérifient les réponses ou erreurs tardives et la lecture
d’historique encore en cours ; l’état du paiement et la barrière sont conservés.

Les six commandes requises passent : `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm test -- --ci`, `npm run test:tooling` et
`npm run repo:check`. Le contrôle structurel vérifie 119 documents et 60 fichiers
mobiles sans texte visible en dur. Un scan Gitleaks de la copie des fichiers
suivis et non suivis non ignorés ne détecte aucun secret ; les caches locaux
ne font pas partie du livrable. Aucun changement de dépendance ou de lockfile.

Expo reste actif en SDK 58 : le manifeste Android et le paquet JavaScript sont
servis en HTTP 200. Cette vérification de livraison du paquet ne prouve pas son
exécution sur un appareil physique. L’atelier Envoyer propose « Alerte à confirmer »,
« Plusieurs points à vérifier », « Analyse indisponible » et « Analyse lente ».

Voir [recherche](../design/alerte-recherche.md),
[direction](../design/alerte-direction.md),
[décision 0020](../decisions/0020-alerte-et-consentement.md) et
[validation visuelle](../design/validation-t27/README.md).

# Validation visuelle T18 | Recevoir confirmé par PAN

Projet de Salam et PAN. PAN porte les écrans ; Salam relit le wallet et le service
d’adresse T19. **PAN a confirmé les écrans le 9 novembre 2026 avant commit et PR T18.**
Ouvrir la [galerie](index.html), ou le [rendu nominal](02-recevoir.png).

Les 18 captures du 9 novembre 2026 montrent les vrais composants React Native
rendus avec React Native Web dans Edge sans fenêtre visible. Elles couvrent
l’adresse disponible, la copie, l’aide, le partage, leurs erreurs, le chargement,
le mode hors connexion, l’absence de service, le portefeuille verrouillé et
les largeurs 390, 360 et 320 pixels. Les états sont commandés depuis l’atelier
de développement, signalé par un bandeau permanent d’adresse fictive.

Les [mesures du parcours](mesures.json) vérifient l’absence de débordement
horizontal et d’erreur de console. Les deux boutons de 60 pixels de hauteur
sont visibles sans défilement à 390 × 844 ; ils restent atteignables en défilant
sur l’écran étroit. L’adresse longue est intégrale et conserve son libellé
accessible ; les retours visuels ne sont pas copiés.

| Before                                                               | After                                                                           | Why                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Recevoir ouvrait une explication de disponibilité sur l’accueil T16. | Un écran dédié affiche le QR, l’adresse, la copie et le partage.                | Réaliser le parcours T18 avec une destination lisible et des actions précises. |
| Le QR pouvait être traité comme un élément décoratif.                | Modules noirs sur blanc, marge vide de quatre modules, aucun logo superposé.    | Préserver la lecture de la donnée encodée.                                     |
| Une copie ou un partage pourrait être pris pour une réception.       | Retours distincts pour copie, options de partage, annulation et erreur.         | Décrire uniquement le résultat connu de chaque action.                         |
| Une adresse longue peut être tronquée sur un petit écran.            | La destination revient à la ligne ; copie et QR gardent la valeur ASCII exacte. | Permettre la lecture et la transmission sans perdre de caractères.             |

Un décodeur indépendant, **jsQR 1.4.0**, a lu le bitmap du QR réellement rendu :
231 pixels pour l’exemple nominal et 212 pixels pour l’adresse longue à 320.
Les deux résultats correspondent exactement à l’adresse attendue. La marge
est de quatre modules ; les modules occupent respectivement 7 et 4 pixels.
Ce résultat ne constitue pas un scan de téléphone à téléphone.

Le presse-papiers réel du navigateur de test a été relu après les copies
nominale et longue. Les chaînes sont exactes, sans caractère invisible de
présentation. Le partage nominal a été intercepté uniquement en mémoire,
avec le texte d’avertissement fictif. L’annulation et l’indisponibilité sont
simulées par l’atelier. Aucun partage externe, portefeuille ou paiement
n’a été exécuté. Une adresse sous `.example` ne peut pas recevoir d’argent.

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092`. Choisir « Découvrir le projet »,
« Essayer l’accueil fictif », puis « Recevoir ». Les dix scénarios se trouvent
en bas de l’écran. L’absence de service est également examinée par cet atelier ;
elle n’est pas une capture d’un wallet natif branché.

Les contrôles locaux comprennent **340 tests mobiles réussis** ; les outils
comptent 112 cas réussis et un cas ignoré sous Windows. Le grand texte et le
cycle de vie sont couverts par des tests de composants, sans mesure du rendu
Android. Les scans physiques, TalkBack, le presse-papiers Android, la feuille
native de partage et la résolution LNURL réelle restent à vérifier avec Salam.
Consulter la [recherche](../recevoir-recherche.md), la
[direction](../recevoir-direction.md) et le [suivi T18](../../planning/suivi-t18.md).

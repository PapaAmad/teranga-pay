# Validation visuelle T20 | Envoyer confirmé par PAN

Projet de Salam et PAN. PAN porte les écrans ; Salam porte l’envoi T21 et relit.
**PAN a confirmé les nouveaux écrans T20 le 10 novembre 2026 avant commit et PR
et autorisé la publication.** La proposition est prête à publier ; la relecture
de Salam et la CI distante restent attendues.
Ouvrir la [galerie](index.html), la [destination](01-destination.png) ou le
[récapitulatif](03-verification.png).

Les 24 captures du 10 novembre 2026 montrent les vrais composants React Native
rendus avec React Native Web dans Edge sans fenêtre visible. Les adresses sous
`.example`, la chaîne de demande non payable et les résultats viennent de
l’atelier explicitement fictif. Aucun wallet natif, compte ou paiement réel
n’est créé par ce parcours.

Les [mesures](mesures.json) couvrent 390, 360 et 320 pixels, les débordements
horizontaux et les erreurs de console. **Scanner et Coller occupent chacun une
seule ligne et mesurent tous les deux 60 pixels de hauteur** à ces trois largeurs.
Le texte agrandi est traité par les tests de composants, où les actions peuvent
s’empiler pour garder leurs libellés complets ; aucune troncature forcée ne sert
à maintenir une fausse symétrie.

| Before                                                               | After                                                                                         | Why                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| « Scanner un QR » occupait deux lignes à côté de Coller.             | « Scanner » et Coller gardent une ligne et la même hauteur.                                   | Respecter la symétrie demandée par PAN ; l’aide accessible précise le QR.       |
| Envoyer ouvrait une explication de disponibilité.                    | Destination, montant éventuel, frais, PIN et résultat ont leurs étapes.                       | Permettre de vérifier et corriger avant l’autorisation.                         |
| Un montant hors limite bloquait le bouton sans aide immédiate.       | Une erreur traduite apparaît près du champ et disparaît après correction.                     | Expliquer le blocage sans déclencher de devis ni de paiement.                   |
| Le défilement automatique vers le code fermait sa saisie sur le Web. | Le champ conserve son focus sur le Web ; le glissement natif garde son comportement distinct. | Permettre de saisir les six chiffres même après changement de scénario.         |
| Un délai dépassé pourrait être confondu avec un échec certain.       | L’issue inconnue conserve une barrière et aucun renvoi n’est proposé.                         | Éviter de créer une deuxième opération lorsque la première peut encore aboutir. |

Le parcours automatisé a réellement collé une demande depuis le presse-papiers
du navigateur. Il a saisi six chiffres fictifs sans envoi automatique, puis
utilisé la confirmation explicite. Une attente reste en attente après sa
relecture ; un timeout sans identifiant ne propose ni renvoi ni rapprochement
inventé. Ces résultats sont commandés par un simulateur sans réseau, jamais
présentés comme des paiements natifs exécutés.

Le bandeau d’action reste hors du défilement. La capture d’espace réduit montre
le champ atteint par défilement et le bouton dans une fenêtre Web de 360 × 460.
**Elle ne montre pas un clavier Android.** Les tests vérifient la structure du
cadre, les marges de sécurité et les événements clavier simulés. Le clavier
physique, la caméra, TalkBack, Retour Android et la reprise sur téléphone restent
à vérifier sur appareil.

Les 487 tests mobiles comprennent les validations de données externes, devis
expiré, frais inconnus, code refusé, doubles appuis, deux contrôleurs, remontage,
réponses tardives et permissions caméra. Les outils comptent 112 réussites et un
cas de lien symbolique ignoré sous Windows. L’introspection Expo confirme la
permission caméra et l’absence de microphone/audio demandée par le plugin ;
l’export Android JavaScript de diagnostic réussit sans bytecode, sans constituer
une compilation Hermes ni une installation d’APK.

La [review de T21](https://github.com/PapaAmad/teranga-pay/pull/64#pullrequestreview-5834840718)
signale deux risques de doublon à corriger avec Salam. La barrière de l’écran
survit au remontage pendant la session, pas à l’arrêt du processus. Le contexte
normal indique l’absence de composition native ; l’atelier ne la remplace pas.

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092`. Choisir « Découvrir le projet »,
« Essayer l’accueil fictif », puis « Envoyer ». Les scénarios se trouvent
en bas du contenu. Consulter la [recherche](../envoyer-recherche.md), la
[direction](../envoyer-direction.md), le [suivi](../../planning/suivi-t20.md) et
l’[ADR 0015](../../decisions/0015-envoyer-confirmation-et-session.md).

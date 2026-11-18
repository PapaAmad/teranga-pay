# Envoyer T20 | Direction artistique et parcours

Proposition du 9 novembre 2026 pour le projet de Salam et PAN, confirmée visuellement le 10 novembre. PAN porte T20 ; Salam fournit T21 et relit. Cette direction prolonge la [charte T08](charte.md), l’[accueil T16](accueil-direction.md), [Recevoir T18](recevoir-direction.md) et la [recherche T20](envoyer-recherche.md). **PAN a confirmé les nouveaux écrans T20 le 10 novembre 2026 avant commit et PR et autorisé la publication.** La relecture de Salam et la CI distante restent attendues.

## Intention | Savoir à qui et combien

Le parcours privilégie une donnée par niveau : destination, montant, coût total, puis autorisation. Le fond papier, les cartes blanches, le marine et l’accent citron assurent la continuité avec Recevoir. Manrope porte titres et montants ; Noto Sans porte libellés, aides et états. Le citron souligne une action explicite. Les messages d’erreur ou d’attente gardent leurs mots et leurs pictogrammes, sans dépendre de leur couleur.

Le titre d’écran et le retour restent prévisibles. Les données utiles sont reprises à l’étape où elles servent : le PIN ne présente pas seulement six points privés de contexte. Les icônes Scanner, Envoyer, Copier, Retour et les signes d’état proviennent de la collection originale T08. Aucun nouveau paquet d’icônes, visuel décoratif ou mouvement de célébration n’est nécessaire pour décider d’un paiement.

## Parcours proposé

| Étape                 | Contenu dominant                                                                                                             | Action principale et limite                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Destination           | Scanner un QR ou saisir/coller une demande ou adresse Lightning, avec étiquette persistante.                                 | Continuer fait seulement lire et vérifier la destination. Le collage est déclenché volontairement.                       |
| Scanner               | Vue caméra, cadre de lecture sans animation de balayage obligatoire et courte instruction.                                   | Autoriser la caméra si nécessaire ; Coller reste accessible. Une détection suspend la caméra avant vérification.         |
| Montant si nécessaire | Grand champ FCFA, destination rappelée et conversion secondaire si disponible.                                               | Continuer prépare le récapitulatif. Une demande déjà chiffrée garde son montant fourni ; aucun champ de montant inutile. |
| Vérifier              | Destination lisible, montant FCFA et sats, frais explicitement estimés ou plafonnés, total correspondant et validité connue. | Confirmer conduit au PIN, sans envoi à ce stade. Modifier permet de revenir avant autorisation.                          |
| Autoriser             | Montant et destination rappelés, champ PIN natif masqué à six chiffres, erreur compréhensible si refus.                      | Une commande explicite autorise l’opération affichée. Saisir le sixième chiffre ne soumet pas seul.                      |
| Suivre                | État connu de l’opération, montant et référence disponible.                                                                  | Vérifier la même opération ou revenir selon le résultat ; aucune nouvelle soumission sous couvert de rafraîchissement.   |

Une adresse ou une demande longue revient à la ligne et garde une valeur accessible intégrale. Le texte ne s’invente pas un nom de personne à partir d’un identifiant technique. Une description fournie par la demande reste une information de son auteur, pas une identité certifiée. Les informations secondaires peuvent être dépliées ; destination, montant et coûts nécessaires à la confirmation restent directement consultables.

Le récapitulatif n’affiche pas « gratuit » faute de frais connus. Lorsqu’un plafond applicable est fourni, « Frais au maximum » et « Total au maximum » rendent le contrat visible ; les frais réellement confirmés appartiennent au résultat. Une expiration du devis ou de la demande interrompt l’autorisation et demande une nouvelle vérification. Une nouvelle destination ou un nouveau montant invalide l’ancienne préparation et l’ancienne autorisation.

## États à examiner

| Situation                                                  | Présentation attendue                                                                         | Action utile                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sans service natif                                         | Explication simple, sans destination, devis ni montant fabriqué.                              | Revenir ; atelier fictif uniquement dans le parcours de développement.                                                |
| Demande invalide ou non prise en charge                    | Erreur liée au champ, contenu conservé si la session le permet.                               | Modifier, coller une autre demande ou scanner à nouveau.                                                              |
| Caméra refusée ou indisponible                             | Pourquoi le scan est indisponible et possibilité de continuer.                                | Coller ; réglages si le système ne permet plus une nouvelle demande de permission.                                    |
| Lecture ou préparation en cours                            | Indication textuelle et activité discrète, action protégée des appuis répétés.                | Attendre ou revenir avant soumission ; aucune réussite anticipée.                                                     |
| Fonds insuffisants, demande expirée ou frais indisponibles | Cause connue formulée sans erreur technique brute.                                            | Corriger ce qui peut l’être ou obtenir une nouvelle demande.                                                          |
| PIN refusé ou accès fermé                                  | Erreur locale sans révéler le code ni prétendre contourner T15.                               | Corriger dans les limites du service ou revenir ; fermeture purge le PIN.                                             |
| Soumission en cours                                        | « Envoi en cours », montant et destination ; nouvelle soumission bloquée.                     | Attendre l’état du service. Quitter l’écran ne promet pas d’annuler un paiement déjà parti.                           |
| Paiement en attente                                        | État d’attente connu, distinct d’une réussite.                                                | Vérifier la même opération.                                                                                           |
| Résultat incertain                                         | Explication qu’une vérification reste nécessaire ; aucune affirmation sur l’absence de débit. | Vérifier seulement avec une référence et un contrat adaptés ; sinon expliquer la limite, sans bouton Payer à nouveau. |
| Échec confirmé                                             | Échec connu, cause utile et état des fonds uniquement s’il est confirmé.                      | Corriger ou préparer un nouvel envoi seulement si le service l’autorise.                                              |
| Réussite confirmée                                         | Confirmation sobre, montant et frais connus.                                                  | Revenir à l’accueil ; le reçu détaillé relève de T24.                                                                 |
| Atelier de développement                                   | Bandeau permanent : données et opérations fictives.                                           | Examiner les étapes et résultats contrôlés sans fonds ni PIN réel.                                                    |

Les rafraîchissements ne rejouent pas une soumission. Les réponses d’une ancienne demande, d’une session fermée ou d’un écran devenu inactif ne réactivent pas une confirmation obsolète. Un événement ne devient un succès que si son état et son rattachement à l’opération sont établis par le contrat.

Le `TIMEOUT` T21 consulté ne fournit aucun identifiant d’opération. Ce cas reste bloqué pour un nouvel envoi dans la session ; la réconciliation native demande une évolution du contrat avec Salam. Une attente munie d’un identifiant peut, elle, être relue sans soumettre à nouveau. La galerie doit rendre cette différence visible au lieu de promettre une vérification impossible.

## Formulaires | Bouton au-dessus du clavier

Le contenu défile dans la zone centrale. Le bandeau inférieur contenant l’action reste hors de ce défilement, dans le cadre qui réagit au clavier, avec les marges de sécurité. Le bouton ne flotte pas par-dessus une erreur ou le dernier champ. L’appui direct fonctionne pendant la saisie ; le clavier ne demande pas une première pression uniquement pour se fermer.

Les cibles visent 48 × 48 dp au minimum et peuvent grandir avec le texte. Le grand texte conserve les libellés entiers, empile les données si nécessaire et ne tronque ni le coût total ni la destination. Vérifier 320, 360 et 390 pixels, un agrandissement de texte de 2 et le clavier ouvert sur Android. Les captures Web peuvent contrôler le cadre et le défilement ; elles ne prouvent pas la géométrie du clavier natif.

## Vérifications et confirmation visuelle

La [galerie de 24 captures](validation-t20/README.md) présente le parcours réel et ses états avec des données neutres signalées. PAN a confirmé ces écrans le 10 novembre avant commit et PR. Les mesures ne relèvent ni débordement horizontal ni erreur de console ; Scanner et Coller restent sur une ligne et de hauteur identique, 60 pixels, aux largeurs 390, 360 et 320 pixels. Les tests vérifient les effets utiles : collage refusé, permission refusée, détections rapprochées, demande expirée, montant invalide, devis périmé, PIN refusé, doubles appuis, perte de focus et résultat incertain. Les six contrôles locaux du dépôt passent ; les preuves sont consignées dans le [suivi](../planning/suivi-t20.md).

Les essais sur appareil doivent encore couvrir caméra, clavier, bouton Retour Android, TalkBack et reprise depuis l’arrière-plan. Le parcours normal n’utilise aucun adaptateur fictif par défaut. T20 ne remplace pas le décodeur T21, le coffre T15, le service T19 ni l’historique T24. Une preuve de rendu ou une autorisation visuelle de PAN ne remplace pas la relecture de Salam et la CI avant fusion.

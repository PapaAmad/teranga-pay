# Encaisser T22 | Direction artistique et états

Direction du 10 novembre 2026 pour le projet de Salam et PAN. PAN porte les écrans ; Salam fournit les services et relit. Cette direction prolonge la [charte T08](charte.md), [Recevoir T18](recevoir-direction.md), [Envoyer T20](envoyer-direction.md) et la [recherche T22](encaisser-recherche.md). **PAN a confirmé les nouveaux écrans T22 le 10 novembre 2026 avant commit et PR et autorisé leur publication.** La publication est en préparation ; cette confirmation ne remplace pas la relecture de Salam ni la CI distante.

## Intention | Un prix, une demande, un règlement

Encaisser doit pouvoir être présenté au client sans montrer le solde personnel du commerçant. L’écran met en avant le prix de la vente puis le code à scanner. Le fond papier et les cartes blanches gardent la lecture calme ; le marine porte les titres et le citron l’action utile. Manrope souligne le montant, Noto Sans porte les explications et les statuts. Les mots et les icônes T08 complètent les couleurs d’état.

Aucune nouvelle illustration ni collection d’icônes ne sont nécessaires. Le monogramme entre T et P reste hors du QR. Les cibles visent au moins 48 × 48 dp, les libellés restent complets et le texte respecte l’agrandissement système. Si l’espace manque, les commandes s’empilent au lieu d’être tronquées.

## Parcours proposé

| Étape       | Contenu principal                                                                         | Action et limite                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Montant     | Titre Encaisser, grand champ FCFA avec étiquette persistante et erreur proche.            | Créer la demande après validation ; aucune facture pendant chaque frappe.            |
| Préparation | Lecture du devis puis création et contrôle de la demande correspondante.                  | Indication d’activité et texte simple ; appels répétés protégés, sans faux QR.       |
| Présenter   | Montant FCFA fixé, QR sombre sur blanc, sats secondaires, durée restante et heure limite. | Montrer, copier ou partager exactement cette demande. Le solde du wallet est absent. |
| Attendre    | État « En attente du paiement » et explication de ce qui sera confirmé.                   | Vérifier la même opération ; un appui ne crée pas une autre facture.                 |
| Confirmer   | État Payé après règlement réellement rattaché à cette demande.                            | Voir un récapitulatif simple puis préparer une autre vente par une action explicite. |

Le champ de montant et ses messages défilent dans le cadre T20. Son bouton reste hors de ce défilement, dans la zone adaptée au clavier et aux marges de sécurité. Le prix saisi ne disparaît pas à cause d’un échec de lecture récupérable. Les chiffres, l’unité FCFA et les erreurs restent consultables à 320 pixels et avec le texte agrandi.

La préparation fournit une unique demande active : devis, montant sats, facture, référence de suivi et échéances doivent se correspondre. Une modification invalide l’ancienne préparation avant de créer la suivante. Une demande déjà exposée ou d’issue incertaine ne devient pas « annulée » parce que l’utilisateur change d’écran. L’interface suit les possibilités réelles du port pour interrompre, relire ou renouveler.

## Composition du code et des actions

Le QR prend la place principale sur une surface blanche avec quatre modules de marge sur chaque côté. Il reste immobile ; ni logo, ni animation de balayage, ni mot ne traverse ses modules. Le prix demandé est au-dessus du code, la durée et le statut en dessous. La phrase d’aide explique que le client scanne avec son portefeuille Lightning et confirme sur son téléphone.

Copier et Partager sont des alternatives au scan. La demande complète est consultable dans un détail accessible ; la valeur copiée ou partagée demeure exacte, sans ellipse ou coupure invisible ajoutée. Une réussite de copie ou l’ouverture du partage garde un retour local et ne remplace jamais l’état d’attente par Payé. Un ancien callback est invalidé quand la demande change, expire ou cesse d’être autorisée par la session.

La lisibilité d’une facture longue doit être contrôlée indépendamment de l’adresse courte T18. Le QR est dimensionné sur sa vraie matrice ; l’interface ne prétend pas rendre tous les codes lisibles dans une petite taille arbitraire. Une erreur d’encodage ou une charge trop dense produit une explication et garde une alternative valable selon le contrat.

## Temps et réseau

Le prix est figé cinq minutes selon le devis T17. L’affichage cesse d’offrir l’ancienne demande au premier terme applicable, devis ou facture. Le compte à rebours reste consultable, sans région d’annonce répétée chaque seconde. Une zone d’état séparée annonce les changements importants. L’heure limite rend le terme compréhensible même si le compteur n’est pas suivi continuellement.

L’expiration propose une nouvelle vérification volontaire, jamais un renouvellement silencieux. S’il est impossible d’établir l’issue de l’ancienne demande, le texte le dit avant de proposer une autre demande payable. Le montant FCFA peut rester saisi ; les nouveaux sats et le nouveau terme doivent être montrés. Après reprise depuis l’arrière-plan, le temps est recalculé depuis l’échéance réelle.

Hors connexion, ne pas afficher un statut optimiste. Une demande déjà autorisée peut rester visible uniquement si le contrat et sa validité le permettent, avec sa limite explicite ; aucune nouvelle demande ou confirmation n’est inventée. Une relecture échouée conserve l’état connu sans affirmer que le client n’a pas payé. Le retour du réseau déclenche une vérification de la même référence, pas un nouvel encaissement automatique.

## États à examiner

| Situation                              | Présentation attendue                                                        | Suite utile                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Service absent ou accès fermé          | Aucun devis, QR ou reçu fabriqué.                                            | Expliquer, revenir ou ouvrir le wallet selon le contexte.                              |
| Montant vide ou invalide               | Étiquette persistante ; erreur visible si la valeur saisie est invalide.     | Corriger sans appel de création.                                                       |
| Préparation en cours                   | Indication d’activité et action protégée des répétitions.                    | Attendre sans faire disparaître le prix demandé.                                       |
| Devis ou facture refusés               | Explication locale ; aucune demande ambiguë présentée.                       | Réessayer la préparation seulement si aucun résultat précédent ne rend cela incertain. |
| Demande valable                        | Prix, QR, terme et attente clairement liés.                                  | Montrer, copier, partager ou vérifier le règlement.                                    |
| Connexion faible ou lecture impossible | Dernier état connu et limite textuelle, sans confirmation inventée.          | Relire la même opération.                                                              |
| Demande expirée                        | QR et actions de paiement retirés ; montant connu conservé selon la session. | Vérifier l’issue puis préparer une nouvelle demande si le contrat l’autorise.          |
| Règlement incertain                    | État à vérifier, sans Payé ni affirmation d’absence de paiement.             | Réconcilier par la référence, sans se fier au seul montant.                            |
| Paiement confirmé correspondant        | Payé, montant de la vente et reçu simple avec données confirmées.            | Consulter le récapitulatif ou commencer une nouvelle vente.                            |
| Autre paiement reçu                    | Aucun remplacement du statut de cette vente.                                 | Garder le suivi de sa propre demande ; l’historique détaillé relève de T24.            |
| Atelier fictif                         | Bandeau permanent et résultat explicitement simulé.                          | Examiner les états sans réseau, clé ni argent réel.                                    |

Le reçu simple rappelle montant FCFA figé, sats, état confirmé et référence. Sa date « Vérifié le » correspond à `confirmedAt`, instant où T22 observe une preuve cohérente. Elle ne déduit pas la date effective du règlement de `Payment.createdAt`. Une observation après l’échéance est présentée comme « Confirmation après le délai ». Le reçu ne calcule pas un nouveau prix depuis le taux courant et ne transforme pas un événement quelconque en preuve de cette vente. Il ne prétend ni certifier l’identité du client ni remplir les obligations d’une facture commerciale. Les fonctions détaillées de T24 ne sont pas anticipées.

## Validation à préparer

Présenter une galerie du parcours réel et des erreurs aux largeurs 390, 360 et 320 pixels. Vérifier le grand texte, les cibles, les données complètes et le cadre du clavier. Les tests doivent exercer préparation unique, montant corrigible, facture incohérente, copie exacte, partage annulé, callbacks obsolètes, expiration, reprise, paiement reçu non correspondant et confirmation après rattachement exact. Un compteur à zéro ne remplace aucun test du résultat financier.

Les captures Web et le décodage indépendant du QR ne prouvent ni le scan physique, ni TalkBack, ni le clavier Android ou l’intégration regtest. La [galerie](validation-t22/README.md) et le [suivi](../planning/suivi-t22.md) consignent les vérifications locales réellement obtenues et leurs limites. PAN a confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR. La relecture de Salam et une CI verte restent requises avant fusion.

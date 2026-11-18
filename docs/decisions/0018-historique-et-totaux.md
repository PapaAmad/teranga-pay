# 0018 | Historique, reçus et base des totaux du jour

- Date : 11 novembre 2026, Dakar.
- Tâche : [T24, issue #19](https://github.com/PapaAmad/teranga-pay/issues/19), PAN ; services et relecture Salam.
- État : écrans confirmés par PAN le 11 novembre 2026 avant commit et PR ; publication autorisée. La relecture humaine, la CI distante et l’intégration native restent distinctes.
- Base : `feat/T24-historique` part de T22 `0944dcb`, proposé dans la [PR #74](https://github.com/PapaAmad/teranga-pay/pull/74). Cette base d’interface ne déclare pas les services natifs intégrés.

## Problème

La conception, page 8, demande une liste et un reçu simple partageable. T24 ajoute le total du jour et dépend de T11, T22 et T23. Le wallet expose une date de création et peut ignorer le montant historique en FCFA. T22 conserve un prix marchand figé dans son propre contexte. T23 tient un journal fictif qui ne débite pas le wallet. Un cumul unique au taux actuel ou un reçu de réussite pour toute ligne donnerait donc une information trompeuse.

La [recherche](../design/historique-recherche.md), la [direction](../design/historique-direction.md) et le [suivi](../planning/suivi-t24.md) expliquent les choix et leurs preuves. Ce document fixe la convention locale sans attribuer au contrat de Salam des garanties qu’il ne fournit pas.

## Ports de lecture séparés

Les [ports T24](../../apps/mobile/src/history/ports.ts) utilisent `state`, `history` et `subscribe` du wallet T11. Ils ajoutent un port injecté de lecture du journal des retraits, dont la réponse contient `simulation: true`, `items` et `nextCursor`. Les données mobiles reprennent structurellement le DTO public ; le composant n’importe ni serveur, ni SQLite, ni clé d’accès.

La [PR T23 #75](https://github.com/PapaAmad/teranga-pay/pull/75) porte la passerelle et son API. La liste authentifiée `GET /v1/withdrawals` est publiée dans T23 au commit `c0b8b40975e623c685c1f48d1ba6968a23a21907`, séparément des écrans T24. Sa relecture humaine et la composition native restent distinctes. L’adaptateur natif doit composer cette lecture avec la session authentifiée ; l’interface ne place aucun jeton dans ses composants.

Sans fournisseur wallet, l’entrée normale explique l’indisponibilité. Un wallet déjà fourni à Home peut alimenter seul son journal ; l’absence du complément T23 reste alors explicite, sans retraits inventés. L’aperçu utilise des données fictives isolées, signalées visuellement et dans le partage. Il ne constitue ni une preuve de transaction native ni un transfert opérateur. T24 ne crée aucun paiement ou retrait et ne relance aucune écriture financière pour actualiser son journal.

Les identifiants de liste sont préfixés `wallet:` ou `bridge_sim:`. Deux références identiques de sources différentes restent deux éléments distincts ; elles ne prouvent aucune relation entre elles. Le reçu marchand T22 ne devient pas une ligne supplémentaire : une réception reste issue du seul historique wallet. L’association d’une vente à sa réception exige toujours le contrat de corrélation décrit dans l’[ADR 0016](0016-encaisser-demande-et-recu.md).

## Date et montants du jour

La convention est **jour de `createdAt` dans `Africa/Dakar`**. La carte indique « Opérations datées de ce jour | heure de Dakar ». Le fuseau du téléphone ne déplace pas une opération dans un autre groupe. Une opération créée hier et confirmée aujourd’hui appartient au jour d’hier selon cette convention. `createdAt` n’est pas rebaptisé date de règlement. Un futur cumul par règlement demanderait un champ fiable, une évolution de contrat avec Salam et une décision explicite.

Seuls les états `reussi` alimentent les cumuls. En attente, échoué et incertain restent consultables, sans devenir un montant confirmé. Trois ensembles restent séparés : reçus wallet, envoyés wallet hors frais et retraits simulés. Les filtres de la liste ne modifient pas la définition de la carte du jour. Aucun solde net n’est déduit du mélange de ces ensembles.

Les montants historiques sont ceux de la source. `amountXof: null` reste inconnu ; aucun taux courant ne le remplace. Le cumul distingue la somme des FCFA connus et le nombre de valeurs absentes ; il n’annonce pas la première comme un total intégral. Zéro n’est présenté que lorsque la lecture permet réellement de connaître un montant nul. L’absence de ligne dans une lecture partielle ne prouve pas l’absence d’opération.

Les frais wallet restent en sats tant que leur valeur FCFA historique manque. Les envois hors frais ne sont donc pas des débits complets en FCFA. Les frais et le total fictifs T23 sont présentés comme tels, sans les assimiler aux paiements wallet. Le prix figé du reçu T22 n’est pas injecté dans le journal par rapprochement sur le montant.

Les additions utilisent `BigInt` puis ne reviennent au type numérique que dans l’intervalle entier sûr. Un dépassement rend le montant concerné indisponible plutôt qu’arrondi. Cette exactitude arithmétique ne certifie pas le taux historique conservé par le fournisseur.

## Pagination, erreurs et interruption

Les sources sont lues indépendamment, par pages de vingt et dans une limite de mille éléments chacune. Les pages, dates, états, montants et curseurs sont validés ; les répétitions d’identifiants ou de curseurs invalident la pagination. Une suite de vingt paiements wallet exige une autre lecture pour confirmer sa fin, car ce contrat ne donne pas de curseur terminal explicite. Le journal T23 donne `nextCursor`.

Une couverture n’est complète que lorsque la source est parcourue jusqu’à sa fin. Page restante, erreur ou limite atteinte maintiennent un état partiel. Une source absente demeure indisponible ; elle n’est pas représentée par un journal vide confirmé. Les erreurs d’une source n’effacent pas les données connues de l’autre. Le réessai d’une page dont la lecture a échoué reprend la lecture, sans réémettre une opération financière.

Les dernières données disponibles peuvent rester consultables après une erreur ou hors connexion, avec un état ancien et une couverture partielle. T24 ne crée pas de cache disque : la persistance du wallet relève de son fournisseur, et le contrôleur garde seulement ses lectures en mémoire. Le journal des retraits ne sollicite pas le serveur quand le wallet indique l’absence de réseau. Le passage à un autre jour recalcule la carte et signale une lecture devenue ancienne.

Le verrouillage, l’absence de wallet et la suspension retirent les données de présentation et invalident les réponses tardives. La reprise relit les sources ; elle ne confirme pas une ligne par un ancien retour d’abonnement. Le détail sélectionné est relu dans la collection courante, sans conserver une copie de réussite devenue détachée de la source.

## Reçu et partage

Une réussite rapportée par la source ouvre un reçu ; les autres états ouvrent un détail explicitement sans confirmation de règlement. L’aperçu et la passerelle fictive conservent leur qualification de simulation, y compris pour une réussite. Un reçu n’est ni une facture fiscale ni une attestation de transfert réel Wave ou Orange Money.

Le partage volontaire contient contexte de source, type, état, montant disponible, sats, frais connus, date d’opération et référence. Note personnelle, facture Lightning, identité de personne et numéro privé restent exclus. Ouvrir les options, annuler et échouer sont des résultats distincts. Les gardes de sélection et de session empêchent un retour tardif d’annoncer le partage d’une autre opération. Aucun reçu ne fabrique une date de règlement ou une contre-valeur manquante.

## Solutions écartées et conséquences

Recalculer toutes les lignes au taux courant ferait varier le passé. Assimiler `createdAt` au règlement déplacerait abusivement la signification du total. Additionner retraits fictifs et paiements ferait croire à un débit wallet inexistant. Qualifier toute ligne de reçu masquerait l’attente et l’incertitude. Charger tout l’historique dans un contenu non virtualisé compliquerait la consultation sur téléphone modeste.

La convention retenue laisse visibles des valeurs inconnues et des totaux partiels. C’est une limite du contrat à conserver jusqu’à une évolution vérifiée avec Salam. La liste virtualisée et les dépendances déjà disponibles suffisent à T24 ; aucune nouvelle bibliothèque, infrastructure ou garde de clés n’est introduite. PAN a confirmé les nouveaux écrans le 11 novembre 2026 avant commit et PR ; son accord visuel ne remplace ni la relecture de Salam ni une CI verte avant fusion.

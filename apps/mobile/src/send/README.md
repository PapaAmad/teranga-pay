# Envoyer | T20

PAN porte le parcours de saisie, de vérification et de confirmation. Salam porte le contrat T11 et le paiement T21. `ports.ts` expose un sous-ensemble compatible de ces contrats et le devis FCFA T17 ; aucun SDK Lightning n'est ajouté ici.

`controller.ts` prépare une demande sans la payer, vérifie les données externes, fige le montant et le plafond de frais, puis exige un PIN de six chiffres et une confirmation explicite. Le PIN ne figure jamais dans un snapshot ni dans une écriture persistante. Le devis expire au plus tard après cinq minutes ; son délai et celui de la facture sont vérifiés immédiatement avant de remettre l'envoi au wallet.

Le devis T17 conserve le montant FCFA saisi et arrondit sa conversion au sat supérieur. Pour une facture fixe, le taux du solde lu au début du parcours fournit une estimation FCFA cohérente. Les frais maximum et le total maximum sont arrondis au FCFA supérieur depuis leurs montants exacts en sats ; le total n'est pas calculé en additionnant deux estimations déjà arrondies. Un montant ou des frais FCFA indisponibles empêchent l'accès au PIN. Le plafond exact en sats est transmis sans modification à T21 ; le résultat distingue ensuite les frais réellement payés.

Une barrière en mémoire est partagée par tous les écrans utilisant le même objet wallet. Elle est posée avant `send`, revérifiée après les lectures asynchrones et survit à la destruction de l'écran. Une erreur de délai, une exception ou un résultat incohérent conserve l'issue inconnue et interdit un nouvel envoi dans cette session. Seul un identifiant de paiement déjà connu peut être rapproché de l'historique ; une égalité de montant ne prouve rien. T21 ne renvoie pas encore d'identifiant avec `PAYMENT_TIMEOUT` : la réconciliation native reste donc une dépendance explicite avec Salam. Cette protection locale ne prétend pas remplacer l'idempotence native ni survivre à un arrêt du processus.

La composition native doit conserver le même objet wallet pendant la session. Après la remise de l'envoi, même `NETWORK_OFFLINE` est traité comme une issue inconnue : l'erreur peut provenir d'une lecture du résultat alors que le paiement a déjà commencé. Une coupure constatée avant cette remise ne paie rien. La temporisation `PIN_LOCKED` du wallet reste respectée après modification ou réouverture du parcours. Un refus de PIN reçu après destruction de l'écran libère la barrière et rétablit une préparation sûre dans le nouvel écran, avec la temporisation applicable.

Le passage en arrière-plan ou le verrouillage purge les données visibles. La barrière d'une opération déjà soumise subsiste en mémoire, sans conserver le PIN. Le mode normal reste `unavailable` tant que le wallet n'est pas branché.

`preview.ts` est un atelier sans réseau, sans clé et sans paiement réel. La chaîne de démonstration n'est pas une facture BOLT11 valide ; les adresses utilisent le domaine réservé `.example`. Les scénarios couvrent succès fictif, attente, résultat inconnu, refus, PIN incorrect, expiration, solde insuffisant, hors connexion, erreur de lecture, frais FCFA indisponibles et montant libre. Changer d'atelier utilise un nouveau wallet fictif ; cela n'efface aucune barrière d'un wallet natif.

T27 ajoute `SendServices.risk`, port numérique du serveur T26, avant l’accès au
PIN. La confirmation du destinataire lit au maximum 50 opérations puis l’analyse,
avec un délai global de huit secondes. Un avertissement exige un accord distinct ;
une analyse manquante ou invalide permet une reprise, une annulation ou une
continuation explicitement choisie sans analyse. Aucun résultat ne soumet d’envoi.
Les motifs, la demande et l’accord sont invalidés lors d’une modification,
annulation, suspension ou fermeture. Les réponses tardives sont ignorées.
Voir la [décision 0020](../../../../docs/decisions/0020-alerte-et-consentement.md).

L’atelier ajoute les situations d’alerte, d’analyse indisponible et d’analyse lente.
Ce sont des réponses fictives du contrat, sans calcul local du score. Le transport
authentifié et la composition native restent à relier avec Salam.

Commande utile depuis la racine : `npm test --workspace @teranga-pay/mobile -- --runTestsByPath tests/send-model.test.ts --ci`.

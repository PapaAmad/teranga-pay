# Encaisser | T22

PAN porte l'écran marchand et son orchestration ; Salam fournit le wallet et relit. `ports.ts` réutilise le devis FCFA T17 et précise le complément natif nécessaire : créer une facture liée à un identifiant exact, valable au plus jusqu'à la fin du devis, puis lire ce même identifiant. Aucun SDK ni code natif de Salam n'est ajouté ou modifié ici.

T11 ne relie actuellement pas `Invoice` à `Payment.id` ; T15 crée une facture valable une heure. Le port `CollectInvoicePort` n'est donc pas branché par défaut. T22 ne prétend ni déduire un identifiant du montant ni retirer sa validité réelle à une facture d'une heure en affichant un compteur de cinq minutes.

`controller.ts` distingue le devis préparé de la création explicite d'une demande. Le devis expire au plus tard après cinq minutes. La facture retournée doit respecter exactement le montant en sats, le montant FCFA demandé et la limite d'expiration du devis. Une erreur ou une réponse incohérente après l'appel de création garde une barrière inconnue en mémoire ; aucun réessai automatique ni nouvelle demande ne remplace cette incertitude.

La barrière, les factures connues et leurs identifiants sont partagés par objet wallet pendant la session. Un remontage d'écran conserve le suivi. Le QR est retiré lorsque son délai est écoulé ; le suivi du règlement reste actif. Une nouvelle demande après expiration est une action manuelle : l'ancienne identité est conservée parmi au plus vingt demandes encore à suivre. La limite bloque la création suivante plutôt que d'évincer une demande incertaine. Une confirmation ultérieure d'une ancienne demande rejoint les reçus précédents et ne marque jamais la demande courante comme payée. Les dix derniers reçus précédents restent consultables dans le snapshot ; ce mécanisme en mémoire ne remplace pas le stockage durable ni l'historique T24.

Les identifiants et factures déjà utilisés restent mémorisés pendant toute la session, même quand un reçu sort des dix dernières présentations. Ils ne peuvent pas valider une nouvelle vente. Une lecture retardée ne réécrit plus un reçu déjà confirmé par événement. La demande complète est consultable à la demande, y compris lorsque son QR est trop dense ; ses coupures visuelles ne modifient ni la valeur accessible ni la copie.

Le reçu courant exige un paiement entrant réussi, l'identifiant de cette facture exacte, le montant en sats attendu et aucun frais prélevé sur la réception. Son FCFA est le prix demandé dans le devis figé, jamais une contrevaleur historique inventée à partir du taux courant. `confirmedAt` est l'instant où T22 observe cette preuve : le contrat ne permet pas de transformer `Payment.createdAt` en date historique de règlement. `late` signifie donc « confirmation observée après le délai », y compris lorsqu'un paiement a pu se régler avant une interruption. Un solde modifié, un montant identique ou un paiement en attente ne prouvent pas le règlement. Un événement reçu pendant la création attend en mémoire, sans attribution, jusqu'à ce que l'identifiant exact soit connu ; une lecture de la même facture reste nécessaire pour les événements manqués.

Le verrouillage et le passage en arrière-plan effacent les données du snapshot et retirent les abonnements visibles. Ils n'annulent pas une facture ni un paiement et ne suppriment pas la barrière privée en mémoire. La reprise relit l'état et les demandes connues. Le processus natif devra conserver durablement ces liens et réconcilier une création dont la réponse a été perdue ; ce comportement n'est pas déclaré implémenté par T22.

`preview.ts` fournit un atelier sans réseau ni facture payable. `now`, `advanceTime` et `confirmPayment` permettent de vérifier explicitement attente, expiration, confirmation, règlement tardif et correspondance incorrecte, sans minuterie de faux succès. Les scénarios payés restent clairement fictifs.

Commande utile depuis la racine : `npm test --workspace @teranga-pay/mobile -- --runTestsByPath tests/collect-model.test.ts --ci`.

T28 borne chaque lecture d'état, de devis et de facture à dix secondes. Le suivi
de la demande courante et des vingt archives au maximum s'effectue en parallèle
pour ne pas additionner leurs délais. Une lecture trop lente laisse la demande
exacte engagée avec `READ_TIMEOUT`, sans créer de reçu ni de facture de remplacement.
Un événement déjà confirmé reste prioritaire sur une lecture arrivée ensuite.

La création n'est pas interrompue par une course de promesses : après dix secondes,
l'interface présente `unknown` et `CREATION_UNKNOWN`, retire l'état occupé et
conserve la barrière. L'appel fournisseur original reste suivi ; sa réponse tardive
peut retrouver la facture exacte, y compris après remontage ou interruption.
Un événement précoce reste sans attribution jusqu'à connaissance de cette identité.
Ni l'expiration du délai d'interface ni un retour au premier plan ne recréent
automatiquement une facture. Les régressions se trouvent dans
`tests/t28-collect-history.test.ts`.

# 0017 | Passerelle simulée et idempotence des retraits

- Date : 11 novembre 2026, Dakar.
- Tâche : [T23, issue #18](https://github.com/PapaAmad/teranga-pay/issues/18), PAN ; relecture : Salam.
- État : proposition en cours de réalisation et de vérification locale ; aucun résultat de test ni de déploiement n’est déduit de cette note.
- Base : `feat/T23-passerelle-simulee` part de T17, commit `802e61f721a75a2e927d62be541bbdeff3481aec`, proposé dans la [PR #52](https://github.com/PapaAmad/teranga-pay/pull/52). T17 comprend le socle API T13. Le checkout mobile conserve T22 séparément.

## Besoin

Le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 9, confie à PAN la passerelle Wave/Orange Money simulée et l’API de retrait avec protection contre le double retrait. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), pages 13 et 15, exige des données fictives, une clé d’idempotence, des états suivis et une réconciliation. Le téléphone conserve ses clés ; cette simulation ne lui donne aucun droit de dépense et ne représente aucune intégration commerciale avec les opérateurs.

Une réponse perdue peut cacher une opération déjà réalisée. Répéter la demande avec une nouvelle référence, oublier les réservations au redémarrage ou rendre disponibles les fonds d’une opération incertaine peut alors produire un double effet. La protection doit porter sur l’effet simulé et sa persistance, pas seulement sur le bouton du futur écran T25.

## Choix | Un module dans l’API existante

`services/bridge-sim` porte les règles du retrait, les comptes fictifs, le stockage et le simulateur d’opérateur. L’API Fastify T13/T17 valide les requêtes, contrôle l’accès, expose les réponses et conserve ses journaux sans contenu personnel. Le module n’ajoute aucun serveur HTTP concurrent, SDK Lightning, client Wave ou client Orange Money.

Les routes de retrait sont désactivées par défaut. Leur activation demande un jeton Bearer fourni par un fichier d’environnement ignoré et une écoute locale. L’identité de démonstration vient de la configuration authentifiée, jamais d’un champ libre que le client pourrait choisir pour consulter le retrait d’un autre compte. Le serveur ne demande ni PIN du wallet, ni phrase de récupération, ni clé de dépense. Les destinataires autorisés sont exclusivement `wave-demo-001` et `orange-demo-001`, selon l’opérateur ; aucun numéro de téléphone réel n’est accepté.

Les réponses portent `simulation: true`. Les soldes, réservations et crédits opérateur sont des valeurs de démonstration séparées du wallet. Une indisponibilité de la passerelle ne crée aucun mouvement dans le wallet natif.

## Devis et frais de démonstration

Le taux et la conversion entière réutilisent T17. Le devis de retrait conserve propriétaire, opérateur, destinataire, montant FCFA, frais, total, équivalents en sats, taux, source et échéance dans le stockage durable. La durée de ce devis T23 est limitée à cinq minutes même si la configuration générale des devis T17 autorise davantage. La confirmation désigne ce devis ; elle ne renvoie pas de montants modifiables.

La démo applique **100 FCFA de frais fictifs fixes**. Ce choix rend montant, frais et total vérifiables avant confirmation ; il ne décrit aucun tarif de Wave ou d’Orange Money. Les 150 FCFA montrés pour 20 000 FCFA dans la maquette de conception, page 11, restent un exemple visuel. Les conversions utilisent des entiers et l’arrondi T17 ; les composantes en sats doivent correspondre au total figé.

## Persistance et réservation

Le stockage utilise `node:sqlite`, inclus dans Node 24, avec un fichier local ignoré par Git. `DatabaseSync` exécute ses opérations de manière synchrone ; la documentation Node 24.16 classe le module en « release candidate », niveau 1.2. Ce compromis est retenu pour la démo locale à faible volume et doit être réévalué avant un service de production ou une charge importante. [Node.js | SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html).

Une transaction `BEGIN IMMEDIATE` regroupe la création du retrait et la réservation du solde fictif. SQLite n’autorise qu’une écriture simultanée et cette forme de transaction demande le verrou d’écriture dès son début ; un verrou indisponible produit un échec, jamais une réservation partielle déclarée réussie. Aucune transaction ne reste ouverte pendant l’attente du simulateur. [SQLite | Transactions](https://www.sqlite.org/lang_transaction.html).

La contrainte unique `(propriétaire, clé d’idempotence)` réserve une seule demande. Le même couple rejoue l’opération connue si le devis est identique ; un devis différent est un conflit. Une seconde contrainte `(propriétaire, devis)` interdit de confirmer à nouveau le même devis avec une autre clé. Les clés sont des UUID opaques et n’embarquent aucune donnée personnelle ; une chaîne arbitraire sans ce format est refusée. Le principe de réessai avec une clé constante et de refus des paramètres modifiés est documenté par Stripe ; aucun composant Stripe n’est utilisé ici. [Stripe | Requêtes idempotentes](https://docs.stripe.com/api/idempotent_requests).

Le rejeu est recherché avant l’expiration : un client peut retrouver une opération engagée avant le terme même si sa réponse arrive ensuite ou si le serveur a redémarré. Une nouvelle opération exige encore un devis actif. Les références utilisées ne sont pas purgées au point de permettre un nouveau retrait sous une ancienne clé. L’initialisation d’un compte de démonstration ne recharge pas son solde à chaque redémarrage.

La recherche d’un devis déjà engagé sous une autre clé précède également le contrôle de son expiration. Le conflit renvoie `QUOTE_ALREADY_USED` et peut contenir sa référence `withdrawalId`, après vérification du propriétaire authentifié. Cette réponse évite de présenter un ancien retrait engagé comme un simple devis expiré à remplacer.

## États et réconciliation

| État         | Sens                                                                          | Effet sur le solde fictif                                    |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `en_attente` | La demande est réservée ; le résultat opérateur est attendu.                  | Le total est réservé et indisponible pour une autre demande. |
| `incertain`  | Le résultat n’est pas suffisamment connu, notamment après une réponse perdue. | La réservation reste conservée.                              |
| `reussi`     | Le journal du simulateur confirme cette opération exacte.                     | Le total est consommé une seule fois.                        |
| `echoue`     | Un échec certain de cette opération est confirmé.                             | La réservation est libérée une seule fois.                   |

Le simulateur garde son propre journal durable, avec une identité unique par retrait. `timeout_after_success` écrit l’effet fictif puis perd sa réponse ; la réconciliation peut donc retrouver ce succès sans recréer l’effet. `unavailable` ne fournit aucune preuve d’exécution : l’absence de résultat ne libère pas la réservation par supposition. La réconciliation lit le journal de cette même opération ; elle ne relance pas une nouvelle demande de transfert. Une réponse tardive ne réécrit pas un état terminal déjà confirmé.

Après la review de Salam sur le commit `907e0ce`, une reprise volontaire et authentifiée est ajoutée : `POST /v1/withdrawals/:id/retry`. Elle recherche d’abord un résultat existant ; une lecture échouée garde l’incertitude sans resoumettre. Une lecture sans résultat permet de soumettre **le même identifiant et la même charge utile**, sans nouvelle réservation, même si le devis initial a expiré. Le contrat `BridgeProvider.submit` exige l’idempotence durable par `withdrawal.id` ; seul le simulateur est composé dans l’API de cette démonstration. Un état terminal reste acquis. Cette reprise permet de sortir d’une panne sans libérer des fonds sur une simple échéance ni créer un retrait supplémentaire.

Les réponses HTTP conservent `202` tant que la création ou son rejeu reste en attente ou incertaine ; les résultats terminaux utilisent `201` à la création initiale puis `200` au rejeu. La configuration locale peut être préparée plusieurs fois : un fichier existant reste inchangé et `bridge:setup` se termine en succès sans afficher son jeton.

## Conséquences et limites

L’API fournit le contrat que T25 pourra présenter avant confirmation. T24 garde l’historique et les reçus de l’application. T23 ne remplace pas le contrat wallet T11, ne débite aucun wallet natif et ne relie pas automatiquement une simulation à un paiement Lightning. Le fichier SQLite conserve un historique de démonstration ; le supprimer ou restaurer une copie ancienne supprime aussi des garanties de rejeu. Aucun nettoyage de ce fichier n’est automatisé pendant une opération.

Le devis de retrait réutilise directement `satsForXof` et conserve ensuite son instantané durable, sans second magasin de devis mémoire. Une politique bornée pour les devis non engagés devra être définie séparément ; elle ne devra pas purger le journal ni les identifiants nécessaires à une reprise.

Le stockage mémoire seul est écarté parce qu’il perdrait les réservations au redémarrage. Un service distant ou une nouvelle dépendance de base de données ajouterait une infrastructure inutile à cette démo. Un futur vrai opérateur demanderait son propre contrat d’idempotence, sa réconciliation, ses contrôles d’accès et une décision d’intégration distincte.

Les preuves de concurrence, de reprise, d’authentification et de journaux sont consignées dans le [suivi T23](../planning/suivi-t23.md) après exécution. Cette note reste une proposition à relire par Salam ; elle n’est ni une approbation humaine ni une preuve de transfert réel.

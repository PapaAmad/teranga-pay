# 0013 | Accueil, lecture du wallet et données inconnues

- Date : 9 novembre 2026, Dakar.
- Tâche : [T16, issue #11](https://github.com/PapaAmad/teranga-pay/issues/11), PAN ; relecture Salam.
- État : écrans confirmés par PAN le 9 novembre 2026 avant commit et PR T16 ; relecture de Salam attendue.
- Base : `feat/T16-accueil` part de T14, commit `63feafa`, publié dans la [PR #70](https://github.com/PapaAmad/teranga-pay/pull/70), encore en revue au démarrage.

## Besoin

Le document de conception demande un accueil avec le solde en FCFA, les actions Recevoir, Envoyer et Encaisser, puis les dernières opérations. T11 définit les données ; Salam porte le wallet T15 et les taux T17. L’interface doit avancer sans importer leurs branches non fusionnées ni présenter des données fictives comme un portefeuille connecté.

La [recherche de conception](../design/accueil-recherche.md) et la [direction artistique](../design/accueil-direction.md) expliquent la composition. Cette décision fixe la frontière de lecture, le traitement des données inconnues et les conditions du branchement réel.

## Décision | Un port de lecture compatible avec T11

[ports.ts](../../apps/mobile/src/home/ports.ts) reprend structurellement les types utiles de T11 et quatre méthodes :

```ts
state(): Promise<HomeWalletState>;
balance(): Promise<HomeResult<HomeBalance>>;
history(options?: { limit?: number; before?: string }): Promise<HomeResult<HomePayment[]>>;
subscribe(listener: (event: HomeWalletEvent) => void): () => void;
```

L’accueil ne crée pas de clés, ne reçoit pas de PIN et ne déclenche ni devis ni paiement. La copie locale permet de travailler sur la branche T14 sans ajouter de package absent. Elle devra être rapprochée du contrat partagé lors de son intégration : elle n’est pas une seconde autorité métier ni un SDK de remplacement. Aucune dépendance n’est ajoutée pour T16.

Les données de référence sont celles de la [PR T11 #53](https://github.com/PapaAmad/teranga-pay/pull/53), commit `5a670f13a2aafb06805c946fc2c404e8fa53c13e`. `HomeBalance` distingue les sats dépensables, les sats en attente, leur contre-valeur FCFA éventuellement inconnue, le taux et la date de lecture. `HomePayment` conserve le sens, le statut, les unités explicites et la date fournis par le wallet. Les événements portent un changement d’état, de solde ou de paiement.

## Une absence de donnée n’est pas un solde nul

L’entrée normale utilise `mode: 'unavailable'` tant qu’aucun port natif validé n’est fourni. Elle explique l’absence de portefeuille disponible et ne fabrique ni `0 FCFA`, ni liste vide présentée comme un historique vérifié. Injecter un port est un point de composition futur, pas une intégration déjà effectuée.

Un solde de zéro reçu explicitement reste affichable comme zéro. Une contre-valeur `null` reste inconnue et les sats connus peuvent être montrés. Une quantité positive de sats dont l’estimation arrondie vaut zéro est présentée comme « moins de 1 FCFA ». La source `fixe` est nommée « Taux de démonstration » ; aucun prix de retrait ou de paiement n’est garanti par cet affichage.

Le montant FCFA d’une opération passée est utilisé tel que fourni. L’accueil ne le recalcule pas à partir du cours actuel. Si cette valeur manque, il indique son indisponibilité et peut afficher les sats. Les statuts en attente et échoué ne sont pas présentés comme des débits confirmés. Les trois lignes ne composent pas un relevé comptable complet.

[format.ts](../../apps/mobile/src/home/format.ts) formate les entiers et les dates en français, dans le fuseau `Africa/Dakar`. Les unités, les légendes et les libellés viennent du contexte de traduction T09. Le catalogue wolof reste vide et ne devient pas disponible avec T16.

## Lectures, erreurs et cycle de vie

[controller.ts](../../apps/mobile/src/home/controller.ts) valide les états, les entiers sûrs non négatifs, les dates ISO UTC, les discriminants et les identifiants avant d’exposer une réponse. Une donnée invalide produit une erreur, sans afficher son contenu brut. L’historique est limité à trois opérations ; les identifiants ne doivent pas être dupliqués.

Le solde et l’historique sont chargés indépendamment. Un échec de l’un ne masque pas une lecture valide de l’autre. Pendant une actualisation ou après un échec, une ancienne observation peut rester en mémoire avec un indicateur de données précédentes. Aucun cache financier sur disque n’est ajouté. Une date de lecture ne prouve pas à elle seule une synchronisation avec le réseau.

Les événements invalident les lectures devenues anciennes et regroupent les rafales de notifications. Les réponses d’une lecture obsolète sont ignorées. Le passage en arrière-plan, le verrouillage annoncé, l’absence du wallet et la destruction de l’écran effacent les données de son état courant. La reprise relit l’état et les ressources ; elle ne réutilise pas silencieusement un solde d’une session précédente.

Ces protections concernent les données détenues par l’écran. Le port n’expose pas `lock()` : le verrouillage effectif du coffre et la session native restent à intégrer avec T14/T15. Masquer un montant n’est ni chiffrer la mémoire JavaScript ni arrêter un nœud Lightning. De même, `pret` n’est pas transformé en promesse de connexion : l’interface le décrit comme un portefeuille ouvert.

## Aperçu de développement et actions futures

La route `HomePreview` est réservée à `__DEV__`. [preview.ts](../../apps/mobile/src/home/preview.ts) fournit uniquement des données fictives en mémoire et les scénarios `ready`, `empty`, `offline`, `rateUnavailable`, `loading`, `error` et `largeAmount`. Le scénario nominal montre 100 000 sats et 45 000 FCFA au taux fixe de démonstration. Le chargement contrôlé ne dépend pas d’une attente artificielle. La valeur extrême vérifie le format sans perte de chiffres et ne représente pas une réserve financière.

L’aperçu reste identifié comme fictif. Ses trois actions ouvrent une modale qui explique leur limite ; aucune facture n’est créée, aucun QR réel n’est généré et aucun paiement n’est envoyé. La navigation fonctionnelle Recevoir, Envoyer et Encaisser appartient respectivement à T18, T20 et T22. L’historique complet, les détails et les reçus appartiennent à T24. Les actions ne deviennent pas utilisables financièrement par la simple présence d’un dessin ou d’un état `pret`.

## Revues des dépendances et conditions d’intégration

Les revues liées à T16 ont été publiées et leur présence vérifiée le 9 novembre 2026 :

| Dépendance | Revue publiée                                                                                                               | Résultat et portée                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T11, #53   | [Revue du commit `5a670f13`](https://github.com/PapaAmad/teranga-pay/pull/53#pullrequestreview-5827415172)                  | Les 16 tests contrats passent. Les correctifs de casse, de date impossible et de pagination sont confirmés ; trois fils techniques ont reçu une réponse puis ont été résolus. Les choix communs du contrat restent à valider humainement. |
| T17, #52   | [Revue du commit `802e61f`](https://github.com/PapaAmad/teranga-pay/pull/52#pullrequestreview-5827415933)                   | Les 31 tests API passent. Le rafraîchissement Kraken partagé est confirmé et son fil technique est résolu. Les limites déjà discutées ne sont pas republiées comme de nouveaux défauts.                                                   |
| T15, #61   | [Demande de corrections du commit `e337e428`](https://github.com/PapaAmad/teranga-pay/pull/61#pullrequestreview-5827414152) | Trois écarts reproduits : solde récupérable présenté comme dépensable, contre-valeur historique recalculée au cours actuel, événement de paiement échoué non transmis. Ils doivent être corrigés et vérifiés avant branchement réel.      |

Pour les 16 et 31 tests, les sources TypeScript exactes des commits ont été extraites avec `git show`, chargées en mémoire avec Node 24 et exécutées dans des modules VM. Les tests API utilisent les dépendances déjà installées pour la revue. Ce sont des preuves JavaScript locales ; elles ne confirment ni compilation Android, ni module natif fonctionnel, ni appel Kraken réel, ni paiement Lightning reçu. Les trois vérifications supplémentaires sur l’adaptateur T15 reproduisent les écarts signalés, sans essai sur appareil.

Une revue assistée par Codex ne constitue pas l’approbation humaine de PAN. La résolution des quatre fils techniques ne fusionne aucune PR et ne valide pas T15. Le branchement de l’accueil attend les corrections, la composition de session avec T14/T15 et les essais de lecture, d’événements, d’interruption et de reprise avec Salam. Regtest reste le seul réseau de démonstration ; les retraits Wave/Orange Money restent simulés dans leurs tâches respectives.

## Validation de cette livraison

PAN a confirmé les nouveaux écrans T16 le 9 novembre 2026 avant commit et PR, séparément de son accord sur T14. La [galerie](../design/validation-t16/index.html) présente 16 captures Web des vrais composants et leurs mesures. Les tests du modèle et des composants, ainsi que les contrôles globaux effectivement réalisés, figurent dans le [suivi T16](../planning/suivi-t16.md). Aucun rendu Android ou essai TalkBack n’est déduit de ces captures ou des vérifications de dépendances ci-dessus. La relecture de Salam reste nécessaire.

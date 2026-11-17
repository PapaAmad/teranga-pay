# 0012 | Onboarding, protection et intégration du wallet

- Date : 8 novembre 2026, Dakar.
- Mise à jour : 9 novembre 2026 ; migration SDK 58 effectuée par PAN conservée.
- Tâche : T14, PAN ; relecture Salam.
- État : proposition T14 ; écrans confirmés par PAN le 9 novembre 2026 avant commit et PR. Relecture de Salam attendue. Aucun branchement du coffre natif annoncé.

## Besoin et dépendances

[T14](https://github.com/PapaAmad/teranga-pay/issues/9) porte le choix de langue, la création guidée, la sauvegarde avec vérification et le PIN. Les clés, leur coffre et leur authentification appartiennent à T15. Les écrans doivent pouvoir être examinés et testés sans présenter une simulation comme un wallet opérationnel.

La branche T14 part de T09 au commit `f78051f`, encore en revue au démarrage. Elle conserve ses ressources de traduction et les fondations T08. Les contrats consultés sont la [PR T11 #53](https://github.com/PapaAmad/teranga-pay/pull/53), commit `5a670f13a2aafb06805c946fc2c404e8fa53c13e`, et la [PR T15 #61](https://github.com/PapaAmad/teranga-pay/pull/61), commit `e337e428ba789879c03d071296b055a580e26b79`. Ces deux PR ne sont pas fusionnées à cette lecture ; la compilation native T15 n'est pas validée par ce travail.

## Ordre du parcours et frontière technique

La préparation explique les étapes, puis l'utilisateur définit et confirme un PIN de six chiffres **avant** la création et l'affichage des mots. Le contrat existant expose `create(pin)` : le coffre a besoin de ce code pour protéger immédiatement la graine. Cet ordre adapte celui du PDF à la sécurité de l'API disponible ; ce n'est pas une loi psychologique tirée de la recherche.

[ports.ts](../../apps/mobile/src/onboarding/ports.ts) décrit uniquement les méthodes nécessaires : état, création, restauration, ouverture et verrouillage. Il reste compatible structurellement avec T11, sans recopier le SDK ni importer un paquet absent de la branche. La méthode de restauration prévue dans le port n'est pas exposée comme un parcours terminé dans T14.

[controller.ts](../../apps/mobile/src/onboarding/controller.ts) orchestre les transitions et refuse les réponses asynchrones devenues périmées. L'écran et le contrôleur retirent leurs PIN, réponses et mots de l'état courant à la suspension et demandent le verrouillage. Cela ne constitue pas une garantie d'effacement physique de la mémoire JavaScript ou du système.

## Deux situations explicitement distinctes

**Entrée normale :** aucun wallet n'est injecté. Les services restent `unavailable`. L'utilisateur peut découvrir l'application, choisir le français et lire la préparation ; la création s'arrête avec une explication avant de demander un PIN. Il n'y a ni coffre inventé ni état « wallet prêt » obtenu par une simulation silencieuse.

**Aperçu de développement explicite :** les services `preview` gardent leur état en mémoire et utilisent `exemple01` à `exemple12`. Ces jetons ne sont pas une phrase Bitcoin. L'aperçu permet de relire les étapes et les erreurs ; il ne génère aucune clé et ne réalise aucun paiement. Son accès est réservé au développement et son statut doit rester visible. Il ne prétend pas protéger une vraie phrase dans un navigateur.

Fournir un futur port natif à la factory de plateforme ne suffit pas à déclarer T15 intégrée. Le branchement reste absent jusqu'à validation des conditions suivantes avec Salam.

## Reprise et sauvegarde | Conditions avant branchement natif

T11 et T15, aux commits consultés, ne fournissent ni état natif de sauvegarde vérifiée, ni lecture authentifiée des mots pour reprendre une copie interrompue. `pret` ou `verrouille` ne prouve pas qu'une sauvegarde a été faite.

Dans T15, la création peut persister la graine avant que le démarrage du nœud ne réussisse. Un échec à ce moment peut laisser un coffre créé sans remettre les mots à l'écran. De même, tuer le processus après création peut interrompre leur sauvegarde. **Ne pas recréer, supprimer ou réinitialiser automatiquement ce coffre.** La reprise authentifiée doit être définie et testée côté wallet avant branchement.

Les marqueurs UI `completed` et `pendingBackup` ne résolvent pas ce problème. Ils ne sont liés ni cryptographiquement ni par identité à un wallet particulier. Un wallet présent exige toujours un déverrouillage par PIN ; un état de sauvegarde inconnu ou interrompu reste bloqué. Le PIN, le succès d'un quiz ou une préférence modifiable ne devient jamais une autorisation de session.

La récupération des clés et celle des états Lightning restent distinctes. Les sources et limites de cette distinction figurent dans la [recherche](../design/onboarding-recherche.md). Aucun mécanisme VSS, SCB ou service de restauration n'est ajouté dans T14.

## Persistance et protection d'écran

[platform.ts](../../apps/mobile/src/onboarding/platform.ts) conserve seulement une préférence de langue et les deux marqueurs UI dans un objet versionné. Le français est disponible ; le catalogue wolof préparé en T09 ne rend pas le choix utilisable avant T33. Le stockage valide la forme JSON et les seuls champs autorisés. Il remonte les échecs sans les convertir en succès et sérialise les lectures et écritures pour éviter qu'une préférence efface l'autre. Aucun PIN, mot ou résultat d'authentification n'y entre.

Avant toute création et révélation de mots, le contrôleur exige une protection confirmée, puis écrit le marqueur d'interruption. L'adaptateur vérifie `isAvailableAsync()` et attend `preventScreenCaptureAsync()` ; la libération utilise la même clé T14. Les opérations sont sérialisées. Le Web renvoie explicitement une protection indisponible.

Dans la source installée **expo-screen-capture 58.0.6**, relue après la migration SDK 58, l'appel Android `preventScreenCapture` ajoute `FLAG_SECURE` dans une `AsyncFunction<Unit>` exécutée sur `Queues.MAIN`. Attendre cette promesse confirme donc l'exécution de cet appel, sans certifier le comportement de tous les appareils. La [documentation Expo](https://docs.expo.dev/versions/latest/sdk/screen-capture/) décrit l'API ; Android précise les [limites de protection des fenêtres sensibles](https://developer.android.com/security/fraud-prevention/activities?hl=en). Aucun APK installé n'est déduit de cette lecture.

## Dépendances et migration SDK 58

PAN a migré l'environnement vers Expo 58. T14 conserve cette migration et ne rétablit pas le SDK 57. Les numéros ci-dessous distinguent les versions déclarées de la preuve d'installation ; les contrôles doivent porter sur l'arbre réellement installé et le lockfile actualisé.

| Dépendance                                        | Usage et justification                                                                               | Limite                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@react-native-async-storage/async-storage` 2.2.0 | Persister la langue et les marqueurs non secrets entre deux ouvertures.                              | Ce stockage ne remplace pas un coffre et ne rend pas les marqueurs inviolables.                        |
| `expo-screen-capture` ~58.0.6, 58.0.6 installé    | Attendre l'appel natif de protection avant d'exposer des mots.                                       | Le module doit être présent dans le build ; un test JavaScript ne valide pas les captures sur Android. |
| `react-native-web` 0.21.4, développement          | Afficher les vrais composants React Native dans un navigateur pour examiner composition et parcours. | Ne valide ni le coffre, ni la protection native, ni TalkBack Android.                                  |
| `react-dom` 19.3.0 installé, développement        | Rendre la prévisualisation, alignée sur React 19.3.0 après la migration.                             | Ne prouve pas un parcours natif validé.                                                                |
| `@expo/metro-runtime` ~58.0.17, développement     | Fournir le runtime Metro nécessaire à la prévisualisation Web sous Expo 58.                          | Aucun nouveau service Web ou front indépendant n'est livré.                                            |

Le lockfile doit conserver les versions résolues après installation. Ces dépendances n'ajoutent aucune bibliothèque Bitcoin ou Lightning, aucun backend et aucun SDK crypto de substitution. Les modules natifs sont chargés au moment de leur utilisation afin qu'un échec de chargement puisse remonter au contrôleur.

L’installation et la déduplication ont aligné `jest-expo` 58.0.14,
`@react-native/jest-preset` 0.88.1 et `react-test-renderer` 19.3.0.
Conserver l’ancien renderer 19.2.3 bloquait les tests avant leur exécution avec React
19.3.0. La migration de PAN est préservée ; seules ces adaptations de compatibilité
et la cible Web de prévisualisation la complètent.

L’autorevue a corrigé deux courses dans le contrôleur : un marqueur écrit avant
une création jamais lancée ne bloque plus un wallet confirmé absent, et le nettoyage
d’un déverrouillage obsolète ne peut plus refermer une nouvelle session. Les mutations
du port wallet sont sérialisées. Un coffre présent ou une création encore en vol
ne sont jamais effacés pour permettre une reprise.

## Corrections de relecture | 16 novembre 2026

Le quiz prépare désormais des permutations indépendantes pour les leurres et les
choix, avant toute création du coffre. La dépendance native `expo-crypto` 58.0.8
fournit `getRandomValues` ; le tirage borné rejette le biais du modulo et refuse une
source défaillante. Ce module sert au quiz de l’interface, jamais à la génération
des clés Bitcoin. Il nécessite un client natif compatible ; un ancien client
incomplet est refusé avant `create`, sans repli prévisible. Le lockfile conserve
la version exacte. Le mélange, les plages invalides et le refus d’entropie sont
couverts par des régressions déterministes utilisant une source remplacée.

Le démontage après une fin validée ne reverrouille plus le wallet transmis à
l’accueil. Le contrôleur est recréé au montage de l’effet, pour éviter une instance
détruite après Fast Refresh. Les préférences corrompues repartent d’un état vide,
sans autorisation implicite ; une erreur réelle de lecture reste une erreur.

La suspension sur `inactive` et `background` conserve l’effacement des secrets.
La reprise authentifiée des mots et l’unification de la protection de capture
avec T15 restent à convenir avec Salam : l’interface ne contourne pas l’absence
de cette capacité en conservant les mots ou en détruisant un coffre existant.

## Vérification et approbation après corrections

Les tests Jest peuvent vérifier la logique du parcours, l'attente des promesses, les erreurs et la persistance avec des doubles contrôlés. La prévisualisation Web peut servir à examiner les composants et des parcours d'aperçu. Aucune de ces deux preuves ne démontre la génération de clés, la reprise après arrêt, l'accessibilité Android ou une protection de capture réelle.

Avant branchement natif, Salam doit relire la frontière, garantir la reprise sans destruction du coffre et fournir les essais de création, interruption et déverrouillage. À la demande de PAN, le rendu est d’abord resté local ; il a confirmé les écrans le 9 novembre 2026 avant commit et PR. La relecture de Salam et les contrôles CI du commit effectivement publié restent nécessaires. Aucun résultat d'essai avec les publics concernés, d'installation APK ou de paiement réel n'est inventé ici.

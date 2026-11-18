# Parcours Maestro Android | T30

PAN maintient ces quatre parcours ; Salam relit. Ils pilotent une application
Android réellement installée, dont les écrans existants utilisent leurs ateliers
fictifs en mémoire. Aucun scénario ne crée de portefeuille natif, de clé, de
facture payable ou de transfert Wave/Orange Money.

| Fichier                           | Parcours visé                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-onboarding-fictif.yaml`       | Français, code inventé, jetons `exemple01` à `exemple12`, vérification des positions 2, 6 et 10 et fin explicitement fictive.                                         |
| `02-parcours-nominal-fictif.yaml` | Adresse de démonstration, envoi autorisé, encaissement avec confirmation manuelle et reçu fictif, retrait Wave simulé, lecture d’un reçu du journal de démonstration. |
| `03-envoi-resultat-tardif.yaml`   | Un envoi fictif sans réponse atteint l’état incertain après le délai T28 ; son résultat initial est ensuite reçu sans deuxième appui d’envoi.                         |
| `04-retrait-resultat-tardif.yaml` | Une confirmation de retrait Orange Money simulé atteint l’état incertain ; la réponse de la demande initiale débloque son résultat.                                   |

Maestro utilise le nom de fichier technique dans ses rapports. Le champ `name`
est omis : Maestro 2.12.1 l’utilise aussi comme dossier et un séparateur `|`
dans ce champ empêche l’exécution sous Windows. Les descriptions françaises
du tableau restent les libellés humains des parcours.

Chaque fichier est autonome et commence par `launchApp` avec `clearState: true`
sur **`pay.teranga.demo.e2e`**. Ce paquet est réservé aux données fictives ; ne pas
remplacer cet identifiant par celui d’une application contenant un portefeuille.
La remise à zéro rétablit le français initial. Le premier parcours confirme aussi
ce choix à l’écran.

## Exécution

Prérequis : Maestro CLI **2.12.1**, JDK 21 pour compiler le projet, `adb`,
émulateur Android x86_64 et APK debug construit avec `TERANGA_E2E_BUILD=1`. Cette
application doit être installée et reliée à son serveur Metro, avec les ports
redirigés pour l’émulateur. Les routes d’atelier utilisent `__DEV__` ; une APK de
production ne les expose pas. La préparation et les commandes complètes sont
décrites dans [le guide du banc e2e](../README.md).

L’APK de ce banc est x86_64 ; il ne couvre pas l’installation sur un téléphone
ARM ni la validation physique T32.

La présence de ces fichiers ne confirme pas leur exécution. Le dernier résultat
effectivement obtenu figure dans [le suivi T30](../../../docs/planning/suivi-t30.md).

Depuis la racine du dépôt, une fois ce banc prêt :

```sh
npm run e2e:android -- --device emulator-5554
```

Le lanceur vérifie la version de Maestro, l’appareil, le paquet isolé et Metro,
puis exige un rapport JUnit complet. Les captures nommées `*-fictif*` et le rapport JUnit
sont des artefacts locaux ignorés ; n’en conserver que des données de
démonstration. Aucun `takeScreenshot` ne vise la saisie du code ou l’affichage des
douze jetons d’exemple. Maestro peut néanmoins produire ses propres diagnostics
sur un échec : ces parcours n’emploient donc aucun vrai code ni mot de récupération.

Chaque attente initiale après `launchApp` autorise jusqu’à 240 secondes pour le
bundle debug Metro à froid. Les assertions et délais des opérations restent
inchangés. Cette marge du banc ne mesure pas la performance de livraison T32.

En CI, compilation et émulateur utilisent deux machines virtuelles distinctes.
L’APK fictif et son SHA source sont transmis dans un artefact privé d’un jour,
vérifié avant l’installation. Les diagnostics sans APK restent séparés pendant
sept jours ; voir [le guide](../../../docs/guides/tests-maestro.md). La présence
de cet artefact ne constitue pas une preuve d’exécution de ces parcours.

## Portée des preuves

Une exécution native réussie vérifie la navigation, les saisies, les bannières de
simulation, les états visibles et les résultats fictifs sur Android. Les boutons
financiers sont actionnés une fois ; les parcours de reprise attendent l’état
incertain avec `extendedWaitUntil`, puis libèrent la réponse d’origine via le
bouton de l’atelier. Ils ne répètent pas une commande financière et ne masquent
aucune assertion de résultat avec `optional`.

Les fournisseurs de chaque atelier sont indépendants. Le reçu historique
`demo-reception-1` préexiste dans sa fixture ; il ne prouve pas l’enregistrement
des opérations des autres écrans. L’absence d’un bouton visible n’est pas une
mesure du nombre d’appels aux services : cette garantie reste couverte par les
tests des contrôleurs.

Ces parcours ne prouvent ni un paiement Lightning regtest, ni la garde des clés,
ni l’intégration de l’API T29, ni un transfert vers un opérateur. Le parcours réel
attend la composition des ports natifs de Salam et des données T12/T29. Une
validation YAML par `maestro check-syntax` ne remplace jamais `maestro test` sur
l’application installée.

Les libellés français proviennent de T09 ; les quatre identifiants de champs
évitent de confondre leur libellé avec leur entrée native. Les textes sont des
expressions régulières : `\|` protège le séparateur et le point entre les groupes
de montants accepte l’espace insécable utilisé par le formatage français.

Références : [sélecteurs Maestro](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/how-to-use-selectors),
[remise à zéro au lancement](https://docs.maestro.dev/reference/commands-available/launchapp),
[défilement conditionnel](https://docs.maestro.dev/reference/commands-available/scrolluntilvisible),
[attente d’un état](https://docs.maestro.dev/reference/commands-available/extendedwaituntil).

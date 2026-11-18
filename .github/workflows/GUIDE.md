# Contrôles automatiques

`ci.yml` vérifie le format, le lint, TypeScript, les tests et les secrets.
`pr-title.yml` vérifie le titre des PR sans installation des dépendances npm.
Les six noms de contrôles sur les PR sont ceux attendus par `main-ruleset.json`.
Les PR de forks tournent sous `pull_request`, avec un jeton en lecture seule.
Un changement de branche cible relance la qualité et les secrets sur la nouvelle
fusion de test. Une modification du titre ou de la description exécute seulement
`Titre PR` ; les deux jobs CI ignorés portent des noms distincts des contrôles
obligatoires, et leur groupe de concurrence est séparé. Ils ne peuvent donc ni
annuler la qualité en cours, ni remplacer un contrôle échoué par un résultat
ignoré. Le titre est toujours revérifié, même après une simple modification de
description, pour ne pas masquer un échec.

La matrice qualité partage la configuration des quatre contrôles. Chaque job
garde son runner et son installation `npm ci` ; le cache npm réduit les
téléchargements, sans partager des `node_modules` entre jobs.

Le passage d’un brouillon en relecture conserve la preuve Maestro du même code ;
ce seul changement de métadonnées ne relance pas une compilation Android. Les
nouveaux commits et changements de branche cible déclenchent ses nouveaux essais.

`maestro.yml` ajoute **Maestro | APK fictif** et **Maestro | Android fictif** pour
T30, sur les changements de
l’application mobile, des assets de marque, des packages, des scripts, du banc e2e
ou de ses dépendances npm. Il ne modifie pas les six contrôles obligatoires de
`main`. Une modification de métadonnées seule utilise un nom ignoré et un groupe
de concurrence séparés ; un changement de branche cible exécute le banc sur la
nouvelle fusion de test.

Les deux jobs Ubuntu 24.04 utilisent Node depuis `.nvmrc`, npm 12.2.1 et Java
Temurin 21. Le job `build` compile l’APK debug x86_64 du paquet isolé
`pay.teranga.demo.e2e`, avec un budget de 35 minutes. Le job `android`, qui
dépend de `build`, repart sur une machine virtuelle fraîche : il installe
Maestro 2.12.1 avec contrôle d’intégrité, démarre Metro et exécute les quatre
parcours sur un émulateur API 35 `google_apis` x86_64 avec KVM. Son budget est
de 30 minutes. Les deux checkouts visent exactement `github.sha`, la fusion de
test pour un événement de PR.

L’action
`ReactiveCircus/android-emulator-runner` v2.34.0 est figée au commit
`a421e43855164a8197daf9d8d40fe71c6996bb0d`. La séparation des jobs évite de
conserver les fichiers de compilation sur le disque de l’émulateur. Le job
Android appelle `android-e2e-space.mjs prepare` : le script exige Linux sur un
runner GitHub hébergé, `ANDROID_HOME=/usr/local/lib/android/sdk` et des chemins
canoniques sans lien pour les dossiers contrôlés. Il retire uniquement les NDK
préinstallés de cette VM, inutilisés par le test, puis exige 13 Gio libres avant
l’image. Le job de compilation conserve son NDK.

Une étape distincte installe explicitement build-tools 37.0.0, platform-tools,
plateforme Android 35, émulateur et image Google APIs Android 35 x86_64. Elle
crée `/home/runner/.android/avd`, défini comme `ANDROID_AVD_HOME`, puis appelle
`check-boot`. Ce mode ne supprime rien et exige 9 Gio libres sur le système de
fichiers de ce dossier avant l’action émulateur. Une erreur arrête l’étape et
empêche cette action de démarrer. Aucun hook de pré-lancement n’est utilisé ;
l’action retrouve les mêmes paquets déjà installés. Les relevés sont conservés
avec les diagnostics. Ces modes refusent un poste local ou un
runner autohébergé. La RAM demandée est de 2 560 Mo ; aucune taille de partition
de données réduite n’est promise, car la demande précédente de 2 048 Mo n’a pas
réduit l’espace requis par l’image. Ce banc n’utilise ni EAS, ni secret de
déploiement, ni signature de production. Les minutes du runner relèvent du
quota Actions du dépôt privé.

`build` téléverse uniquement l’APK debug fictif, `source.sha` et `SHA256SUMS`
dans `maestro-apk-fictif-<run_id>`, artefact privé conservé un jour.
`overwrite: true` remplace cet artefact lors d’une relance complète du même run.
`android` le télécharge avec `actions/download-artifact@v4`, puis contrôle les
empreintes et l’égalité du SHA source avec `GITHUB_SHA` et son propre checkout
avant l’installation. Cette action est une dépendance opérationnelle de CI pour
le transfert entre jobs, sans ajout au bundle mobile.

La vérification YAML reste une étape distincte : une réussite du job exige aussi
la compilation, l’installation de l’APK et `maestro test` sur l’émulateur. Les
ateliers sont fictifs ; cette exécution ne prouve pas un paiement Lightning ou
l’intégration native du wallet. `.tmp/e2e/` est conservé séparément sept jours
comme artefact de diagnostic après l’exécution du job Android, y compris après
un échec si le runner peut encore téléverser. Il ne contient pas l’APK.
Aucun coffre, keystore ou SDK n’est téléversé. L’APK de test transmis entre jobs
reste distinct de la Release signée T35. Les deux premiers runs ont compilé
l’APK mais n’ont pas démarré l’émulateur, faute d’espace. Le second a conservé
l’APK et les diagnostics ; les nouveaux gardes d’espace restent à exécuter dans
la CI. Chacun des quatre parcours a réussi localement après correction des
rôles accessibles et du défilement, dans deux exécutions distinctes. La suite
locale complète et la nouvelle CI restent à exécuter ; le relevé ciblé de deux
cas ne vaut pas rapport de quatre cas réussis. Voir
[le suivi T30](../../docs/planning/suivi-t30.md),
[le banc e2e](../../tests/e2e/README.md) et
[le guide Maestro](../../docs/guides/tests-maestro.md) pour l’exécution locale et
les limites de cette preuve.

Dependabot regroupe les versions mineures et correctives npm dans `npm`, les
versions majeures dans `npmmaj` et les correctifs de sécurité dans `npmsec` ;
les groupes des actions GitHub sont `ci`, `cimaj` et `cisec`. Les mises à jour
majeures ont leur propre lot pour ne pas bloquer les changements courants. Chaque type
de mise à jour possède son groupe, avec un identifiant court utilisé dans les
[titres automatiques](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups).
Cela réduit la longueur des titres des lots, sans garantir celle des mises à
jour d'une seule dépendance : Dependabot peut encore inclure son nom et ses
versions dans le titre. La limite de 72 caractères s'applique à tous. Si un titre
reste trop long, le raccourcir dans la PR avant la fusion, par exemple
`chore(deps): met à jour native-stack`. Seul le contrôle du titre sera exécuté.

`release.yml` (T35) compile l'APK Android signé et le publie dans une GitHub
Release avec sa somme SHA-256, à chaque tag `v*` ou à la main (Release
brouillon). Il exige quatre secrets de signature créés par un humain : voir le
[guide de publication](../../docs/guides/release-apk.md).

Le déclencheur `workflow_dispatch` permet aussi un lancement manuel depuis
Actions, avec **Run workflow**, ou via l'API. GitHub exige que le fichier soit
présent sur la branche par défaut pour ce déclenchement. Voir la
[documentation officielle](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

`integration.yml` (T29) lance le vrai réseau regtest dans Docker, prépare les
fonds et le canal avec le seed, puis exécute
[`integration.mjs`](../../infrastructure/seed/integration.mjs) : paiement dans
les deux sens, refus d'un double paiement et d'un paiement trop gros. Tout écart
fait échouer le job ; les journaux des services sont alors affichés, et le
réseau est toujours arrêté puis effacé, même en cas d'échec. Ce job n'est pas
encore dans la liste des contrôles obligatoires de `main-ruleset.json` : l'y
ajouter est une décision commune, à prendre après quelques passages stables.

Les résultats et les éventuels refus de démarrage sont
consignés dans le [relevé de publication](../../docs/planning/publication-github.md).

# Démarrage local

Ce guide concerne le socle PAN jusqu'à T07. L'application comporte son point d'entrée et sa navigation technique ; les parcours de paiement, le serveur, le SDK Lightning et le réseau Docker seront ajoutés dans leurs tâches respectives. Aucun fonds réel n'est nécessaire.

## Prérequis

- Node.js 24 (version de référence `24.22.0` dans `.nvmrc`) et npm 12, selon `package.json`.
- Git pour les branches, les hooks et les futures PR.
- Pour Android : Android Studio et un émulateur, ou un téléphone prêt au développement Expo.

Docker et un wallet Lightning ne sont pas requis pour valider T06/T07. Les instructions Docker arriveront avec T12 ; le SDK et les éventuelles compilations natives seront documentés après T10.

## Installer le dépôt

Ouvrir un terminal à la racine du projet, puis exécuter :

```sh
npm ci
```

Le dépôt utilise les workspaces npm et un seul fichier de verrouillage à la racine. Ne pas installer séparément les dépendances dans `apps/mobile`. La préparation npm installe les hooks si le dossier est un dépôt Git ; hors dépôt Git, leur activation attend l'initialisation locale.

Aucune variable d'environnement ni copie de fichier n'est nécessaire pour ce socle. Le fichier racine `.env.example` explique les conventions ; les paramètres utiles seront ajoutés et documentés avec les services concernés. Les futurs paramètres Expo devront être placés dans `apps/mobile/.env`.

Un nom préfixé `EXPO_PUBLIC_` est exposé dans l'application : aucune clé ou donnée sensible ne doit y figurer. Les emplacements de services futurs n'ont pas encore besoin de configuration d'exécution.

## Lancer l'application

```sh
npm run mobile
```

Le socle utilise Expo SDK 57. Le serveur de développement indique comment ouvrir l'application avec Expo Go compatible. Depuis son terminal, `a` lance Android si l'environnement est prêt ; `npm run mobile:android` permet aussi de demander directement le lancement Android. Un émulateur ou un téléphone reste nécessaire pour vérifier le rendu et les interactions ; des contrôles TypeScript réussis ne prouvent pas le fonctionnement sur appareil.

Le socle ne crée ni clés, ni phrase secrète, ni facture Lightning. Il ne comporte pas de passerelle de retrait opérationnelle. Les README des [services](../../services/README.md) et de l'[infrastructure](../../infrastructure/README.md) indiquent les tâches qui les introduiront.

## Vérifier le travail

Les mêmes commandes servent en local et en CI :

```sh
npm run format:check
npm run lint
npm run typecheck
npm test -- --ci
```

Pour appliquer le formatage, utiliser `npm run format`. `npm run test:tooling` vérifie les outils du dépôt et `npm run repo:check` sa cohérence. Les tests présents vérifient uniquement la logique réellement introduite par le socle, dont la navigation. Un test regtest sera ajouté en T29 et les parcours mobile en T30.

Après installation dans un dépôt Git, un commit déclenche les contrôles des fichiers modifiés et la validation de son message. Le premier `npm ci` doit être terminé avant de compter sur ces hooks.

## Préparer GitHub

Le dépôt et le Project #3 sont privés ; les accès en écriture de Salam sont confirmés. Le socle et la correction du README sont intégrés à `main` par les PR #36 et #37, avec les exceptions de fusion autorisées par PAN. Après le déverrouillage du compte par le support, la [CI sur `main`](https://github.com/PapaAmad/teranga-pay/actions/runs/41490101961) et les [six contrôles sur la PR #38](https://github.com/PapaAmad/teranga-pay/actions/runs/41491578241) ont réussi. La PR #38 conserve les mises à jour de suivi et attend la relecture humaine. Les rulesets et l'analyse native des secrets restent inactifs avec l'offre actuelle du dépôt privé. Lire le [guide du dépôt distant](depot-distant.md), le [suivi T01 à T07](../planning/suivi-t01-t07.md) et le [relevé GitHub vérifié](../planning/publication-github.md).

## En cas de difficulté

| Symptôme                     | Vérification utile                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Une commande npm manque      | Vérifier que le terminal est à la racine et lire les scripts dans `package.json`.                         |
| Une installation échoue      | Vérifier la version Node/npm, l'accès au registre et relancer `npm ci` une fois le problème corrigé.      |
| L'appareil ne joint pas Expo | Vérifier le réseau local et le pare-feu ; utiliser l'émulateur si le Wi-Fi du lieu bloque les connexions. |
| Les hooks ne démarrent pas   | Vérifier qu'un dépôt Git existe, puis relancer la préparation npm.                                        |
| Une route est encore vide    | Consulter la feuille de route : les fonctions T08 à T40 ne sont pas livrées par ce socle.                 |

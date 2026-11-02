# Vérification du socle T01 à T07

Vérifications locales du 2 novembre 2026, sous Windows avec Node.js 24.22.0 et npm 12.2.1. Ce relevé décrit le socle présent ; il ne constitue ni une approbation de Salam ni un résultat de GitHub Actions.

| Vérification                 | Résultat observé                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation des dépendances | Installation npm, puis réinstallation réussie depuis le verrouillage avec `npm ci --no-audit`. Dépendances sans conflit signalé par `npm ls --depth=0`. |
| Format, lint et types        | Commandes communes exécutées sur le dépôt.                                                                                                              |
| Parcours mobile Jest         | Accueil, ouverture de la présentation, puis retour avec le vrai navigateur React Navigation ; les appels natifs sont adaptés à Jest.                    |
| Scripts GitHub               | Tests du backlog, des responsabilités, des doublons, des erreurs de configuration, des titres et du mode de prévisualisation.                           |
| Structure documentaire       | README présents dans chaque dossier maintenu et liens Markdown relatifs résolus.                                                                        |
| Export Android               | Metro et Hermes ont généré un bundle de 823 modules, environ 1,9 Mo, accompagné de 17 assets dans `.tmp/mobile-export`.                                 |
| Hook `commit-msg`            | Message `chore(ci): prépare les vérifications` accepté ; message libre, scope absent et titre trop long refusés. Aucun commit créé pour cet essai.      |
| Hook `pre-commit`            | Exécuté via Git avec succès sans fichier indexé. Le contrôle de changements réellement indexés reste à observer lors du premier commit.                 |

Les sorties temporaires et l'export sont ignorés par Git. L'export Android ne remplace pas une installation sur téléphone, une compilation APK ni les futurs tests de paiement.

## Audit des dépendances

`npm audit --audit-level=high` a renvoyé **47 alertes : 6 faibles, 39 modérées et 2 élevées**, en comptant les paquets qui propagent une alerte transitive. Ce contrôle n'est donc pas vert. Les vérifications de code et la réussite de l'export ne corrigent pas ces alertes.

L'alerte élevée identifiée concerne Zod avant 4.6.6, dépendance de l'outillage Expo CLI 57. Le CLI installé utilise Zod 3.25.76 pour ses schémas de plugins DevTools et d'extensions ; le code applicatif du socle ne l'importe pas. Cette observation de portée ne vaut pas correction de la dépendance. L'[avis de sécurité](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) indique un correctif à partir de 4.6.6, et le [mainteneur de Zod](https://github.com/colinhacks/zod/issues/6653) indique l'arrêt des publications de la branche 3.

La contrainte Expo CLI 57 reste `^3.25.76` au moment du contrôle. Un remplacement forcé par une version majeure différente n'a pas été appliqué : les chemins d'extension concernés exigeraient leur propre validation. `npm audit fix --force` propose également des changements majeurs et une rétrogradation d'Expo ; ce n'est pas une procédure de maintenance retenue pour le dépôt.

Les alertes modérées se propagent notamment par les dépendances `glob` et `minimatch` des outils ; une alerte faible concerne `deepmerge`. Dependabot est configuré pour suivre les mises à jour. Salam devra examiner les alertes et les évolutions compatibles du SDK avant de clore T31. Une migration du SDK devra vérifier de nouveau la navigation, les types, les tests et l'export Android. Aucun plugin DevTools supplémentaire ni serveur MCP expérimental Expo n'est activé par ce socle.

## Contrôles encore nécessaires

- Installer et ouvrir l'application sur un téléphone Android ou un émulateur.
- Publier le code par PR dans le dépôt privé déjà créé et exécuter GitHub Actions. L'accès en écriture de Salam est confirmé ; les rulesets et l'analyse native des secrets ont été refusés sur l'offre actuelle et ne sont pas actifs.
- Faire passer la recherche de secrets Gitleaks et vérifier les protections sur une PR de test.
- Observer les hooks sur les premiers changements indexés et obtenir la relecture humaine.
- Réévaluer les alertes de dépendances avant les étapes de sécurité et de livraison.

Les paiements regtest, la passerelle simulée, les tests d'intégration et l'APK relèvent des tâches suivantes. Voir le [suivi T01 à T07](../planning/suivi-t01-t07.md).

Les opérations GitHub évoluent après ce relevé local : consulter leur [état vérifié](../planning/publication-github.md). La visibilité du dépôt et du Project reste privée selon la décision de PAN.

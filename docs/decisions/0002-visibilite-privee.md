# 0002 | Conserver le dépôt et le Project privés

- Date : 2 novembre 2026, Dakar.
- Tâches : T01, T02, T03 et T05.
- Décision : PAN, propriétaire du dépôt.
- État : visibilité privée confirmée pour le dépôt et le Project #3 ; accès en écriture de Salam vérifié sur les deux.

## Contexte

Le plan d'équipe et le document de conception prévoient un projet public. Après avoir autorisé la mise en place GitHub, PAN a précisé que le dépôt doit rester privé. Cette instruction plus récente de l'utilisateur remplace la préférence de visibilité des documents sources.

Le dépôt `PapaAmad/teranga-pay` a été créé avec un README d'initialisation sur `main`, puis immédiatement passé en privé avant l'envoi du code du projet et la création des issues. Les PDF restent intacts afin de conserver leur version d'origine.

## Choix

Conserver le dépôt **privé** et limiter son accès GitHub aux personnes autorisées. Le tableau GitHub Projects doit également être **privé** : la confidentialité du dépôt ne suffit pas à définir celle d'un tableau distinct. Salam (`AliouneKane`) a accepté l'invitation et son accès en écriture a été vérifié.

Le [Project #3](https://github.com/users/PapaAmad/projects/3) est désormais créé, privé et lié au dépôt. Salam y dispose du rôle `WRITER`. Il contient les 35 cartes du backlog et utilise le champ natif `Status`, avec quatre états français ; aucun second champ `Avancement` n'est nécessaire. La vue Board existe et son regroupement par `Status` a été confirmé via `verticalGroupByFields` dans l’API.

Le fichier `LICENSE` reste sous licence MIT. Le choix de visibilité GitHub ne supprime ni ne remplace ce fichier. Aucun changement vers une visibilité publique n'est inclus dans la mise en place actuelle.

## Conséquences

- Les guides et scripts de préparation doivent utiliser une création privée et ne pas chercher à rendre le dépôt ou le Project publics.
- Les liens GitHub ne sont accessibles qu'aux comptes autorisés. Le suivi d'équipe doit tenir compte de cet accès limité.
- Les rulesets ont été refusés avec une réponse 403 et l'analyse native des secrets avec une réponse 422 sur ce dépôt privé. Ces protections ne sont pas actives ; le dépôt reste privé. Gitleaks dans la CI et les alertes Dependabot sont des mécanismes distincts. La relecture et la PR restent obligatoires dans les règles de l'équipe.
- Les mises à jour, labels, issues, PR et CI ne sont déclarés terminés qu'après vérification. Le [relevé de publication](../planning/publication-github.md) conserve les preuves et les éventuelles limites.
- Les mentions d'ouverture publique dans les PDF et les anciens objectifs sont conservées comme historique, avec cette décision comme adaptation actuelle. Une éventuelle évolution ultérieure de visibilité nécessiterait une nouvelle décision de PAN.

Cette décision porte sur la visibilité et l'accès. Elle ne change pas les responsables, le périmètre T01 à T07, les exigences de relecture ou les limites du wallet de démonstration.

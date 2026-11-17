# 0007 | Socle d'exécution de l'API

- Date : 7 novembre 2026, Dakar.
- Tâche : T13, squelette du serveur.
- Responsable : Salam ; relecture : PAN.
- État : proposée dans la PR T13, en attente de relecture.

Les numéros 0004 à 0006 sont pris par les PR #37, #38 et #47.

## Problème

Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf) demande un serveur Node.js et TypeScript, avec des entrées validées, une limitation de débit par appareil et des journaux sans donnée personnelle. Le framework, l'exécution du TypeScript et le format des erreurs restaient à choisir.

## Choix

- **Fastify 5** et le plugin officiel **@fastify/rate-limit**. Fastify valide chaque route avec un schéma JSON (Ajv) et fournit des journaux structurés (pino) dont on contrôle exactement les champs. Le plugin de débit est maintenu par la même équipe.
- **TypeScript exécuté directement par Node 24**, grâce à la suppression des types intégrée. Il n'y a ni étape de compilation ni outil comme `tsx` ou `ts-node`. `tsc --noEmit` vérifie les types, et l'option `erasableSyntaxOnly` refuse la syntaxe que Node ne sait pas retirer.
- **Tests avec `node:test`** et `app.inject()` : aucun port ouvert, aucun réseau et aucune dépendance de test en plus.
- **Champs inconnus refusés** (`removeAdditional: false`) plutôt que retirés en silence. Une faute de frappe côté application devient une erreur visible.
- **Erreurs sous forme de codes stables**, sans texte : l'application les traduit, ce qui respecte la règle des textes dans les ressources de traduction.
- **Limite de débit comptée par adresse réseau**, avec `trustProxy` désactivé. Un identifiant d'appareil envoyé par le client se falsifierait trop facilement ; il pourra s'ajouter une fois l'accès contrôlé défini.

## Solutions écartées

- **Express** : il faut ajouter soi-même la validation (zod, joi…), les journaux et le format d'erreur. Cela fait plus de dépendances pour le même résultat.
- **Hono** : il est léger, mais sa limite de débit et ses journaux structurés reposent sur des modules tiers moins établis.
- **Compiler avec `tsc` ou `tsx`** : c'est une étape ou une dépendance de plus, inutile avec Node 24.

## Conséquences

- Deux dépendances d'exécution (`fastify`, `@fastify/rate-limit`) et deux de développement (`typescript` aligné sur le mobile, `@types/node` 24). `npm audit` ne signale aucune vulnérabilité dans ces ajouts.
- Les imports internes portent l'extension `.ts`, ce qu'exige l'exécution directe par Node.
- Le compteur de débit vit en mémoire. Pour plusieurs instances, il faudra un stockage partagé (Redis), ce que la démo ne demande pas.
- Les routes T17, T19 et T26 réutiliseront le même format d'erreur et les mêmes règles de journal.

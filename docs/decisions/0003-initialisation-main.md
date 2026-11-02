# 0003 | Initialiser main par fusion du socle

- Date : 2 novembre 2026, Dakar.
- Responsable de la décision : PAN, propriétaire du dépôt.
- Périmètre : première fusion squash de la PR #36 uniquement.
- État : autorisation explicite reçue de PAN ; exécution par la PR GitHub.

## Contexte

La branche `main` ne contenait que le README d'initialisation, tandis que le socle T01 à T07 était prêt dans la PR #36. Les 18 tests locaux, le lint, les types, le format, actionlint et Gitleaks ont été vérifiés. GitHub refuse cependant le démarrage de la CI avant les jobs ; Salam n'a pas encore soumis d'approbation.

Le test d'enregistrement du workflow avec la branche complète définie temporairement par défaut a permis d'enregistrer le vrai workflow CI et d'accepter son lancement manuel. L'exécution échoue encore en `startup_failure` : la fusion du code ne peut pas être présentée comme un correctif certain de ce refus.

## Décision

PAN a expressément autorisé la fusion squash du socle comme exception d'initialisation, après avoir été informé de l'absence de CI distante réussie et d'approbation de Salam. La fusion utilise la PR #36 ; aucun push direct, force push ou remplacement de l'historique de `main` n'est nécessaire.

Le dépôt et le Project restent privés. Aucun abonnement ni moyen de paiement n'est modifié. L'exception permet de rendre le socle disponible sur `main` et d'enregistrer ses fichiers de configuration sur la branche par défaut.

## Conséquences

- Cette exception concerne la première initialisation ; elle ne supprime pas les règles de relecture et de CI pour les tâches suivantes.
- Le statut réel de la fusion se vérifie dans la [PR #36](https://github.com/PapaAmad/teranga-pay/pull/36).
- La CI distante, les protections de branche et les alertes de dépendances gardent leurs limites documentées. Aucun résultat vert ou accord de Salam n'est inventé.
- Le refus de démarrage Actions reste à résoudre et T07 demeure ouverte pour cette partie. Le [relevé GitHub](../planning/publication-github.md) conserve le diagnostic.

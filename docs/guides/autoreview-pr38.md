# Autoreview de la PR #38

Revue du 2 novembre 2026, menée après les commentaires de Salam sur les PR #36, #37 et #38. Les correctifs restent proposés dans la PR #38 ; l'autoreview ne remplace pas son approbation humaine.

## Points supplémentaires trouvés

| Risque                                                                     | Correction et vérification                                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Un Project fermé n'apparaissait pas dans la liste et pouvait être recréé.  | Liste incluant les Projects fermés, puis refus explicite avant réutilisation. Test du Project fermé.                             |
| Une liste de 100 Projects ou de 1 000 cartes pouvait être tronquée.        | Comparaison de totalCount avec la liste reçue ; arrêt si incomplet. Tests des inventaires tronqués.                              |
| Un Project public portant le bon titre pouvait être réutilisé.             | Exiger public: false avant de renommer, lier ou modifier le Project ; visibilité inconnue également refusée.                     |
| Une note locale ignorée pouvait déclencher le garde des README GitHub.     | Un même inventaire Git pilote le garde documentaire et les liens. Cas reproduit avec .github/README.local ignoré.                |
| Un fichier suivi mais couvert par .gitignore pouvait échapper au contrôle. | Inventaire git ls-files --cached --others --exclude-standard ; le fichier suivi reste vérifié. Cas reproduit avec un lien cassé. |
| Le mode autonome Project vérifiait les doublons issue par issue.           | Sélection par tâche sur l'ensemble des issues avant modification ; deux issues T06 sont refusées, les PR exclues.                |

## Vérifications croisées

- Les noms historiques des issues, rulesets et Projects passent par une normalisation commune ; plusieurs correspondances provoquent un arrêt explicite.
- Les fichiers générés et les dépendances sont exclus avant leur parcours ; les liens de dossiers ne sont pas suivis.
- Les liens Markdown réels restent contrôlés, y compris avec titre ou parenthèses. Les exemples dans le code ne sont pas considérés comme des liens du document.
- Les six contextes attendus restent présents sur PR : Format, Lint, Types, Tests, Secrets et Titre PR. Le titre est vérifié dans un workflow distinct ; une modification de description n'annule plus les contrôles de qualité.
- La limite de 72 caractères reste celle de l'équipe, y compris pour Dependabot. Le message d'erreur indique comment raccourcir le titre ; aucun faux succès n'est produit pour un titre invalide.

## Limites de validation

Le test des liens symboliques est ignoré sur un poste Windows qui refuse leur création ; il doit être exécuté par la CI Linux. Les résultats précis de chaque commit sont dans les [contrôles de la PR #38](https://github.com/PapaAmad/teranga-pay/pull/38/checks). Aucune CI antérieure ne prouve la validité d'un commit suivant. Les tests de migration des scripts utilisent des données simulées ; aucune modification des règles distantes ni aucun abonnement n'est nécessaire à leur exécution.

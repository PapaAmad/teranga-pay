# 0023 | Consolidation des bases et maintien des suivis

- Décision : 17 novembre 2026 ; documentation : 18 novembre 2026.
- Périmètre : T36, projet de Salam et PAN.
- État : politique autorisée par PAN ; aucune nouvelle approbation formelle de Salam attribuée.

## Constat

Les bases ont été préparées dans plusieurs PR liées. Leur présence dans le même arbre permet de poursuivre l’intégration et ne suffit pas à démontrer le raccordement des écrans au wallet ou à l’API. Les captures des ateliers et les fixtures Maestro restent des preuves de parcours fictifs.

## Décision

Le 17 novembre, PAN a autorisé la fusion des bases sans demander de nouvelles approbations formelles à chaque PR. Cette autorisation décrit la politique de consolidation ; elle ne déclare aucune fusion future effectuée. Le dépôt et le Project restent privés. Chaque fusion conserve une PR, une CI verte vérifiée sur le SHA concerné et un commit squash. L’état distant de `main` a été vérifié : `protected:false`. L’interdiction du push direct reste une consigne de travail ; aucune protection distante activée n’est revendiquée et aucun réglage de visibilité ou de protection n’est modifié.

Les six contrôles locaux restent nécessaires avant un candidat ; un agent n’est pas présenté comme une approbation humaine.

Les diffs propres à chaque tâche sont transportés depuis leur ancien parent identifié. Les conflits réunissent les fonctions présentes et conservent les correctifs déjà validés, sans refermer les défauts reportés par la seule consolidation. Le résultat distant et sa CI sont vérifiés séparément.

## Suivis ouverts

Les issues #88 à #120 regroupent le reste à traiter dans le Project privé. Le [raccordement natif #120](https://github.com/PapaAmad/teranga-pay/issues/120), la [sauvegarde et la logique wallet #10](https://github.com/PapaAmad/teranga-pay/issues/10), la [sécurité #26](https://github.com/PapaAmad/teranga-pay/issues/26), l’[APK #30](https://github.com/PapaAmad/teranga-pay/issues/30) et la [documentation #31](https://github.com/PapaAmad/teranga-pay/issues/31) restent ouverts jusqu’à leurs preuves respectives. Aucun APK publié, paiement natif ou essai Android nouveau n’est déduit d’un test sur fixtures.

## Conséquences

Les README distinguent les bases présentes, la composition restante et les mesures historiques rapportées. Les preuves du wallet, du workflow regtest et des fixtures Maestro gardent leur contexte et leur SHA. Les clés restent destinées au coffre du téléphone ; le retrait Wave/Orange Money reste explicitement simulé.

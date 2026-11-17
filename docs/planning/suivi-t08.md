# Suivi T08 | Identité et composants de base

PAN réalise T08, Salam relit. Le 5 novembre 2026, PAN confirme après leur échange le choix de la direction B « Le courant commun », avec son monogramme entre T et P, le marine et le citron. Ce choix artistique ne constitue pas l’approbation technique de la PR ni une validation par des utilisateurs.

La branche `feat/T08-identite-visuelle` part de la dernière branche T07 au commit `862c493`, selon la demande de PAN. L’issue correspondante est [#3](https://github.com/PapaAmad/teranga-pay/issues/3). Le dépôt reste privé. La publication d’une PR et ses contrôles doivent être vérifiés avant de déclarer la tâche terminée.

| Livrable               | État et portée                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Recherche et direction | Brief PDF, études couleur/accessibilité, benchmark officiel, A/C conservées comme explorations et B retenue.                               |
| Sources graphiques     | Logos SVG, 16 icônes originales, tokens et polices locales avec licences et provenance.                                                    |
| Charte                 | Document HTML, PDF et PNG de présentation ; les maquettes financières restent fictives.                                                    |
| Mouvement              | Le monogramme se trace sur place ; l’introduction de communication est séparée du démarrage mobile.                                        |
| Composants             | Bouton, carte, champ et galerie natifs réutilisables, sans opération de paiement.                                                          |
| Vérification           | Tests de comportement, de contraste et d’intégrité, export Android et revue documentaire ; les preuves et limites sont dans la validation. |

Le front complet reste à développer. L’onboarding, le solde financier, l’envoi, la réception, l’encaissement, l’historique et le retrait simulé ne sont pas livrés par la seule galerie T08. Les rôles de PAN et Salam et les tâches correspondantes restent ceux de la [feuille de route](roadmap.md).

Avant de clôturer : vérifier les contrôles du commit publié, obtenir la relecture de Salam et conduire les essais Android restant nécessaires. Les tests de reconnaissance des icônes, le texte agrandi et TalkBack ne sont pas annoncés comme effectués sans leur compte rendu.

Voir le [dossier design](../design/README.md), les [sources de marque](../../assets/brand/README.md) et le [relevé de validation](../design/validation.md). Commandes locales : `npm run test:tooling`, `npm test -- --ci`, `npm run repo:check`.

Le 7 novembre, les six remarques de Salam sur la PR #47 sont traitées : polices latines allégées, accueil défilable, vérifications des cibles et du chargement, montant insécable, retour automatique aux polices prêtes et contrôle strict des polices vidéo. La branche T08 est remise au-dessus de T07 corrigée au commit `8d10132`. Les preuves locales et les limites sont consignées dans la validation ; l’approbation du nouveau commit reste à obtenir.

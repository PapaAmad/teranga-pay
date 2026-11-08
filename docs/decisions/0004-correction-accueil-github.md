# 0004 | Corriger l'accueil GitHub par la PR #37

- Date : 2 novembre 2026, Dakar.
- Périmètre : fusion de la PR #37 uniquement, suivi T07.
- État : autorisation explicite de PAN, fusion déjà effectuée.

## Contexte et décision

GitHub présentait `.github/README.md` à la place du README du projet. La PR #37 a déplacé ce guide vers `.github/GUIDE.md` et ajouté un garde contre cette régression. La CI distante était encore bloquée et Salam n'avait pas approuvé.

PAN a autorisé séparément cette fusion avec la réponse « Oui, fusionner la correction du README ». L'autorisation de la décision 0003 ne couvrait que la PR #36 ; elle n'a pas été étendue implicitement. La PR #37 a été fusionnée au commit `31c94ab16de3e863276ffc076beec643497d9d24`.

## Conséquences

- Cette exception ne modifie pas les règles des PR suivantes.
- La PR #37 ne comportait pas de lien de clôture d'issue ; cet écart n'est pas présenté comme conforme à la règle habituelle. T07 reste suivie dans l'issue #2 et la PR #38 porte `Closes #2` sans clôture anticipée.
- Les remarques reçues après fusion sont corrigées dans la PR #38 ; l'historique des fusions n'est pas réécrit.
- Le dépôt et le Project restent privés. Une review commentée ne constitue pas une approbation humaine.

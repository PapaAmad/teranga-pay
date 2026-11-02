# Scripts du dépôt

`check-repository.mjs` vérifie la documentation de chaque dossier maintenu et les liens relatifs Markdown. Le dossier réservé `.github` utilise `GUIDE.md` ; le script refuse un README à cet emplacement, car GitHub l'afficherait à la place du README principal. Lancer `npm run repo:check` depuis la racine.

`github/` contient la préparation du dépôt distant, ses réglages, labels et issues. Ces outils restent en prévisualisation tant qu'une application explicite n'est pas demandée.

# Règles communes aux agents | Teranga Pay

## Contexte et périmètre

- Lire [docs/README.md](docs/README.md), les deux sources PDF et le suivi des tâches avant une nouvelle intervention.
- PAN (`PapaAmad`) porte le dépôt, l'application, le design et la passerelle simulée. Salam (`AliouneKane`) porte Lightning, le wallet, l'API et la sécurité. Respecter les responsables du plan.
- Le socle initial couvre T01 à T07. Les emplacements futurs ne constituent pas des services implémentés.
- Travailler dans le périmètre de la tâche. Documenter les choix structurants dans `docs/decisions/`.

## Git et relecture

- Ne jamais pousser directement sur `main`. Utiliser une branche `type/Txx-description`.
- Une tâche = une issue = une branche = une PR. Commits et titres : `type(zone): description`, 72 caractères au maximum.
- Remplir le modèle de PR et lier l'issue avec `Closes #N`. La partie « En clair » comprend trois à cinq phrases simples expliquant le changement et les limites.
- Faire relire par l'autre membre, résoudre les conversations et attendre une CI verte avant fusion squash. Un agent ne remplace pas l'approbation humaine.
- Signaler et justifier toute nouvelle dépendance dans la PR. Ne jamais inventer un résultat de test ou prétendre qu'un réglage distant est appliqué lorsqu'il est seulement préparé.

## Qualité

- Utiliser `|` comme séparateur dans les titres et les libellés. Écrire les plages de tâches avec « à » et les dates avec « du ... au ... » ; conserver les tirets nécessaires à la syntaxe du code et aux commandes.
- Avant de proposer un commit : `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test -- --ci`, `npm run test:tooling`, `npm run repo:check`.
- Tester la logique ajoutée avec des cas qui échouent si son comportement est faux. Pour les écrans, fournir une capture ou une vérification de parcours adaptée.
- Chaque dossier source maintenu contient un court `README.md` : rôle, contenu, commande utile et tâche ou responsable si pertinent. Le dossier réservé `.github` utilise `GUIDE.md` : ne pas y créer de fichier `README`, qui masquerait le README principal sur GitHub. Les dossiers générés sont exclus.
- Garder le lockfile npm à jour. Ne pas ajouter Nx, Turbo, backend, SDK Lightning ou infrastructure exécutables sans tâche correspondante.

## Sécurité

- Aucun secret, phrase de récupération, PIN réel, clé, numéro personnel ou donnée privée dans le code, les tests, les exemples ou les journaux. Utiliser des `.env` ignorés et des exemples neutres.
- Valider les entrées externes. N'utiliser que les bibliothèques Bitcoin/Lightning retenues par la décision T10.
- L'architecture cible conserve les clés du wallet dans le coffre sécurisé du téléphone. Le repli LND côté serveur nécessite une décision explicite et la documentation de sa garde des clés.
- Regtest uniquement pour la démonstration. Cash-out Wave/Orange Money explicitement simulé. Ne jamais présenter une simulation comme un transfert réel.

## Interface

- Tous les textes visibles viennent des ressources de traduction. Le petit catalogue français du socle prépare T09 ; il ne constitue pas encore le système français/wolof complet.
- Afficher les montants en FCFA d'abord, employer des mots simples et prévoir les états de réseau faible dans les tâches concernées.
- Conserver des libellés accessibles et des cibles tactiles utilisables sur Android modeste.

## Incertitudes

- Consulter les documents et le code avant de supposer. Poser une question si une décision produit, un compte, un secret ou une autorisation indispensable manque ; continuer les travaux indépendants.

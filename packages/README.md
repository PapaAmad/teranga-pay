# Packages partagés

Emplacement des modules réutilisables entre l'application et les futurs services. PAN et Salam valident ensemble les interfaces communes.

Le premier module est [contracts](contracts/README.md), introduit en T11 : interface `Wallet`, types, conversions de montants et faux wallet pour les écrans. Un dossier n'entre dans les workspaces npm qu'après l'ajout de son `package.json` et de sa configuration de vérification.

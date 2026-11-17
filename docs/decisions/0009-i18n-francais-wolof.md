# 0009 | Traduction de l’application et préparation du wolof

- Date : 7 novembre 2026, Dakar.
- Tâche : T09, PAN ; relecture Salam.
- État : proposition à relire dans la PR T09.

## Besoin

Le catalogue français du socle centralise les textes, mais les écrans lisent directement ses propriétés. Ce fonctionnement ne permet pas de changer de langue en conservant le parcours ouvert. [T09](https://github.com/PapaAmad/teranga-pay/issues/4) demande une infrastructure prévoyant français et wolof, avec tous les textes existants issus de clés.

Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), page 11, exige une relecture native avant publication de textes wolof. Cette livraison prépare leur emplacement ; la traduction et sa relecture restent T33. Le choix de langue dans l’onboarding appartient à T14.

## Décision

Utiliser **i18next 27.0.0** et **react-i18next 18.0.0** dans le workspace mobile. Le premier résout les clés, paramètres et replis ; le second actualise les composants à travers un contexte React. Les versions vérifiées acceptent React 19 et TypeScript 6. Le lockfile conserve les versions réellement installées.

Le français est chargé localement et reste la langue initiale. Le catalogue wolof est vide et partiel, avec un repli français explicite pour chaque clé manquante ou vide. Aucune ressource de traduction n’est téléchargée à l’ouverture. Les appels utilisent des clés typées à partir du catalogue français.

Chaque instance peut être créée séparément : les tests n’ont pas à partager un état global mutable. Le contexte couvre aussi les titres de navigation et les messages de chargement des polices. Un changement de langue actualise les textes sans recréer la navigation ni effacer une saisie locale.

Le catalogue wolof préparé ne rend pas l’application bilingue. Aucun choix « Wolof » n’est proposé comme disponible avant T33. T14 pourra utiliser l’instance et le contexte pour le choix de langue ; la détection du téléphone et la persistance de ce choix ne sont pas ajoutées ici.

## Alternatives et conséquences

Un moteur écrit pour le projet imposerait de maintenir nous-mêmes la résolution des clés, les replis et les notifications React. Des lectures directes de `fr` conserveraient le défaut de départ. Les deux dépendances retenues apportent ces fonctions sans module natif, SDK wallet ni service réseau supplémentaire.

Les ressources restent dans `apps/mobile/src/translations/`, avec un README expliquant l’ajout d’une clé et les limites du wolof. Les tests vérifient l’intégration réelle, le repli, les instances isolées et la conservation du parcours. Un contrôle du code mobile aide à refuser les textes littéraux visibles et les imports directs de catalogue hors du moteur ; il ne prétend pas effectuer une analyse complète de tous les chemins de données.

Le garde importe l’API du compilateur TypeScript depuis un script de la racine. La racine déclare donc directement **TypeScript 6.0.3** en dépendance de développement, sans dépendre de la remontée du paquet du workspace mobile. Le lockfile conserve le même paquet et la même version ; cette déclaration n’ajoute aucun paquet ni module natif.

## Branche et validation

Le travail `feat/T09-i18n-francais` a commencé sur T08 au commit `0813303`, encore dans la PR #47. La fusion squash de T07 le 8 novembre a été suivie du rebase des seuls commits T08, puis T09, sur leur parent actualisé. La PR T09 cible T08 tant que celle-ci n’est pas fusionnée. Après fusion squash de T08, rebaser les seuls commits T09 sur `main`, changer la cible et relancer les contrôles.

La création d’une PR et une CI verte ne remplacent pas la relecture de Salam. Le [suivi T09](../planning/suivi-t09.md) conserve les preuves et les limites de la livraison.

Sources : [types i18next](https://www.i18next.com/overview/typescript), [replis](https://www.i18next.com/principles/fallback), [contexte React](https://react.i18next.com/latest/i18nextprovider). Versions et dépendances vérifiées dans le registre npm le 7 novembre 2026.

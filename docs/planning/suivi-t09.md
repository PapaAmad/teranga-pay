# Suivi T09 | Traduction et textes français

PAN réalise T09 ; Salam relit. L’issue est [#4](https://github.com/PapaAmad/teranga-pay/issues/4). Les critères sont le support prévu pour français/wolof et l’emploi de clés pour tous les textes visibles existants.

Le travail T09 a commencé sur le commit T08 `0813303`, avec la PR #47 encore ouverte. Après la fusion squash de T07 par la PR #38 le 8 novembre, les seuls commits T08 puis T09 ont été rebasés sur leur parent actualisé. T09 conserve les fondations graphiques en cours de revue et cible T08 tant que #47 reste ouverte. La [décision 0009](../decisions/0009-i18n-francais-wolof.md) explique le moteur, les dépendances et le repli.

## Portée

- Ressources françaises chargées localement, clés typées et paramètres de traduction.
- Catalogue wolof prévu, vide et partiel ; repli français explicite. Aucune traduction wolof ni validation linguistique annoncée.
- Textes des écrans, navigation et états de chargement reliés au contexte de traduction.
- Contrôle des textes en dur, tests de repli et de mise à jour sans perte du parcours ou de saisie.

Le choix de langue de l’onboarding et sa persistance restent T14. Les traductions wolof relues restent T33. Les écrans financiers et les paiements ne sont pas implémentés par cette tâche.

## Vérifications

Les tests mobiles comprennent 43 cas réussis : parcours existants, repli français sur une valeur manquante, vide ou nulle, préférences régionales ou inconnues, interpolation du nom dans le chargement, l’accueil et la présentation, isolation et changement de langue sans perte de saisie. TypeScript vérifie aussi les refus de clés inconnues, de paramètres d’interpolation manquants et de feuilles de catalogue non textuelles. Les tests de types ne sont pas présentés comme des tests Jest supplémentaires.

Les outils comprennent 113 tests : 112 réussis et un lien fichier ignoré faute de permission Windows. Les 19 cas du garde T09 exercent les textes JSX, propriétés visibles et accessibles, titres de navigation, messages et boutons natifs, imports directs de catalogue et syntaxe invalide. Le contrôle courant analyse 14 fichiers mobiles sans diagnostic. Sa limite reste l’absence d’analyse complète des flux de données, des alias de valeurs et des fonctions arbitraires.

La reprise des commentaires de Salam complète `aria-label`, `children`, `tabBarLabel`, `accessibilityValue.text`, `Alert.alert` et les messages de `ToastAndroid`. Les imports de catalogue avec extension JavaScript sont aussi refusés. La collecte ne masque plus les sous-dossiers fonctionnels nommés `tests` ou `translations` ; seules les ressources et fixtures réellement placées aux chemins exclus le sont. TypeScript est déclaré directement à la racine, au même numéro de version que le paquet déjà verrouillé.

Les options `returnNull` et `returnEmptyString` redondantes avec i18next 27 sont retirées, avec tests de repli sur une valeur vide ou nulle. `load: 'languageOnly'` reste intentionnel : le défaut du moteur est `all`. Le composant d’entrée `RootApp` reste nécessaire, car `registerRootComponent(App)` produit une erreur TS2345 entre les `InitialProps` d’Expo et la prop d’injection `i18n` ; aucun cast n’est utilisé pour masquer ce contrat.

La relecture indépendante ne relève pas d’autre défaut actionnable. L’audit npm avant/après retrouve les mêmes 27 alertes, dont 9 faibles, 16 modérées et 2 élevées, sans nouveau paquet affecté. Les deux dépendances directes ajoutent seulement `html-parse-stringify` en transitif ; aucun module natif supplémentaire.

L’export Android hors connexion réussit avec Metro et Hermes : 988 modules, un bundle de 2,2 Mo et les trois polices locales conservées. Il vérifie la production du bundle et ses ressources ; aucun APK installé ni rendu sur téléphone n’est déduit de cet export.

La CI doit couvrir le commit effectivement publié ; une CI parent T08 ne la remplace pas. Une simulation Jest et un bundle ne valent pas essai sur appareil ni relecture native du wolof. Les résultats distants sont attachés au SHA dans la PR, sans modifier le commit pour lui attribuer sa propre preuve.

Commandes : `npm run i18n:check`, `npm test -- --ci`, `npm run test:tooling`, `npm run repo:check`. Guide d’ajout des textes : [translations](../../apps/mobile/src/translations/README.md).

T09 reste ouverte pour les contrôles du commit publié et la relecture de Salam.

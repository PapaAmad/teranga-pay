# Traductions de l’application | T09

T25 ajoute `withdraw.ts`, enregistré sous `fr.withdraw`. Les noms d’opérateurs,
frais fictifs, confirmations, attentes, réponses perdues et reprises restent
distincts. Aucun texte wolof n’est ajouté. Les logos sont décoratifs : le nom
traduit et l’action gardent leur libellé accessible. La frontière de traduction
du titre T24 est limitée aux clés qu’elle utilise pour éviter une expansion de
types excessive quand le catalogue grandit, sans retirer les contrôles de clés.

T24 ajoute `history.ts`, enregistré sous `fr.history` : filtres, reçus,
incertitude, pagination, montants inconnus et qualification de simulation.
Les dates portent une année ; « Date de l’opération » ne prétend pas dater le
règlement. Les textes de partage utilisent `sourceContext` pour éviter le
paramètre réservé `context` d’i18next. Le catalogue wolof reste vide.

`fr.ts` est le catalogue français canonique. `wo.ts` prépare les mêmes clés sous forme partielle : il reste vide tant que les textes wolof ne sont pas traduits et relus en T33. Le moteur i18next utilise explicitement le français lorsqu’une clé wolof manque ou contient une chaîne vide. Une structure prête pour le wolof ne signifie pas que la traduction est livrée.

`index.ts` initialise les ressources locales sans attente réseau et fournit `TranslationProvider`, `useTranslation`, l’instance `appI18n` et la fabrique isolée `createAppI18n`. Les écrans et la navigation consomment les clés à travers le provider ; ils ne lisent pas directement un catalogue. `i18next.d.ts` fait vérifier les clés et les paramètres par TypeScript. Les textes d’accueil, de présentation et de chargement partagent `appName`, par exemple `t('home.title', { appName: t('appName') })`.

Le français est la langue par défaut. `resolveLanguage` et `setAppLanguage` ramènent les variantes `fr-SN` et `wo-SN` à leur langue de base ; une préférence inconnue revient au français. Un appel direct au moteur avec une variante est aussi résolu par `load: 'languageOnly'` et le repli français, mais `setAppLanguage` est l’entrée recommandée pour une préférence externe. Chaque instance possède ses propres ressources : les fixtures de tests ne modifient pas les catalogues de production.

La sélection visible et sa persistance sont maintenant préparées dans le
[parcours T14](../onboarding/README.md). Seul le français est sélectionnable ;
le wolof reste annoncé comme à venir jusqu’à T33. La détection automatique de la
langue du téléphone n’est pas ajoutée. Aucun texte wolof non relu n’est publié et
aucun service de traduction distant n’est appelé.

Ajouter un texte dans le français, employer sa clé avec `useTranslation`, puis renseigner le même chemin dans `wo.ts` après validation linguistique. Éviter les phrases assemblées par concaténation ; utiliser les paramètres du moteur. Les montants FCFA gardent leurs espaces insécables U+00A0.

T20 organise ses libellés dans `send.ts`, importé par le catalogue canonique sous
`fr.send` ; les écrans continuent de lire `t('send.…')` via le contexte. Les
plafonds de frais, l’action explicite après PIN, les erreurs de saisie et les
résultats incertains gardent des mots distincts. Le texte de l’atelier précise
qu’aucun paiement réel n’est effectué ; les messages ne donnent pas un timeout
pour un échec confirmé.

`native.json` contient le texte système français de permission caméra. `fr.ts`
l’expose sous `native` et `app.config.ts` lit la même ressource au build pour le
plugin Expo Camera. Les composants ne lisent pas ce JSON directement à
l’exécution ; la configuration native ne peut pas employer un hook React.
Modifier cette ressource exige une nouvelle construction pour changer le texte
système installé. Le microphone et l’enregistrement audio sont désactivés dans
ce plugin. Le wolof reste vide jusqu’à sa traduction et sa relecture T33.

T22 ajoute `collect.ts`, importé par `fr.ts` sous `fr.collect`. Le parcours lit
ces clés via `t('collect.…')` : prix demandé, attente, expiration, suivi incertain,
copie, partage et reçu ont des libellés distincts. Le compteur conserve une
valeur consultable sans annonce automatique de chaque seconde ; les changements
d’état restent annoncés séparément.

« Vérifié le » désigne `confirmedAt`, l’instant où T22 observe une preuve de
règlement cohérente. « Confirmation après le délai » ne prétend pas dater
l’envoi du client ou le règlement effectif. Le reçu fictif et son message de
partage gardent cette qualification, sans déclarer qu’un paiement réel a été
exécuté. Aucun catalogue wolof n’est rempli par anticipation.

Les [captures T22](../../../../docs/design/validation-t22/README.md) permettent de
relire ces états en contexte. Le partage du reçu fictif conserve sa qualification
et n’inclut pas la facture ; la capture Web ne prouve pas les annonces TalkBack.

`risk.ts` traduit localement les sept codes T26 et les choix avant PIN T27.
Aucun texte distant n’est affiché. Le score n’est pas présenté comme une
probabilité de fraude et l’indisponibilité ne produit aucun avis rassurant.
La ressource wolof reste vide jusqu’à T33 et sa relecture native.

PAN réalise T09, Salam relit. Commandes : `npm run typecheck`, `npm test -- --ci` ; les tests `i18n.test.tsx` couvrent le repli, l’isolation, les paramètres et le changement de langue au cours du parcours existant. Le titre natif est contrôlé via la prop du composant remplacé par Jest ; son rendu sur Android reste à vérifier. Les essais Android réels et la relecture wolof restent distincts.

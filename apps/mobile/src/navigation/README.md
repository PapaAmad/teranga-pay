# Navigation

`Withdraw` reçoit `withdrawServices` via `App`. Sans service, journal et fabrique
d’UUID composés, l’entrée annonce l’indisponibilité. `WithdrawPreview`, réservé
au développement, conserve son atelier séparé des fournisseurs normaux. Le
service injecté reste stable pendant la session pour partager la barrière de
confirmation entre les écrans ; le journal retrouve l’intention après remontage.
Revenir à l’accueil n’annule pas une demande engagée. PAN a confirmé les écrans T25 le 12 novembre 2026 avant commit et PR ; Salam relit.

`History` ouvre T24 depuis « Tout voir » et reçoit `historyServices` via `App`.
Sans injection propre, il reprend uniquement les lectures du wallet Home ;
aucun journal de retrait n’est inventé. `HistoryPreview`, réservé au
développement, garde ses données et son partage fictifs séparés du contexte
normal. Retour ferme le détail, conserve le filtre de liste puis revient à
l’accueil ; la perte de focus masque le journal. PAN a confirmé les nouveaux écrans le 11 novembre 2026 avant commit et PR.

`RootNavigator.tsx` déclare la pile native et ses titres, lus avec `useTranslation` pour suivre la langue courante. `types.ts` liste les routes et leurs paramètres pour que TypeScript vérifie chaque changement d’écran. La pile reste stable pendant une mise à jour des textes.

La pile démarre sur `Onboarding` et conserve `Home`, `About` et la galerie T08
`DesignSystem`. `Home` utilise l’écran de lecture T16 et un port natif absent par
défaut ; il ne transforme pas cette absence en solde nul.
`OnboardingPreview` et `HomePreview` sont enregistrés uniquement en développement :
leurs données fictives restent séparées de l’entrée normale. La présentation du
projet permet d’ouvrir ces accueils. `initialRoute` et l’injection des services
permettent les vérifications isolées ; ils ne constituent pas une authentification
du wallet. `Receive` ouvre T18 depuis Recevoir ; `ReceivePreview`, réservé au
développement, garde un fournisseur fictif distinct. La perte de focus suspend la
lecture de l’adresse. Sans fournisseur T19, l’entrée normale annonce son
indisponibilité.

`Send` ouvre T20 depuis Envoyer et reçoit son propre `SendServices`, injectable
via `App` et `RootNavigator`. Sans fournisseur T21, il explique l’indisponibilité
au lieu d’inventer une demande. `SendPreview`, réservé au développement, garde
son wallet fictif séparé du contexte normal et propose les scénarios contrôlés.
La perte de focus suspend la préparation et efface la saisie privée ; une
opération déjà soumise conserve sa barrière de session lors du retour et du
remontage avec le même wallet. Quitter l’écran n’annule pas un paiement soumis.
PAN a confirmé les écrans T20 le 10 novembre 2026 avant commit et PR.

`Collect` ouvre T22 depuis Encaisser et reçoit un `CollectServices` propre,
injectable via `App` et `RootNavigator`. L’entrée normale reste indisponible sans
le fournisseur natif capable de lier facture et paiement et de respecter
l’échéance du devis. `CollectPreview`, enregistré seulement en développement,
utilise ses propres fournisseurs fictifs et son horloge contrôlée ; il ne
sollicite jamais le service du contexte normal.

Hors focus, le parcours marchand retire ses informations ; la reprise retrouve
les demandes connues du même wallet sans créer une deuxième facture. Une
confirmation d’une ancienne demande ne valide pas la vente courante. Quitter
l’écran ne promet aucune annulation native. La date du reçu est celle de la
vérification observée par l’application. PAN a confirmé les écrans T22 le
10 novembre 2026 avant commit et PR et autorisé leur publication, en préparation.
La relecture de Salam et la CI distante restent attendues. Les
[captures T22](../../../../docs/design/validation-t22/README.md) et les quatre
parcours de navigation marchands vérifient séparément l’atelier, l’injection,
l’absence de fournisseur et la reprise de la même facture. PAN maintient la
navigation ; Salam relit.
Les aperçus fictifs (`OnboardingPreview`, `HomePreview`, `ReceivePreview`,
`SendPreview`, `CollectPreview`, `HistoryPreview`, `WithdrawPreview`) suivent
`previews.ts` : visibles en développement, ou dans l’APK de démonstration pour
les jurys compilé avec `EXPO_PUBLIC_DEMO_BUILD=1` (T35). L’atelier wallet et son
lien profond restent réservés au développement. Test : `tests/demo-build.test.tsx`.

Lancer `npm test -- --ci` depuis la racine pour vérifier les parcours.

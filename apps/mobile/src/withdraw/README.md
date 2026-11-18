# Retirer en cash | T25

PAN porte le parcours et la passerelle simulée ; Salam relit. `ports.ts` décrit
le service T23, le prix figé et le journal, sans SDK Lightning ni PIN wallet.

`controller.ts` sépare opérateur, montant, devis, confirmation et suivi. Préparer
ne retire rien. Une réponse perdue conserve le même couple devis/UUID ; une
référence connue est relue ou reprise explicitement sans nouvelle réservation.
Le journal doit acquitter son écriture avant la première confirmation.

`journal.ts` fournit AsyncStorage, isolé par un scope opaque de compte authentifié.
Il conserve prix et intention, aucun PIN, téléphone, jeton ou clé wallet. Un
scope ne doit pas être un secret. Les écritures sont sérialisées ; une autre
intention n’est jamais écrasée et l’effacement vérifie la clé attendue. Le prix
expiré reste lisible pour retrouver une confirmation engagée.

La sérialisation du journal couvre les instances d’un même processus. Plusieurs
processus ou onglets concurrents partageraient un stockage sans transaction :
cette composition n’est pas livrée. Le même compte doit conserver le même objet
service pendant sa session ; un changement d’identité exige son scope distinct.

`WithdrawScreen.tsx` réutilise le cadre T20 : action au-dessus du clavier et hors
du défilement. `OperatorLogo.tsx` rend les ressources locales dont la
[provenance est conservée](../../../../assets/operators/README.md). `preview.ts`
est un atelier sans réseau ni argent réel ; le temps seul ne confirme rien.

Sans service, journal et fabrique d’UUID composés, l’entrée normale explique son
indisponibilité. Le jeton reste hors du composant et des variables publiques
Expo. L’écoute loopback T23 demande une composition dédiée pour le téléphone.
L’[ADR 0019](../../../../docs/decisions/0019-retrait-simule-et-reprise.md) explique
les garanties, limites et écarts au PDF. PAN a confirmé les écrans le 12 novembre 2026 avant commit et PR.

Commande : `npm test -- --ci --runTestsByPath tests/withdraw-model.test.ts tests/withdraw-journal.test.ts tests/withdraw-preview.test.ts tests/withdraw-screen.test.tsx`.

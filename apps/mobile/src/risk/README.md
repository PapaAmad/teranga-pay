# Alerte avant envoi | T27

PAN prépare la frontière mobile ; Salam porte les règles serveur T26. `ports.ts` décrit `POST /v1/alerts/payment-check`, sans dépendance au SDK Lightning ni aux modules du serveur.

`assessment.ts` valide la réponse et conserve la décision `confirmationRequired` du serveur. Le téléphone ne recalcule ni seuil, ni poids, ni niveau. Les sept raisons connues restent des codes à traduire ; un code inconnu, une raison dupliquée ou une confirmation sans raison rend l'analyse indisponible.

Le corps contient uniquement le montant en sats, le caractère nouveau du destinataire, le solde, l'heure locale et une vue numérique d'au plus 50 opérations du wallet. Les reçus et les échecs sont exclus ; les attentes comptent pour le rythme, seuls les envois réussis forment les habitudes. Les dates futures sont exclues, le rythme couvre les dernières 24 heures et les habitudes peuvent être plus anciennes. Un historique malformé ou dupliqué est refusé plutôt que remplacé silencieusement par un historique vide. Aucun identifiant, adresse, facture, mémo ou PIN n'est transmis.

`createRiskPort` reçoit le transport de la composition, copie et fige le corps autorisé, puis valide la réponse brute. Les erreurs exposées sont `RISK_INVALID_INPUT`, `RISK_INVALID_RESPONSE` et `RISK_UNAVAILABLE`, sans détail du transport. Aucune URL, clé, persistance ni requête automatique n'est ajoutée dans ce dossier.

Commande utile depuis la racine : `npm test --workspace @teranga-pay/mobile -- --runTestsByPath tests/risk-model.test.ts --ci`.

`RiskNotice.tsx` présente les raisons dans l’ordre reçu et un conseil concret,
avec les signes T08 et les textes T09. L’écran Envoyer porte les décisions,
l’expiration et l’accès au PIN ; ce composant ne déclenche ni analyse ni paiement.

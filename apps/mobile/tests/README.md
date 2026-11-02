# Tests mobiles

`navigation.test.tsx` vérifie un parcours réel : arrivée sur l’accueil, ouverture de la présentation puis retour. Une rupture de route ou un bouton débranché fait échouer le test.

Jest utilise `jest-expo` et les remplacements natifs fournis pour les zones de sécurité. Lancer depuis la racine `npm test --workspace @teranga-pay/mobile -- --ci`. Les tests de paiement et les parcours Maestro seront ajoutés aux tâches correspondantes.

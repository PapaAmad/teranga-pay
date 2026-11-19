# 0024 | Raccordement du coffre, des écrans et de l'API

Date : 18 novembre 2026, vérifications natives le 19 novembre. Tâche commune PAN et Salam : #120. Le guide consigne les preuves Android et les limites liées au temps disponible ; cette décision ne clôture pas #10 ni la remise de l'APK signé #30.

## Besoin

Les bases fusionnées exposaient des ports compatibles, mais l'entrée normale ne les composait pas. Les ateliers sur fixtures ne fournissaient pas le parcours métier avec le coffre Android et le serveur.

## Choix

- Une composition unique partage le wallet LDK regtest entre les écrans. Expo Go et les builds anciens restent indisponibles pour ce parcours ; aucun faux wallet ne les remplace.
- L'arrière-plan verrouille la session, coupe LNURL et annule les requêtes HTTP. Les routes protégées retournent au PIN. Le redémarrage ne crée ni ne restaure automatiquement un coffre.
- Les taux et devis viennent de l'API T17. L'envoi transmet le prix, le taux, l'échéance et le plafond de frais présentés avant le PIN. Le journal note ce prix avant le paiement, sans réécrire le reçu au cours suivant.
- Une vente reste liée au `paymentId` exact et au texte de sa facture. Elle expire au moins une seconde avant le devis ; la borne native de 60 secondes impose de refuser une création avec moins de 61 secondes restantes.
- Une capacité d'adresse de 256 bits est enregistrée dans le coffre avant le POST. Le serveur accepte le rejeu du même nom avec cette capacité, sans permettre à un autre jeton de reprendre le nom. Une réponse perdue ne perd donc pas l'adresse.
- Les jetons restent dans un fichier privé chiffré AES-GCM par l'Android Keystore et lié au coffre. AsyncStorage ne contient que préférences et métadonnées de simulation, sans jeton, PIN ou phrase.
- La passerelle utilise le compte de démonstration `demo-client-a` et un solde entièrement simulé. Le journal est isolé par nœud, origine d'API et compte, indépendamment de la rotation du jeton. Changer d'origine constitue un autre périmètre de journal.
- Le provisionnement du jeton simulé est réservé au build débogable et passe par ADB/stdin depuis un fichier ignoré. L'import chiffre puis efface le fichier privé temporaire. Aucun jeton n'est inclus dans les paramètres publics Expo ou dans l'APK.

## Limites conservées

La phrase initiale est remise une seule fois après création, même si le démarrage du nœud échoue. Cela permet de noter la sauvegarde sans recréer le coffre ; la récupération authentifiée après interruption reste suivie dans #10. L'adresse exige un téléphone ouvert et déverrouillé. La passerelle ne débite aucun vrai wallet et ne contacte aucun opérateur. Une preuve sur doubles de test ne constitue pas une preuve Android : voir le [guide de raccordement](../guides/raccordement-application.md) pour les résultats effectivement observés.

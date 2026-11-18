# 0020 | Alerte explicable et décision avant le PIN

12 novembre 2026 | T27 | écrans confirmés par PAN avant publication ; décision à relire par Salam.

## Problème

T20 présente le paiement avant son PIN. T26 fournit un score explicable, mais un
score ne prouve pas une fraude et le serveur ne peut pas bloquer seul le wallet.
Il faut demander un accord compréhensible sans faire passer une panne pour une
analyse réussie ni créer une deuxième remise d’envoi.

## Choix

Utiliser un port T26 injecté dans `SendServices`, avec le chemin
`POST /v1/alerts/payment-check`. Le transport authentifié reste à composer avec
Salam : aucune URL de service, clé ou valeur secrète n’est embarquée dans T27.
Le mode normal demeure indisponible tant que le wallet natif n’est pas relié.

Construire le corps depuis le montant vérifié, le solde et les 50 dernières
opérations lues localement. Envoyer uniquement nombres et booléen : montant,
nouveau destinataire, montants habituels, âges des envois récents, heure locale et
solde. Exclure reçus, échecs et dates futures des signaux ; les attentes comptent
pour le rythme, les succès pour les habitudes. Cet échantillon borné n’est pas
l’historique complet. Refuser les données malformées plutôt que les remplacer
silencieusement par une activité vide. Aucun identifiant, adresse, facture, mémo
ou PIN ne quitte cette frontière.

Valider la réponse et traduire ses codes localement. Respecter
`confirmationRequired`, indépendamment du score et du niveau. Demander un accord
distinct en cas d’alerte, puis conserver le PIN et l’appui final T20. Annuler ou
modifier la demande, quitter l’écran ou verrouiller le wallet invalide cet accord.
Le devis conserve sa date d’expiration, y compris pendant l’analyse.

Borner la lecture et l’analyse à huit secondes. En cas d’absence de port, erreur,
réponse incohérente ou délai dépassé, proposer annulation, nouvel essai ou choix
explicite de continuer sans analyse. Cela applique la section 7 du document de
conception : un serveur Teranga indisponible ne bloque pas seul Lightning.
Un résultat tardif ne modifie pas le choix et ne déclenche pas un appel suivant.

## Solutions écartées

- Déduire un blocage du niveau ou afficher le score comme probabilité de fraude.
- Continuer automatiquement après erreur, ou présenter un avis « paiement sûr ».
- Dupliquer l’algorithme T26 dans l’application.
- Transmettre le contenu complet du wallet pour faciliter le calcul côté serveur.
- Confondre accord sur l’avertissement, validation du PIN et soumission du paiement.

## Conséquences et limites

La barrière de session T20 et son traitement des résultats inconnus restent en
place. L’accord de l’alerte reste en mémoire et ne survit pas à une fermeture du
processus ; il n’est pas une autorisation serveur ni une garantie antifraude.
Les règles reposent sur une activité locale partielle et ne détectent pas toutes
les arnaques. Les [sources de conception](../design/alerte-recherche.md), les
[états visuels](../design/alerte-direction.md) et le [suivi](../planning/suivi-t27.md)
précisent les preuves exécutées et ce qui reste à intégrer.

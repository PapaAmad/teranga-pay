# Alertes et estimation | emplacement réservé

Salam porte **T26** pour les règles et le score d'alerte fraude, puis **T34** pour l'estimation d'économies souhaitable. PAN relit les règles et réalise l'affichage d'alerte en T27.

Ce dossier ne livre aucun modèle, moteur d'inférence ou endpoint. La séparation en service indépendant reste à décider : les premières règles peuvent vivre dans l'API si cela simplifie le MVP.

Les alertes aideront l'utilisateur à décider sans exécuter de paiement. Elles n'auront jamais accès aux clés ou à la phrase secrète. Documenter ultérieurement les règles, seuils, limites et tests, sans données personnelles.

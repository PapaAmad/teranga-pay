# Alertes et estimation

Salam porte **T26** (alerte fraude) et **T34** (estimation d'économies, souhaitable). PAN relit les règles et réalise l'affichage d'alerte en T27.

Pour le MVP, les règles d'alerte vivent **dans l'API**, sous forme d'un module simple et explicable : [services/api/src/fraud.ts](../api/src/fraud.ts), exposé par `POST /v1/alerts/payment-check`. Les règles, poids et seuils sont décrits dans le [README de l'API](../api/README.md). Aucun modèle d'apprentissage ni service séparé n'est déployé : un service indépendant ne serait justifié que si les alertes demandaient des ressources propres.

Les alertes aident l'utilisateur à décider sans exécuter de paiement. Elles n'ont jamais accès aux clés, à la phrase secrète ni à l'identité de la personne.

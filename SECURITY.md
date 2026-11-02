# Sécurité

Le dépôt est un prototype de hackathon : le socle T01 à T07 ne contient encore aucun portefeuille opérationnel. Les futurs paiements de démonstration utilisent Bitcoin regtest et la passerelle cash-out est simulée.

Le dépôt reste privé et son Project doit l'être dès sa création selon la [décision 0002](docs/decisions/0002-visibilite-privee.md). Cette restriction d'accès ne dispense pas de conserver les secrets hors Git, ni de vérifier les droits de chaque collaborateur.

Ne publier aucun secret, phrase de récupération, PIN réel, clé, fichier de signature ou donnée personnelle. Les fichiers `.env`, les données de nœuds et les fichiers de clés restent hors Git. Les `EXPO_PUBLIC_*` sont intégrés à l'application et doivent être publics.

Pour signaler une vulnérabilité, contacter Salam ou PAN par le canal privé habituel de l'équipe. Si un mécanisme de signalement de sécurité est disponible et activé sur le dépôt, il peut également être utilisé. Ne pas copier de secret dans une issue, même sur ce dépôt privé.

Les rulesets ne sont pas actifs : GitHub renvoie 403 pour ce dépôt privé avec l'offre actuelle. L'analyse native des secrets a été refusée avec une réponse 422 ; la protection native au push n'est pas active. Gitleaks est préparé dans la CI et doit encore être exécuté à distance. Les alertes Dependabot et leurs mises à jour sont activées. Les réponses et leur état exact sont consignés dans le [relevé GitHub](docs/planning/publication-github.md).

Salam porte la revue sécurité T31 ; PAN relit. Le modèle de menace, les restrictions du SDK et les droits Lightning devront être validés avant toute utilisation de fonds réels. La cible conserve les clés sur le téléphone ; tout repli vers LND côté serveur doit expliquer explicitement la garde des clés dans une décision et dans le README.

# Sécurité

Le dépôt reste un prototype de hackathon. Les écrans, le wallet natif, l’API et la passerelle fictive sont présents ; la composition des ports UI avec les services réels reste suivie dans [#120](https://github.com/PapaAmad/teranga-pay/issues/120). Les paiements de démonstration utilisent regtest et les retraits Wave/Orange Money sont simulés.

Le dépôt reste privé et son Project doit l'être dès sa création selon la [décision 0002](docs/decisions/0002-visibilite-privee.md). Cette restriction d'accès ne dispense pas de conserver les secrets hors Git, ni de vérifier les droits de chaque collaborateur.

Ne publier aucun secret, phrase de récupération, PIN réel, clé, fichier de signature ou donnée personnelle. Les fichiers `.env`, les données de nœuds et les fichiers de clés restent hors Git. Les `EXPO_PUBLIC_*` sont intégrés à l'application et doivent être publics.

Pour signaler une vulnérabilité, contacter Salam ou PAN par le canal privé habituel de l'équipe. Si un mécanisme de signalement de sécurité est disponible et activé sur le dépôt, il peut également être utilisé. Ne pas copier de secret dans une issue, même sur ce dépôt privé.

L’état distant de `main` a été vérifié le 18 novembre 2026 : `protected:false`. L’interdiction du push direct reste une règle de travail et aucune protection distante activée n’est revendiquée. Gitleaks figure dans les workflows CI ; son résultat doit correspondre au SHA concerné. Le [relevé GitHub](docs/planning/publication-github.md) conserve les réglages et leurs limites historiques ; cette consolidation ne modifie ni la visibilité ni les protections.

Salam porte la revue sécurité T31 ; PAN relit. La [revue historique du 7 novembre 2026](docs/securite/revue-t31.md) confronte le modèle de menace à l'état des branches et liste les suites. Le modèle de menace, les restrictions du SDK et les droits Lightning devront être validés avant toute utilisation de fonds réels. La cible conserve les clés sur le téléphone ; tout repli vers LND côté serveur doit expliquer explicitement la garde des clés dans une décision et dans le README.

Cette revue n’a pas été rejouée sur l’arbre consolidé. Les suivis [sécurité #26](https://github.com/PapaAmad/teranga-pay/issues/26), [sauvegarde #10](https://github.com/PapaAmad/teranga-pay/issues/10) et [raccordement natif #120](https://github.com/PapaAmad/teranga-pay/issues/120) restent ouverts ; les fixtures UI ne les valident pas. La [décision 0023](docs/decisions/0023-consolidation-des-bases.md) décrit la politique de consolidation.

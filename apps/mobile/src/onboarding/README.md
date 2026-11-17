# Onboarding | T14

PAN porte les écrans et leur orchestration ; Salam porte le coffre et le wallet
natif. `ports.ts` expose la petite frontière requise par l'interface, compatible
structurellement avec T11 sans importer un package encore absent de cette branche.
`controller.ts` orchestre le parcours et fournit `getSnapshot` / `subscribe` pour
l'interface. `preview.ts` crée un aperçu isolé en mémoire, réservé à une entrée de
développement explicite ; ses jetons `exemple01` à `exemple12` ne sont pas une phrase
Bitcoin et ne permettent aucun paiement.

Le PIN de six chiffres et sa confirmation précèdent `create(pin)` : le coffre T15
a besoin du PIN pour protéger immédiatement les mots. La protection d'écran doit
être confirmée et le marqueur non secret `pendingBackup` écrit avant cet appel.
Le petit test porte sur les positions 2, 6 et 10 ; il vérifie la copie des mots,
sans constituer une authentification. Aucun PIN ou mot n'entre dans les préférences.
Seuls la langue, l'avancement et l'indication de sauvegarde sont persistés.

`random.ts` utilise `expo-crypto` 58.0.8 pour mélanger les choix et les leurres du
quiz. Il ne génère aucune graine ni clé de wallet. Le contrôleur prépare les
permutations avant `create` et refuse de créer un coffre si l’aléa est indisponible ;
aucun repli vers `Math.random` n’est utilisé. Les choix restent stables pendant
la vérification, puis sont effacés avec les mots.

Une fin de parcours réussie transmet la session ouverte à l’accueil. Un démontage
prématuré conserve le verrouillage ; le remplacement du contrôleur lors d’un
remontage d’effet ne réutilise pas une instance détruite. Des préférences illisibles
sont ignorées sans valoir autorisation de session.

À la suspension, le contrôleur efface synchroniquement ses secrets et ceux du
snapshot courant, puis demande le verrouillage et la protection reste restrictive.
Une réponse asynchrone devenue périmée ne peut pas ouvrir l'application. Au retour,
un wallet présent exige le PIN même si `state()` renvoie `pret` ; le marqueur
`completed` n'est jamais une autorisation de session.

Les mutations du port wallet sont sérialisées : un ancien déverrouillage et son
nettoyage doivent finir avant une nouvelle tentative. Une interruption après le
marqueur mais avant `create` peut revenir à l’accueil seulement si le port confirme
un wallet absent et qu’aucune création n’est encore en vol.

Limite d'intégration : T11/T15 ne fournissent actuellement ni reprise des mots
après arrêt du processus ni état natif de sauvegarde. Un wallet présent sans
preuve de sauvegarde, ou une création interrompue, reste donc bloqué. Le contrôleur
ne détruit jamais le coffre pour recommencer. Le branchement réel attend une
reprise authentifiée validée avec Salam, une protection native dont le succès est
confirmé après la pose effective du drapeau, et les essais Android. La restauration
reste prévue dans le port T11 mais n'est pas exposée par ce premier parcours.

Commande utile : `npm test --workspace @teranga-pay/mobile -- --runTestsByPath tests/onboarding-controller.test.ts`.

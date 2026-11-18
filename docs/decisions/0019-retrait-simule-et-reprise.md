# 0019 | Retrait simulé, confirmation et reprise durable

- Date : 12 novembre 2026, Dakar.
- Tâche : [T25, issue #20](https://github.com/PapaAmad/teranga-pay/issues/20), PAN ; relecture Salam.
- État : écrans confirmés par PAN le 12 novembre 2026 avant commit et PR ; publication autorisée.
- Base : T24 `24a871f`, [PR #77](https://github.com/PapaAmad/teranga-pay/pull/77), conservée pendant sa relecture.
- Service : T23 `c0b8b40975e623c685c1f48d1ba6968a23a21907`, [PR #75](https://github.com/PapaAmad/teranga-pay/pull/75), vérifié séparément.

## Contexte et écarts aux sources

La conception, pages 8, 10 et 11, prévoit un retrait simulé avec choix de
l’opérateur, frais et confirmation. Le plan confie T25 à PAN, relecture Salam.
La [recherche](../design/retirer-recherche.md) et la
[direction](../design/retirer-direction.md) motivent la présentation.

Le PDF prévoit un PIN, illustre des frais déduits du montant et assimile un délai
dépassé à de l’argent inchangé. T23 utilise un compte fictif distinct du wallet,
sans autorisation de dépense wallet. T25 demande donc une confirmation explicite
du **retrait simulé**, sans solliciter le PIN personnel ni présenter un faux
contrôle comme une protection réelle. Une dépense wallet nécessiterait un autre
contrat et une décision de sécurité ; cet écran ne l’autorise pas.

Le montant saisi est destiné au compte de démonstration ; **100 FCFA de frais
fictifs s’y ajoutent**. Le total apparaît avant confirmation. Ce n’est le tarif
commercial d’aucun opérateur. Une réponse manquante garde une issue à vérifier,
sans affirmer que les fonds n’ont pas bougé.

## Prix et validation

Seuls `wave` et `orange_money`, avec `wave-demo-001` et `orange-demo-001`, sont
acceptés. Aucun téléphone n’est saisi. Les entiers de 1 à 5 000 000 FCFA admettent
les groupes français réguliers, sans décimales ou groupes ambigus. Simulation,
identité, arithmétique entière, dates et durée d’au plus cinq minutes sont
vérifiées avant présentation. Préparer un prix ne confirme rien ; le premier
appel exige un prix valide et un solde fictif suffisant, sans utiliser Home.
Les frais en sats sont la différence entre conversions arrondies du total et
du principal, pas la conversion indépendante des 100 FCFA.

## Journal avant effet et reprise

Avant le premier POST, un journal isolé par compte acquitte prix et UUID
d’idempotence. Une panne d’enregistrement empêche la soumission. Une autre
intention n’est pas écrasée ; la clé n’apparaît pas dans le snapshot d’écran.
Un prix expiré reste lisible : T23 recherche le retrait engagé avant l’expiration.

Une réponse perdue sans référence connue se retrouve avec **le même devis et le
même UUID**, même après expiration. Un conflit ne permet d’adopter sa référence
qu’après lecture et validation exacte du prix ; le même montant ne suffit pas.
Charger le journal ne confirme pas automatiquement un nouveau retrait. Une
référence connue est relue ; la reprise volontaire conserve cette identité sans
nouvelle réservation.

Une barrière par objet de service est posée avant toute attente asynchrone ; le
journal assure la reprise au-delà du composant. L’incertitude interdit une autre
intention. Un état terminal reste stable. Préparer un autre retrait exige une
action explicite et un effacement acquitté avec la clé attendue. Une panne
conserve le suivi précédent. Perdre la base SQLite ou le journal client sort des
garanties. La séparation effective des comptes relève de la composition.

La file AsyncStorage sérialise les instances d’un même processus, pas plusieurs
processus ou onglets simultanés. Cette dernière composition demanderait un
stockage transactionnel ; elle n’est pas proposée ici. Le compte conserve un
objet service stable pendant la session et change de scope lors d’un changement
d’identité.

## Confidentialité, composition et limites

`WithdrawServices` injecte service, journal et fabrique d’UUID. AsyncStorage reçoit
un scope opaque de compte, jamais un jeton, téléphone ou identifiant personnel.
Le journal ne contient aucun secret ou PIN et n’imprime pas son contenu ; les
erreurs sont sanitisées. Le jeton reste hors du composant et du bundle public.
Le réseau Expo ne rend pas l’écoute loopback T23 accessible au téléphone.
Aucun adaptateur HTTP de production ou CORS permissif n’est ajouté. Sans
composition, l’entrée normale explique l’absence du fournisseur ; l’atelier
reste isolé des services normaux.

Perte de focus et arrière-plan masquent les données sans annuler une demande.
Le statut métier détermine le résultat, pas le seul code HTTP. Les logos
identifient les opérateurs tout en conservant la qualification de simulation ;
leurs sources et droits sont distincts de ceux de Teranga Pay.

Le [suivi T25](../planning/suivi-t25.md) consigne les vérifications exécutées.
Processus locaux et Web ne remplacent pas TalkBack, clavier et reprise sur
téléphone. PAN a confirmé les écrans avant commit et PR ; Salam relit le diff et
une CI verte reste nécessaire avant fusion squash.

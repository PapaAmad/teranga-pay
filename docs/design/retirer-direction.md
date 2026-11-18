# Retirer T25 | Direction et états

Projet de Salam et PAN, proposition du 11 novembre 2026. PAN conçoit T25 et
Salam relit. La direction prolonge T08 et les parcours FCFA existants selon la
[recherche](retirer-recherche.md). PAN a confirmé les nouveaux écrans le 12 novembre 2026 avant commit et PR. Les
[27 captures](validation-t25/README.md) montrent les composants Web ; elles ne
prouvent pas une validation native.

## Entrée et préparation

« Retirer en cash » doit être identifiable depuis l’accueil sans faire passer le
solde fictif de la passerelle pour le solde personnel du wallet. Le libellé
« Simulation » apparaît dès l’entrée et reste visible dans le parcours. Les
trois actions principales Recevoir, Envoyer et Encaisser gardent leur hiérarchie.
L’icône Retirer appartient à la famille originale T08 et accompagne son texte.

Le premier écran choisit Wave ou Orange Money ; le suivant saisit le montant
en FCFA. Le choix est explicite ; les noms restent lisibles sans dépendre de
logos ou de la couleur. Les ressources locales gardent le pingouin Wave et
les deux flèches orange et noire d’Orange Money, avec leur provenance. La destination de démonstration est connue pour chaque
opérateur : aucune saisie de numéro personnel n’est ajoutée. Une aide courte
explique que le parcours ne crédite aucun compte réel.

Le montant saisi représente le montant destiné en simulation. Son étiquette
reste visible et l’erreur lui est associée. Les champs, aides et messages peuvent
défiler ; la commande qui prépare le devis reste dans le bandeau adapté au
clavier. Le bouton n’envoie aucun retrait pendant cette préparation.

## Récapitulatif et confirmation

Le récapitulatif marine donne d’abord le montant destiné en FCFA. Les lignes
opérateur, destination fictive, frais et total permettent une lecture rapide.
Les sats restent secondaires. Les **100 FCFA fictifs** sont présentés comme
une règle de démonstration et s’ajoutent au montant destiné. L’interface ne
reproduit pas la soustraction illustrative du PDF ni un tarif commercial.

La validité du devis reste visible ; l’utilisateur peut revenir corriger les
données avant confirmation. Un devis expiré ne se confirme plus. Son
renouvellement ne crée pas d’opération et exige une nouvelle lecture du coût.
La confirmation finale nomme le retrait simulé. Aucun PIN de façade n’est
présenté comme une autorisation wallet.

L’action principale reste fixe hors du défilement. Les cibles visent au moins
48 × 48 dp ; aucun montant n’est coupé ou remplacé par une ellipse. Les petits
écrans et le texte agrandi peuvent empiler les lignes sans changer leur ordre
de lecture. Le fond citron signale la simulation avec un texte sombre ; il
ne devient pas une couleur de réussite.

## Résultat et reprise

Après confirmation, la source de vérité est la réponse métier et sa référence,
pas le code HTTP seul ou un délai local. L’attente et l’incertitude restent
distinctes du succès. Une demande engagée n’est pas remplacée par une nouvelle
à la suite d’un double appui, d’un retour à l’accueil ou d’une réponse perdue.

« Vérifier » relit la demande engagée. La reprise explicite conserve sa même
référence et utilise le mécanisme idempotent T23 ; elle ne s’intitule pas
« Nouveau retrait ». Un échec confirmé et un résultat incertain ont des
explications différentes. Les fonds fictifs réservés ne sont pas annoncés
comme libérés tant que la source ne le confirme pas.

Un succès porte « Retrait simulé terminé » ou un libellé équivalent. Son
récapitulatif conserve opérateur, montant, frais, total et référence sans
affirmer qu’un agent a remis du cash. Le détail est compatible avec le journal
simulé T24, qui reste séparé des paiements du wallet. Quitter l’écran n’est pas
présenté comme une annulation distante.

## États à vérifier

| Situation                       | Présentation et prochaine action                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Fournisseur absent              | Expliquer l’indisponibilité ; aperçu fictif séparé en développement.                 |
| Lecture des options ou du solde | Chargement nommé ; aucun faux montant nul ni retrait lancé.                          |
| Montant invalide                | Erreur proche du champ et correction connue avant devis.                             |
| Devis disponible                | Montant destiné, frais fictifs, total, opérateur et échéance.                        |
| Devis expiré                    | Confirmation indisponible ; obtenir puis relire un nouveau devis.                    |
| Solde fictif insuffisant        | Expliquer la limite du compte de démonstration sans modifier le wallet.              |
| Confirmation en cours           | État occupé et protection contre les appels répétés.                                 |
| En attente                      | Référence conservée et commande de vérification.                                     |
| Issue incertaine                | Expliquer ce qui reste à vérifier ; reprise de la même demande uniquement.           |
| Échec confirmé                  | État conservé, explication et nouvelle préparation volontaire selon le contrat.      |
| Succès fictif                   | Confirmation qualifiée de simulation et résumé cohérent du devis.                    |
| Lecture ou reprise indisponible | Conserver l’état connu ; ne pas annoncer de réussite ou de libération.               |
| Perte de focus ou arrière-plan  | Masquer les données visibles ; ne pas effacer l’identité d’une demande déjà engagée. |

## Validation à produire

Le parcours doit montrer les deux opérateurs, le montant, le prix avant
confirmation, l’expiration, les erreurs utiles, l’attente, l’incertitude et la
reprise de la même opération. Les tests doivent distinguer préparation et
soumission et exercer doubles appels, réponses tardives et identité conservée.
Une réponse incohérente n’est jamais une preuve de succès.

Les captures devront montrer les vrais composants à 390, 360 et 320 pixels,
avec champs, récapitulatif, résultat et espace réduit. Grand texte, commande
au-dessus du clavier, retour Android, annonces TalkBack, interruption et
fluidité restent des vérifications distinctes à conduire sur téléphone. Un
atelier fictif et un serveur local ne prouvent pas un transfert réel.

Le [suivi T25](../planning/suivi-t25.md) conserve les résultats après exécution.
Tous les textes visibles passent par T09 ; le français sert de repli et le
catalogue wolof reste vide jusqu’à sa traduction et sa relecture T33.

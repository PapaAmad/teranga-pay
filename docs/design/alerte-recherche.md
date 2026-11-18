# Alerte avant envoi | Recherche T27

12 novembre 2026 | PAN | proposition à relire par Salam.

## Besoin du projet

Le document de conception prévoit un avertissement explicable avant un envoi
inhabituel, puis une confirmation par PIN. Il précise que les règles ne décident
pas seules et que les paiements Lightning restent possibles si le serveur est
indisponible : [source](../sources/Teranga_Pay_Document_de_conception.pdf),
sections 4, 7 et 8. Le plan confie l’analyse T26 à Salam et son écran T27 à PAN :
[plan](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), tâches T26 et T27.

T27 prolonge le parcours Envoyer T20. Il n’ajoute ni score local, ni modèle
d’apprentissage, ni blocage du wallet, ni analyse des retraits simulés T25.

## Sources et implications

| Source primaire | Ce qu’elle apporte                                                                                                                                | Application proposée                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [W3C            | Prévention des erreurs financières, 3.3.4](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)                | Donner une occasion de vérifier, corriger ou confirmer avant une conséquence importante.                                 | Garder le montant, le plafond de frais et le destinataire consultables ; demander le PIN après la décision, puis un appui final distinct. |
| [Cranor         | A Framework for Reasoning About the Human in the Loop, UPSEC 2008](https://static.usenix.org/events/upsec08/tech/full_papers/cranor/cranor_html/) | Distinguer attention, compréhension et capacité d’agir ; employer des messages compréhensibles et des actions concrètes. | Afficher des raisons traduites, conseiller un contact par un moyen connu et proposer des boutons explicites.                              |
| [W3C            | Usage de la couleur, 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)                                                        | La couleur seule ne suffit pas à communiquer une information.                                                            | Associer l’ambre T08 à l’icône propre au projet, un titre et des phrases ; aucune jauge rouge/verte.                                      |
| [Android        | Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps)                                                      | Cibles tactiles d’au moins 48 dp, contraste et adaptation des textes.                                                    | Conserver les boutons T08, le contenu défilant et le pied fixe T20 ; vérifier les petites largeurs et les grands caractères.              |

Consultées le 12 novembre 2026. Ces sources guident la proposition ; elles ne
mesurent pas son efficacité auprès des utilisateurs de Teranga Pay. Le cadre de
Cranor n’est pas une expérimentation de cet écran et WCAG concerne d’abord le
Web : leur application au mobile est un choix de conception explicité ici.

## Choix de langage

« Prenez un instant » invite à relire sans accuser le destinataire. Les sept codes
T26 deviennent des phrases françaises locales. Le score n’est pas une probabilité
de fraude et n’est donc pas affiché comme un pourcentage. Une réponse sans demande
de confirmation ne promet jamais que le paiement est sûr.

Une analyse absente, invalide, trop lente ou refusée produit « Vérification
indisponible ». L’utilisateur peut réessayer, annuler ou choisir explicitement
de continuer sans analyse. Cette dernière décision ne contourne ni le PIN,
ni l’expiration du devis, ni les refus du wallet.

## Questions à vérifier avec des personnes

- Comprend-on ce qui attire l’attention et comment le vérifier ?
- Distingue-t-on analyse indisponible, avertissement et paiement en attente ?
- Comprend-on que « Continuer avec mon code » ne paie pas encore ?
- Les raisons restent-elles lisibles sur un Android modeste avec TalkBack ?

Ces vérifications et la relecture native wolof T33 restent à faire. Aucun taux
de réduction de fraude ou résultat d’entretien n’est annoncé.

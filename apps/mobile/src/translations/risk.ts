/** T27 | Motifs T26 traduits localement ; aucun texte distant affiché. */
export const riskText = {
  checkingTitle: 'Un instant pour vérifier',
  checkingDescription: 'Nous recherchons des signes inhabituels. Aucun envoi ne démarre ici.',
  warningTitle: 'Prenez un instant',
  warningDescription: 'Cet envoi mérite votre attention. Vérifiez ces points avant de continuer.',
  unavailableTitle: 'Vérification indisponible',
  unavailableDescription:
    'Nous n’avons pas pu analyser cet envoi. Cela ne permet pas de savoir s’il présente un risque.',
  reasonsTitle: 'Ce qui attire notre attention',
  explanation:
    'Ces signes ne prouvent pas une arnaque. Vous gardez le choix d’annuler ou de continuer.',
  adviceTitle: 'Vérifiez avec la personne',
  advice:
    'Contactez-la par un moyen que vous connaissez. Prenez votre temps, même si l’on vous presse.',
  privacy:
    'L’analyse reçoit des montants et des durées, sans adresse, message ni code de sécurité.',
  unavailableAdvice: 'Vérifiez vous-même le destinataire et le montant, ou réessayez l’analyse.',
  cancel: 'Annuler l’envoi',
  continue: 'Continuer avec mon code',
  continueUnavailable: 'Continuer sans analyse',
  retry: 'Réessayer l’analyse',
  pinNotice:
    'Vous avez choisi de continuer après l’avertissement. Relisez le montant avant d’envoyer.',
  pinUnavailableNotice:
    'Vous avez choisi de continuer sans analyse. Vérifiez une dernière fois votre envoi.',
  reasons: {
    NOUVEAU_DESTINATAIRE: 'Vous n’avez encore jamais envoyé à ce destinataire.',
    MONTANT_INHABITUEL: 'Ce montant est plus élevé que vos envois habituels.',
    MONTANT_TRES_INHABITUEL: 'Ce montant est beaucoup plus élevé que vos envois habituels.',
    GROS_MONTANT: 'Ce montant dépasse le repère de vigilance du service.',
    RYTHME_ANORMAL: 'Vous avez lancé plusieurs envois récemment.',
    PRESQUE_TOUT_LE_SOLDE: 'Cet envoi utilise presque tout votre solde disponible.',
    HEURE_INHABITUELLE: 'Cet envoi est préparé pendant la nuit.',
  },
} as const;

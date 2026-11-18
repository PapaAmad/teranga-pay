/** T28 | Délai dépassé n'est ni une preuve de hors ligne, ni un échec financier. */
export const reliabilityText = {
  readTitle: 'La lecture prend trop de temps',
  readDescription:
    'Réessayez la lecture quand la connexion répondra. Aucun envoi ne sera relancé automatiquement.',
  operationTitle: 'Le résultat reste à vérifier',
  journalTitle: 'L’enregistrement prend du temps',
  journalDescription:
    'Le résultat affiché est conservé. Attendez la fin de cet enregistrement avant de préparer une autre demande.',
  operationDescription:
    'La demande est toujours suivie. Ne recommencez pas l’opération ; vous pouvez revenir au portefeuille puis consulter son suivi.',
  storedDescription:
    'Les dernières informations connues restent visibles. Elles ne sont pas forcément à jour.',
  slowReadScenario: 'Lecture trop lente',
  slowSendScenario: 'Envoi sans réponse',
  slowWriteScenario: 'Confirmation sans réponse',
  complete: 'Recevoir le résultat fictif',
} as const;

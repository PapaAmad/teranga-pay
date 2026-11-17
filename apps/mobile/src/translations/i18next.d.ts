import 'i18next';

import type { fr } from './fr';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    returnNull: false;
    strictKeyChecks: true;
    resources: { translation: typeof fr };
  }
}

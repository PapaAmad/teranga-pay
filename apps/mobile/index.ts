import { registerRootComponent } from 'expo';
import { createElement } from 'react';

import { RuntimeApp } from './src/runtime/RuntimeApp';

// Les props système d'Expo ne sont pas des services métier. L'entrée compose
// elle-même les adaptateurs du coffre et de l'API, séparément des ateliers.
function RootApp() {
  return createElement(RuntimeApp);
}

registerRootComponent(RootApp);

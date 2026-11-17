import { registerRootComponent } from 'expo';
import { createElement } from 'react';

import App from './App';

// Expo fournit InitialProps ; le point d’entrée masque ces props à App,
// dont la seule prop optionnelle est l’instance i18n utilisée par les tests.
function RootApp() {
  return createElement(App);
}

registerRootComponent(RootApp);

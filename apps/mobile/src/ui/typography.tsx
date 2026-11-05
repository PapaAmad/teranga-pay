import { createContext, useContext, type ReactNode } from 'react';

import { tokens } from './tokens';

const CustomFontsAvailable = createContext(true);
const systemFonts = { body: undefined, label: undefined, title: undefined };

export function BrandTypographyProvider({
  available,
  children,
}: {
  available: boolean;
  children: ReactNode;
}) {
  return (
    <CustomFontsAvailable.Provider value={available}>{children}</CustomFontsAvailable.Provider>
  );
}

export function useBrandFonts() {
  return useContext(CustomFontsAvailable) ? tokens.fonts : systemFonts;
}

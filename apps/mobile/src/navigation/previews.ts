/**
 * Aperçus fictifs (ateliers T14 à T28) visibles en développement, ou dans l'APK
 * de démonstration destiné aux jurys (`EXPO_PUBLIC_DEMO_BUILD=1`, T35). Ils
 * affichent toujours « Aperçu fictif | aucun paiement réel ». L'atelier wallet,
 * le lien profond et l'atelier visuel restent réservés au développement.
 */
export function arePreviewsEnabled(dev: boolean, demoBuild: string | undefined): boolean {
  return dev || demoBuild === '1';
}

// Lecture directe de `process.env.EXPO_PUBLIC_…` : Expo l'inscrit au moment du build.
export const previewsEnabled = arePreviewsEnabled(__DEV__, process.env.EXPO_PUBLIC_DEMO_BUILD);

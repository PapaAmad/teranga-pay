# Écrans

Les écrans assemblent les composants React Native et appellent la navigation typée. Le hook `useTranslation` lit les clés de `../translations` ; un changement de langue actualise le texte sans réinitialiser les champs ni la route active.

`AboutScreen` décrit le projet, permet de revenir et donne accès à l’accueil normal
T16 ou à son aperçu de développement. `DesignSystemScreen` présente l’identité T08
et les états des composants ; ses interactions restent locales et fictives.
L’accueil de lecture est maintenant dans [home](../home/README.md) et le parcours
initial dans [onboarding](../onboarding/README.md).
PAN porte les écrans ; Salam relit. Lancer `npm run mobile` depuis la racine.

# Release de l’APK | T35

Responsable : Salam ; PAN relit.

Configuration préparée : aucun APK n’a été compilé, signé ou publié pendant la consolidation. Le workflow utilise Java 21 pour rester cohérent avec le SDK58 ; le premier essai autorisé reste un brouillon sous contrôle humain.

- `release-notes.mjs` : calcule la somme SHA-256 de l'APK, lit l'empreinte du certificat de signature (`apksigner verify --print-certs`) et écrit les consignes d'installation et de vérification publiées avec la Release. Testé par `release-notes.test.mjs` (`npm run test:tooling`).

Le workflow [`release.yml`](../../.github/workflows/release.yml) l'utilise. Procédure complète : [guide de publication de l'APK](../../docs/guides/release-apk.md).

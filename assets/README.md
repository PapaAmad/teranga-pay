# 🎨 Visuels

> L'identité de Teranga Pay : logo, couleurs, polices, icônes, illustrations, et les logos des opérateurs pour le retrait simulé.

PAN porte les visuels ; Salam relit.

<p align="center">
  <img src="brand/exports/couverture.png" alt="Couverture de l'identité" width="640">
</p>

|                                    Logo                                     |                                 Icônes                                  |                                      Composants                                      |
| :-------------------------------------------------------------------------: | :---------------------------------------------------------------------: | :----------------------------------------------------------------------------------: |
| <img src="brand/logos/logo-principal.svg" alt="Logo principal" width="200"> | <img src="brand/exports/icones.png" alt="Planche d'icônes" width="240"> | <img src="brand/exports/composants.png" alt="Boutons, cartes et champs" width="240"> |

| Dossier                            | Ce qu'il contient                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [brand](brand/README.md)           | L'identité « Le courant commun » : couleurs (`tokens.json`), contraste vérifié, polices, logos, icônes, animations, exports PDF/PNG |
| [operators](operators/README.md)   | Les logos officiels Wave et Orange Money, avec leur provenance (écran Retirer, T25)                                                 |
| [submission](submission/README.md) | Les visuels pour Devpost : captures, couverture, vidéo (T37, T39)                                                                   |

## Comment les visuels arrivent dans l'application

```mermaid
flowchart LR
    T["🎨 brand/tokens.json<br/>couleurs, tailles"] --> UI["apps/mobile/src/ui<br/>boutons, cartes, champs"]
    I["brand/icons/*.svg"] --> UI
    F["brand/fonts"] --> UI
    UI --> E["📱 Tous les écrans"]
```

Changer une couleur dans `tokens.json` la change partout dans l'application. Les contrastes sont recalculés par `npm run brand:build` et vérifiés par `npm run test:tooling`.

Toujours garder les sources modifiables, leur provenance et leurs droits d'utilisation.

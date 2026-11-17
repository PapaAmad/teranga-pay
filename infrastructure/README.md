# 🧪 Infrastructure de démonstration

Réseau de test introduit en **T12** par Salam ; PAN relit. Tout fonctionne en **regtest** : un réseau Bitcoin privé où les blocs sont créés à la demande et où aucun fonds n'a de valeur.

- [lightning](lightning/README.md) : Bitcoin Core regtest, un serveur Electrum et deux nœuds LND (`lnd-teranga`, `lnd-diaspora`), décrits dans `lightning/compose.yaml`.
- [seed](seed/README.md) : initialisation reproductible (fonds de test, canal, paiement de vérification) et personnages fictifs.

```mermaid
flowchart LR
    subgraph Docker["🐳 docker compose (regtest)"]
        BTC[("⛓️ bitcoind<br/>grand livre de test")]
        EL["🔎 electrs<br/>guichet Electrum"]
        LT["⚡ lnd-teranga<br/>Sénégal, fournisseur de liquidité"]
        LD["⚡ lnd-diaspora<br/>Ousmane à Milan"]
        S["🌱 seed<br/>préparation relançable"]
        EL --> BTC
        LT --> BTC
        LD --> BTC
        LD <==>|"canal 5 M sats"| LT
        S -. "blocs, fonds, canal,<br/>paiement test" .-> BTC & LT & LD
    end
    Phone["📱 Téléphone<br/>wallet LDK Node"] -->|"10.0.2.2:50001"| EL
    Phone <==>|"canal privé 2 M sats<br/>10.0.2.2:9735"| LT
```

```mermaid
sequenceDiagram
    autonumber
    participant S as 🌱 seed
    participant B as ⛓️ bitcoind
    participant D as ⚡ diaspora
    participant T as ⚡ teranga
    S->>B: Crée 101 blocs (bitcoins de test)
    S->>D: Envoie 1 BTC de test
    S->>T: Envoie 1 BTC de test
    S->>B: Confirme (6 blocs)
    S->>D: Se connecter à teranga
    D->>T: Ouvre un canal de 5 M sats (1 M poussé)
    S->>B: Confirme (6 blocs)
    T-->>D: Facture de 1 000 sats
    D->>T: ⚡ Paiement de vérification
```

Le fichier `compose.yaml` à la racine du dépôt inclut ces services. L'API, la passerelle simulée et le service d'alertes s'y ajouteront avec leurs tâches.

```sh
npm run regtest:up      # démarre bitcoind et les deux nœuds, attend qu'ils soient prêts
npm run regtest:seed    # prépare fonds, canal et paiement de vérification (relançable)
npm run regtest:down    # arrête en gardant les données
npm run regtest:reset   # arrête et efface toutes les données du réseau de test
```

Prérequis : Docker Desktop (ou Docker Engine) avec Compose v2.20 ou plus récent. Le premier démarrage télécharge environ 300 Mo d'images.

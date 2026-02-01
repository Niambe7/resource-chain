# ResourceChain DApp

DApp de gestion de ressources tokenisées (ERC721) avec règles métier : limite par utilisateur, cooldown et verrou de transfert.

## Prérequis
- Node.js 18+
- Truffle
- Ganache (GUI ou CLI)

## Installation
```bash
npm install
```

## Déploiement local
1) Démarrer Ganache (réseau id 5777, port 7545).
2) Compiler et migrer :
```bash
truffle compile
truffle migrate --reset
```

## Lancer le front
Le front est un simple fichier HTML/JS.
1) Copier l’ABI du build vers le front si nécessaire :
```bash
copy build\contracts\ResourceToken.json frontend\ResourceToken.json
```
2) Mettre à jour l’adresse du contrat dans le front :
```js
il faut remplacer cette cle par la cle reçu apres deploiement du smart-contract
const contractAddress = "0xC5B40840bfB5CeA396B0ED568a944D49b9fe95C9";
```
2) Servir le dossier `frontend/` (ex: live server, `http-server`, etc.).

## Utilisation
- **Mint** : renseigne `Nom`, `Type`, `Valeur` (numérique) et `Hash IPFS` (CID ou URL gateway).
- **Transfer** : renseigne l’adresse destinataire et le `Token ID`.
- **Historique** : affiche les anciens propriétaires d’un token.

## Cooldown et verrou
- **Cooldown** : un délai s’applique entre actions.
- **Verrou** : un token ne peut pas être transféré pendant `LOCK_TIME`.
Les timers affichés dans l’UI sont calculés depuis l’état on-chain.

## Tests
```bash
truffle test
```

## IPFS (optionnel)
Un script d’upload est disponible dans `frontend/upload-ipfs.js`.
- Remplace la clé API (nft.storage) ou adapte à Pinata si besoin.

## Structure
- `contracts/` : smart contracts
- `migrations/` : scripts de déploiement
- `test/` : tests
- `frontend/` : interface web

## Notes
- Si l’UI indique “Init bloque”, vérifie l’adresse du contrat dans `frontend/app.js`.

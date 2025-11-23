### Installation

Foundry to latest version

```
source .env

forge script scripts/DeployRaila.s.sol:DeployRaila \
  --rpc-url https://rpc.gnosischain.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_KEY \
  --chain-id 100
```
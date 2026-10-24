# Earnest

Earnest is an ERC-8183 job escrow for AI agents on Arc. A client pays an agent for a job in USDC. When the job completes, Earnest writes the client's rating directly into the ERC-8004 ReputationRegistry, tagged with the USDC that actually settled — creating payment-backed reputation that anyone can query.

Built with [Arc Studio](https://studio.arc.io)

The 5-page web app lets you look up agent profiles (dual review scores), hire agents, manage jobs, simulate attacks, and inspect evidence.

## Tech stack

- Contracts: Solidity 0.8.28, Foundry, OpenZeppelin ReentrancyGuard
- Chain: Arc Mainnet (default) / Arc Testnet (`?network=testnet`)
- Token: USDC 6 decimals at `0x3600000000000000000000000000000000000000`
- Standards: ERC-8183 (job escrow), ERC-8004 (agent identity + reputation)
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, wagmi v2, viem, ConnectKit

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh)

### Install

```bash
bun install
```

### Environment variables

None required for compiling and testing. See `contracts/contract-metadata/Earnest.json` for deployed addresses.

### Build

```bash
bun run contracts:build
```

### Test

```bash
bun run contracts:test
```

Runs 14 Foundry unit tests covering all 12 spec cases plus fuzz/invariant checks.

## Contract: `contracts/Earnest.sol`

ERC-8183 job escrow + Earnest reputation extension. Key properties:

- 1% fee to an immutable treasury on job completion; no fee on reject or refund.
- No owner, admin, pause, or upgrade — fully immutable after deploy.
- `createAgentJob` resolves the provider address from the ERC-8004 IdentityRegistry.
- `complete()` with a `uint8` rating in `optParams` writes a payment-backed review to the ReputationRegistry under the tag `"earnest"`.
- SelfReview enforcement: reverts if client or evaluator is the agent owner, agent wallet, or an approved operator.

**Known limitation:** wash reviews from a second wallet are not prevented, but each costs the 1% fee on the claimed amount.

### Deployed addresses

| Network | Address |
|---|---|
| Arc Testnet | `0x5268053b86a3ebf1d657b6c9ed4c09617c747f47` |

### Constructor

```solidity
constructor(
    IERC20 usdc,
    IIdentityRegistry identity,
    IReputationRegistry reputation,
    address treasury,
    uint16 feeBps         // pass 100 for 1%; max 1000
)
```

### Registry addresses

| Contract | Arc Testnet | Arc Mainnet |
|---|---|---|
| USDC | `0x3600000000000000000000000000000000000000` | same |
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

# Earnest

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

## Deployed Contracts

| Contract | Chain | Address | Deploy Tx |
|---|---|---|---|
| Earnest v1 (superseded) | Arc Testnet (5042002) | `0x5268053b86a3ebf1d657b6c9ed4c09617c747f47` | `0x4d0114437a15f82ebb2b41c98db3d15152fa479a0b3959bbc3452af0c31efbba` |
| Earnest v2 (superseded) | Arc Testnet (5042002) | `0x1b7eae2428d99927a611474906a7b11fcf4b8625` | `0x956fe6e8f2237ce8e85bfed3d1c35b4d33262aa7f21a69287ea1ba27357196c8` |
| Earnest v3, deployed by Arc Studio | Arc Testnet (5042002) | `0xd6eb20d211b206e8c6225f3167d39e903f795fd4` | `0xeccc06f699aa90273b1626218ebef8bb4beb8c3a8a7ebd822685b2ae594b9a57` |
| Earnest v3, testnet rehearsal (scripts/demo.ts) | Arc Testnet (5042002) | `0x125e29bcc055d87fdaa6710c0b1596389bee781a` | `0x2d0dbdee861d3508feb74abe5312f56a97e39f713fa1f4568a3832c0b44ae98f` |
| **Earnest v3 (live)** | **Arc Mainnet (5042)** | **`0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3`** | `0xba96a1ed0d84a41e5b1e8653d465810d1780d11a1a031cba7f56e6dc9ee1ad66` |

Mainnet demo agent: ERC-8004 agent #2730 ("Arc Block Digest"). Demo jobs 1 to 4, all transactions in `../docs/EVIDENCE.md`.

### Constructor args (Arc Testnet)
- USDC: `0x3600000000000000000000000000000000000000`
- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- treasury: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform deployer wallet)
- feeBps: `100` (1%)

### Mainnet addresses (for future deploy)
- IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

## Integration test note
The live IdentityRegistry exposes `register(string)` not `registerAgent(string)`. The spec doc has a documentation mismatch — use `register(string)` when calling the real registry directly.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```

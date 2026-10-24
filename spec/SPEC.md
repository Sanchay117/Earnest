# Earnest: build spec

Earnest is an ERC-8183 job escrow for AI agents on Arc, wired to the ERC-8004 Reputation Registry.
A client pays an agent for a job in USDC. When the job completes, the escrow contract itself writes the
client's rating into the official ERC-8004 Reputation Registry, tagged with the USDC that actually settled.
Because the escrow is the `clientAddress` of every review it writes, anyone can read payment-backed
reputation with `getSummary(agentId, [earnest], "earnest", "")` and ignore free, unpaid reviews.

## Why

On ERC-8004, `giveFeedback` is open to any address that is not the agent's owner or operator. A fresh wallet
can give any agent a 100/100 review for a fraction of a cent. The spec itself says `getSummary` must be called
with a non-empty list of trusted client addresses because of Sybil and spam, but it does not say whom to trust.
Earnest is a reviewer you can trust because it only reviews jobs it settled: no payment, no review.

## Addresses (same interface on both networks)

| | Arc Mainnet (chain 5042) | Arc Testnet (chain 5042002) |
|---|---|---|
| USDC (ERC-20 view, 6 decimals) | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

The ERC-8183 reference `AgenticCommerce` exists only on testnet (`0x0747EEf0706327138c69792bF28Cd525089e4583`).
Earnest is its own ERC-8183 implementation so it can run on mainnet.

## Contract: `Earnest.sol`

Constructor: `(IERC20 usdc, IIdentityRegistry identity, IReputationRegistry reputation, address treasury, uint16 feeBps)`.
All five are immutable. No owner, no admin, no pause, no upgrade. `feeBps` is fixed at 100 (1%) on deploy and
`treasury` receives it. Reject `feeBps > 1000`.

### ERC-8183 surface (match the reference signatures)

```solidity
enum JobStatus { Open, Funded, Submitted, Completed, Rejected, Expired }

struct Job {
    uint256 id;
    address client;
    address provider;     // payout address
    address evaluator;
    string description;
    uint256 budget;       // USDC, 6 decimals
    uint256 expiredAt;
    JobStatus status;
    address hook;         // always address(0) in Earnest
}

function createJob(address provider, address evaluator, uint256 expiredAt, string calldata description, address hook) external returns (uint256);
function setProvider(uint256 jobId, address provider) external;
function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external;
function fund(uint256 jobId, bytes calldata optParams) external;
function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external;
function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;
function claimRefund(uint256 jobId) external;
function getJob(uint256 jobId) external view returns (Job memory);
function jobCounter() external view returns (uint256);
```

Emit the ERC-8183 events: `JobCreated, ProviderSet, BudgetSet, JobFunded, JobSubmitted, JobCompleted,
JobRejected, JobExpired, PaymentReleased, Refunded`.

Rules follow the ERC-8183 reference:

- `createJob`: caller becomes client. `evaluator != 0`. `expiredAt >= block.timestamp + 5 minutes`.
  `hook` must be `address(0)` (revert `HookNotSupported` otherwise).
- `setProvider`: client only, Open, provider unset.
- `setBudget`: provider or client, Open. `amount > 0`.
- `fund(jobId, optParams)`: client only, Open, provider set, budget set, before `expiredAt`.
  If `optParams` is 32 bytes it is `expectedBudget`; revert `BudgetChanged` if it differs (front-running guard
  from the ERC-8183 prose spec). Pull `budget` with `transferFrom`.
- `submit`: provider only, Funded.
- `complete(jobId, reason, optParams)`: evaluator only, Submitted. Pays `budget - fee` to provider and `fee` to
  treasury. Then writes the review (below).
- `reject`: client when Open (no refund needed); evaluator when Funded or Submitted (full refund to client).
- `claimRefund`: anyone, Funded or Submitted, `block.timestamp >= expiredAt`. Full refund, status Expired.
  Not callable before expiry (revert `NotExpired`).
- No fee on reject or refund. Checks-effects-interactions everywhere, plus a reentrancy guard.

### The Earnest extension: agent jobs and payment-backed reviews

```solidity
// Creates a job for an ERC-8004 agent. provider = identity.getAgentWallet(agentId),
// falling back to identity.ownerOf(agentId) if the wallet is unset.
function createAgentJob(uint256 agentId, address evaluator, uint256 expiredAt, string calldata description, uint256 budget) external returns (uint256 jobId);
function agentOf(uint256 jobId) external view returns (uint256 agentId, bool isAgentJob);
```

- `createAgentJob` sets provider from the registry and the budget in one call, so the client can `fund` next.
  Revert `UnknownAgent` if `ownerOf(agentId)` reverts or is zero.
- `complete` on an agent job reads the rating from `optParams`: `abi.encode(uint8 rating)`, 0 to 100.
  Empty `optParams` means no review (payment still releases). Rating > 100 reverts `BadRating`.
- When a rating is given, Earnest calls:

  ```solidity
  reputation.giveFeedback(
      agentId,
      int128(uint128(rating)),   // value
      0,                         // valueDecimals
      "earnest",                 // tag1: marks a payment-backed review
      "",                        // tag2
      "",                        // endpoint
      "",                        // feedbackURI
      keccak256(abi.encode(block.chainid, address(this), jobId, budget, deliverable)) // feedbackHash
  );
  ```

  and emits `Reviewed(jobId, agentId, client, rating, budget, feedbackIndex)` where `feedbackIndex` is
  `reputation.getLastIndex(agentId, address(this))` after the call.
- **No self-reviews.** The ERC-8004 registry blocks the agent owner from reviewing, but here `msg.sender` to the
  registry is always Earnest, so Earnest enforces it itself: `complete` with a rating reverts `SelfReview` if
  the job's client or evaluator is `ownerOf(agentId)`, the agent wallet, or approved for all by the owner.
- **One review per job.** Enforced by the status machine (a job completes once).
- Record per agent: `paidVolume[agentId]` (sum of budgets on completed jobs with a review) and
  `reviewCount[agentId]`, both public.
- Wash reviews (an owner paying its own agent from a second wallet) are not prevented, but each one costs the
  1% fee of the amount it claims, so a fake $1,000 of reviewed volume costs $10. Document this as a limit.

### Errors

`InvalidJob, WrongStatus, Unauthorized, ZeroAddress, ExpiryTooShort, ZeroBudget, ProviderNotSet, BudgetNotSet,
BudgetChanged, NotExpired, Expired, HookNotSupported, UnknownAgent, BadRating, SelfReview, FeeTooHigh`.

## Tests (Foundry)

Mock USDC (6 decimals), a mock IdentityRegistry (ERC-721 with `getAgentWallet`) and a mock ReputationRegistry
that mirrors the real one's owner/operator check and stores feedback per client address. Cover:

1. Happy path: create agent job, fund, submit, complete with rating 90. Provider gets 99%, treasury 1%,
   review stored under Earnest's address with tag1 "earnest", `paidVolume` and `reviewCount` updated.
2. Complete without rating: payment released, no review.
3. Expiry: funded job, warp past `expiredAt`, anyone `claimRefund`s, client gets exactly the budget back.
4. `claimRefund` before expiry reverts `NotExpired`.
5. Evaluator rejects a submitted job: full refund, no review, no fee.
6. Self-review: agent owner as client, and agent wallet as evaluator, both revert `SelfReview` on rated complete.
7. Rating 101 reverts `BadRating`.
8. Non-evaluator `complete` reverts `Unauthorized`; non-provider `submit` reverts `Unauthorized`.
9. `fund` with a stale `expectedBudget` reverts `BudgetChanged`.
10. Double complete reverts `WrongStatus`.
11. Hook other than zero reverts `HookNotSupported`.
12. Fuzz: for any budget and fee, provider + treasury == budget on complete; client gets budget on refund;
    contract USDC balance always equals the sum of budgets of Funded and Submitted jobs.

## App

Vite + React + viem, network switch mainnet/testnet (default mainnet), injected wallet. Pages:

1. **Agents.** Look up an ERC-8004 agent by id: name and image from its agentURI, owner, agent wallet. Two
   scores side by side: "All reviews" (`getSummary` over `getClients(agentId)`, every reviewer) and
   "Earnest-verified" (`getSummary(agentId, [earnest], "earnest", "")`), plus paid volume and review count.
   The contrast is the point of the product.
2. **Hire.** Pick an agent, set description, budget (USDC), deadline, evaluator (default: me). Create, approve,
   fund. Shows the job card with status.
3. **Jobs.** My jobs as client, provider or evaluator, with the next allowed action: submit (provider, with a
   deliverable text hashed to bytes32), complete with a 0 to 100 rating or reject (evaluator), claim refund
   (anyone, after expiry). Each action links the tx on the explorer.
4. **Try to cheat.** Runs `eth_call` simulations against the live contract and shows the named revert for:
   self-review, refund before expiry, completing as non-evaluator, rating 101, completing twice, stale budget.
   No wallet needed, no gas.
5. **Evidence.** Every Earnest event on the selected network, decoded, with explorer links.

Explorer: `https://explorer.arc.io` (mainnet), `https://explorer.testnet.arc.io` (testnet).

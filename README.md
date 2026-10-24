# Earnest

**Agent reviews you can't fake: only paid jobs get rated.**

Earnest is a job escrow for AI agents on Arc mainnet. A client (a person or another agent) locks USDC for a job,
the agent delivers, and when the job completes Earnest pays the agent and writes the client's rating into the
official ERC-8004 Reputation Registry, carrying the USDC that settled. Anyone can then ask the registry for
payment-backed reputation only, with `getSummary(agentId, [earnest], "earnest", "")`.

Built end to end in [Arc Studio](https://studio.arc.io/app/9c93cd2e-1a3a-4579-8441-e74ba5deaec3) for
Arc Microgrants: Built with Arc Studio.

| | |
|---|---|
| Live app | https://sanchay117.github.io/Earnest/ (reads Arc mainnet; add `?network=testnet` for the rehearsal) |
| Source | https://github.com/Sanchay117/Earnest |
| Arc Studio project | https://studio.arc.io/app/9c93cd2e-1a3a-4579-8441-e74ba5deaec3 |
| Earnest on Arc Mainnet | [`0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3`](https://explorer.arc.io/address/0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3) |
| Example tx: a paid job writes its review | [`0x3b22f2d8…`](https://explorer.arc.io/tx/0x3b22f2d84cc523ffdcc9520fa9c84f7cdbb60a33de19b7cb8192ada9f06cab36) |
| Demo agent | ERC-8004 agent #2730, "Arc Block Digest" |
| Every mainnet transaction | [docs/EVIDENCE.md](docs/EVIDENCE.md) |
| Video (2:24) | https://youtu.be/YGEdq1kwamg |

## The problem: reviews are free

ERC-8004 gives every AI agent an onchain identity and a public reputation registry, and both are live on Arc
mainnet. But `giveFeedback` is open to any address except the agent's own owner. A fresh wallet can give any
agent a 100/100 review for a fraction of a cent, and a script can do it ten thousand times.

The standard knows this. Its `getSummary` requires a non-empty list of reviewer addresses "to prevent Sybil and
spam attacks": callers must decide whose reviews to count. It does not say whom to trust.

**Earnest is a reviewer you can trust, because it only reviews jobs it settled.** No payment, no review. Each
review it writes is backed by a USDC escrow that actually paid out, and the amount is recorded beside it.

## How it works

```
client                         Earnest (ERC-8183 escrow)                  agent (ERC-8004 id)
  | createAgentJob(agentId,...) ->| provider = agent's registered wallet      |
  | approve + fund(budget)  ----->| USDC locked                               |
  |                               |<------------- submit(deliverable hash) ---|
  | complete(rating) ------------>| pays agent 99%, treasury 1%               |
  |                               | giveFeedback(agentId, rating, "earnest")  |--> ERC-8004 Reputation Registry
  |                               |   (reviewer = Earnest itself)             |
  | deadline passes, no delivery  | claimRefund: 100% back to the client      |
  | evaluator rejects the work    | reject: 100% back to the client           |
```

- **ERC-8183 compatible.** The job lifecycle (`createJob, setProvider, setBudget, fund, submit, complete,
  reject, claimRefund, getJob`), its events and its state machine follow the ERC-8183 reference. Arc lists the
  reference `AgenticCommerce` contract on testnet only; Earnest brings an ERC-8183 escrow to Arc mainnet.
- **Agent jobs.** `createAgentJob(agentId, ...)` pays the agent's wallet as registered in the ERC-8004
  IdentityRegistry, so a client cannot be tricked into paying a look-alike address.
- **Payment-backed reviews.** The evaluator passes a 0 to 100 rating to `complete`. Earnest releases the payment
  and calls the Reputation Registry itself, tagged `earnest`, with a `feedbackHash` that binds the chain, the
  contract, the job id, the budget and the deliverable.
- **No self-reviews.** The registry only sees Earnest as the caller, so Earnest enforces the owner rule itself:
  a rated completion reverts `SelfReview` if the client or evaluator is the agent's owner, its agent wallet, or
  an approved operator.
- **No silent review blocking.** If an agent's owner approves Earnest as an operator, the registry refuses
  Earnest's reviews for that agent. Earnest still pays the job, and counts the refusal publicly in
  `blockedReviews(agentId)`, which the app shows as a warning.
- **No owner.** No admin, no pause, no upgrade. The 1% fee and its treasury are fixed at deployment.

## What happened on Arc mainnet

One run of [`scripts/mainnet-run.sh`](scripts/mainnet-run.sh): 27 transactions, real USDC, $0.1195 of gas in
total. Each line links to the transaction on explorer.arc.io; the full log is in [docs/EVIDENCE.md](docs/EVIDENCE.md).

| What happened | Transaction |
|---|---|
| Earnest deployed (1% fee, no owner) | [`0xba96a1ed…`](https://explorer.arc.io/tx/0xba96a1ed0d84a41e5b1e8653d465810d1780d11a1a031cba7f56e6dc9ee1ad66) |
| Arc Block Digest registered as ERC-8004 agent #2730 | [`0x96e7b21b…`](https://explorer.arc.io/tx/0x96e7b21b51f6b3e8df2f8749a53ddd7ae37ce3be4c6f1b7e6a21965433445b75) |
| Job 1: client escrows $0.50 | [`0xb4e2741f…`](https://explorer.arc.io/tx/0xb4e2741fbd1055dfaff01ccccf6fb0f1ecaf58caf20677e63004e2feb1d41872) |
| Job 1: digest checked, agent paid $0.495, treasury $0.005, review 100 written by Earnest | [`0x3b22f2d8…`](https://explorer.arc.io/tx/0x3b22f2d84cc523ffdcc9520fa9c84f7cdbb60a33de19b7cb8192ada9f06cab36) |
| Job 2: nothing delivered, deadline passed, $0.25 refunded to the client | [`0x9f786e37…`](https://explorer.arc.io/tx/0x9f786e37d2191901694cdb1b91048a1e1c3661497a2ca9e8637de62d4f80db63) |
| Job 3: wrong digest submitted, rejected, $0.25 refunded to the client | [`0xe8f1b03f…`](https://explorer.arc.io/tx/0xe8f1b03f750763457784104ef952087552c2dc754adaa6df63eb23ad02387bf6) |
| Job 4: the agent's owner, as evaluator, tries to rate its own agent: fails on chain with `SelfReview` | [`0x8c156537…`](https://explorer.arc.io/tx/0x8c1565373bf58da7d2ba2030889ca3397db894a4ee3d20cc2f598a5166aee820) |
| A stranger gives the agent a free 100/100 straight in the registry (3 times) | [`0x6ccd3305…`](https://explorer.arc.io/tx/0x6ccd33050f3e589f081c6fa78539462cf8e317d553f5ffcf6242a14f2321a5d7) |

The result, read from the ERC-8004 Reputation Registry on mainnet:

| | Reviews | Average | Backed by payment |
|---|---:|---:|---:|
| All reviews | 4 | 100 | 1 of 4 |
| Earnest-verified (`getSummary(2730, [earnest], "earnest", "")`) | 1 | 100 | $0.50 |

Three of the four reviews cost nothing to write. Earnest's one review cost a real $0.50 job. Job 4 stays open
with $0.10 in escrow until Oct 31, 2026 so the app's "Try to Cheat" page can attack a live job; after its deadline
anyone can return the $0.10 to the client with `claimRefund`.

## Two agents, no humans in the loop

The demo is software paying software. `scripts/demo.ts` runs two agents:

- **Arc Block Digest** (the provider), registered in the ERC-8004 IdentityRegistry. It sells a deterministic
  digest of a range of Arc blocks: transaction count, gas used, first and last block hash. When a job is funded
  it computes the digest and submits its keccak256 hash.
- **The client agent** hires it, then acts as evaluator: it recomputes the digest itself, and completes the job
  with a rating only if the hashes match. A wrong digest is rejected and refunded.

## Built with Arc Studio

Everything onchain in this repo came out of one Arc Studio project, driven from Claude Code through the Arc
Studio CLI (`arc-studio run`), with the prompts kept in [`spec/`](spec/):

1. [`prompt-1-contracts.md`](spec/prompt-1-contracts.md): Arc Studio wrote `Earnest.sol` from
   [`SPEC.md`](spec/SPEC.md), ran two security reviewers and Slither, wrote the Foundry tests, ran integration
   tests against a fork of Arc Testnet and deployed to Arc Testnet.
2. [`prompt-2-fixes.md`](spec/prompt-2-fixes.md): our own review before mainnet found a real bug (an evaluator
   who is also the client could never reject) and a review-blocking attack. Arc Studio fixed both, added tests,
   including a check that the USDC Earnest holds always equals the open budgets across a sequence of jobs, and
   redeployed.
3. [`prompt-3-app.md`](spec/prompt-3-app.md): Arc Studio closed one more hole we found (an evaluator could send
   just too little gas so the review silently failed) and built the web app in `app/src`.

4. [`prompt-4-sync.md`](spec/prompt-4-sync.md): after the mainnet run, the fixes we made by hand were sent back
   to Arc Studio, which rebuilt the app and reran the tests: the reviews list now reads the live registry's
   `readAllFeedback`, "Try to Cheat" sends each attack from the address that would really try it and decodes the
   real revert, and the app points at our deployments.

`app/` is the Arc Studio project as pulled with `arc-studio pull`, and it matches the Arc Studio project file for
file.

The scripts in `scripts/` are ours. Arc Studio deploys to testnets only and never signs mainnet transactions, so
we rehearsed the whole demo on Arc Testnet first (Earnest
[`0x125e29bc…`](https://explorer.testnet.arc.io/address/0x125e29bcc055d87fdaa6710c0b1596389bee781a), also in
[docs/EVIDENCE.md](docs/EVIDENCE.md)), then sent the mainnet deploy and every mainnet demo transaction from our
own wallets.

## Repository

| Path | What it is |
|---|---|
| [`app/contracts/Earnest.sol`](app/contracts/Earnest.sol) | The contract |
| [`app/contracts/test/`](app/contracts/test/) | 20 Foundry tests: the job lifecycle, the attacks on it, a fee fuzz test |
| [`app/src/`](app/src/) | The web app (Vite, React, viem) |
| [`scripts/`](scripts/) | Deploy and demo scripts; on mainnet each prints its plan and sends nothing without `--yes` |
| [`scripts/mainnet-run.sh`](scripts/mainnet-run.sh) | The whole mainnet demo in one command, resumable if a step fails |
| [`spec/`](spec/) | The spec and every prompt given to Arc Studio |
| [`docs/EVIDENCE.md`](docs/EVIDENCE.md) | Every mainnet and testnet transaction with gas cost |

## Run it

```sh
cd app && bun install && forge test        # contract tests
bun run dev                                # the app, reads Arc mainnet by default (?network=testnet)
cd .. && npm install
node scripts/demo.ts status --network mainnet   # needs our demo wallet file, which is not in the repo
```

## Limits

- **No audit.** Arc Studio's built-in review, Slither, our own review and the tests are not an audit. Amounts are
  kept small on purpose.
- **Wash reviews are priced, not prevented.** An owner can pay its own agent from an unrelated wallet. Each such
  review costs the 1% fee of the volume it claims (a fake $1,000 of reviewed volume costs $10), and every review
  shows its amount, so cheap reviews look cheap.
- **The evaluator is trusted.** As in ERC-8183, whoever the client names as evaluator decides complete or reject.
  The demo's evaluator checks a deterministic deliverable; most real work is not deterministic.
- **The demo agents are ours.** Both demo agents and all demo wallets are controlled by us.
- **Everything is public.** Job descriptions, amounts and ratings are visible on chain.

## What comes next

- An ERC-8183 hook so any ERC-8183 escrow (including the reference `AgenticCommerce`) can write
  Earnest-style payment-backed reviews.
- x402 receipts as a second source of paid reviews: a pay-per-call API settled through Circle Gateway, reviewed
  with the payment as proof.
- Evaluator agents with their own ERC-8004 reputation, and validation through the ERC-8004 Validation Registry.
- Circle Wallets so agents get a wallet without key handling, and Gateway so a client funds a job from any chain.

## License

MIT.

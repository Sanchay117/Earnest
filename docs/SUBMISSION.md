# Earnest: DoraHacks submission draft

## Fields

| Field | Value |
|---|---|
| Name | Earnest |
| One-liner | Agent reviews you can't fake: only paid jobs get rated. |
| Live app | https://sanchay117.github.io/Earnest/ |
| Arc Studio project | https://studio.arc.io/app/9c93cd2e-1a3a-4579-8441-e74ba5deaec3 |
| Repo | https://github.com/Sanchay117/Earnest |
| Contract on Arc mainnet | `0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3` https://explorer.arc.io/address/0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3 |
| Example tx (paid job settles and writes its review) | `0x3b22f2d84cc523ffdcc9520fa9c84f7cdbb60a33de19b7cb8192ada9f06cab36` https://explorer.arc.io/tx/0x3b22f2d84cc523ffdcc9520fa9c84f7cdbb60a33de19b7cb8192ada9f06cab36 |
| Video | https://youtu.be/YGEdq1kwamg |
| Builder profile | https://github.com/Sanchay117 |

## Description

**Earnest is a USDC job escrow for AI agents on Arc mainnet that turns every paid job into a review nobody can fake.**

ERC-8004 gives agents an onchain identity and a public reputation registry, both live on Arc. But anyone can
write a review: a fresh wallet can give any agent 100/100 for a fraction of a cent, as many times as it likes.
The standard's own `getSummary` makes callers pick whose reviews to count, and leaves the question of whom to
trust open.

Earnest answers it. A client locks USDC for a job with the agent's ERC-8004 id; the agent delivers; when the
job completes, Earnest pays the agent (99%, 1% fee) and writes the client's rating into the official ERC-8004
Reputation Registry itself, with a hash binding the job, the budget and the deliverable. No payment, no review.
Anyone can then read payment-backed reputation only, with one registry call:
`getSummary(agentId, [earnest], "earnest", "")`.

- ERC-8183 job lifecycle (create, fund, submit, complete, reject, refund), so Arc mainnet gets an agent job
  escrow, which Arc otherwise lists on testnet only.
- Agent jobs pay the wallet registered for the agent in the ERC-8004 IdentityRegistry.
- An agent's owner cannot review its own agent through Earnest (`SelfReview`), and an owner who tries to block
  reviews is counted publicly.
- No admin, no pause, no upgrade.

**On Arc mainnet now:** a demo agent, "Arc Block Digest" (ERC-8004 #2730), was hired by a client agent four
times with real USDC: one job paid and reviewed ($0.50), one refunded after its deadline, one rejected for a
wrong deliverable, and one where the agent's owner tried to rate itself and the transaction failed on chain.
A stranger then gave it three free 100/100 reviews. Then an outside wallet hired it through the live app for
$0.05 (job 5), and completed the job in the app with a 100 rating. The registry now shows 5 reviews; Earnest shows
the 2 that were paid for. 33 transactions, $0.14 of gas, all linked in the repo's `docs/EVIDENCE.md` and the app's
Evidence page. The app's "Try to Cheat" page sends 9 attacks to the live contract and shows each real revert.

## How Arc Studio was used

The whole onchain project was built in one Arc Studio project, driven through the Arc Studio CLI, with every
prompt kept in the repo's `spec/` folder:

1. **Contracts:** Arc Studio wrote `Earnest.sol` from our spec, ran two security reviewers and Slither, wrote the
   Foundry tests, ran integration tests on a fork of Arc Testnet and deployed to Arc Testnet.
2. **Fixes:** our own review found a bug (an evaluator who was also the client could never reject) and a
   review-blocking attack; Arc Studio fixed both, added tests and redeployed.
3. **Hardening and app:** Arc Studio closed a gas-griefing hole we found (an evaluator could send just too little
   gas so the review silently failed) and built the React app.
4. **Sync:** after the mainnet run, the app fixes we made by hand were sent back so the Arc Studio project matches
   what is live.

The contract deployed on mainnet is byte for byte the one in the Arc Studio project, and its 20 Foundry tests pass.
Arc Studio deploys to testnets only, so we rehearsed the full demo on Arc Testnet and then sent the mainnet deploy
and every mainnet transaction from our own wallets with the scripts in `scripts/`.

## What comes next

An ERC-8183 hook so any ERC-8183 escrow can write Earnest reviews; x402 receipts as a second source of paid
reviews; evaluator agents with their own reputation; Circle Wallets and Gateway so agents fund and get paid from
any chain.

## Video script (about 3 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00 | The app's Agent page on mainnet | "ERC-8004 lets anyone review an AI agent for free. This agent has four 100/100 reviews. Three of them cost nothing to write." |
| 0:20 | The two columns: all reviews vs Earnest-verified | "Earnest only reviews jobs it actually paid out in USDC. Here: one review, backed by $0.50." |
| 0:40 | Arc Studio project: the chat with the first prompt, `Earnest.sol`, the security review and test results | "I built it in Arc Studio: the contract from a spec, two security reviews, Slither, Foundry tests and a testnet deploy." |
| 1:20 | Arc Studio: the fix turns, then the generated app | "Our review found a reject bug and two ways to block reviews; Arc Studio fixed them and built the app." |
| 1:45 | Terminal: `bash scripts/mainnet-run.sh` output (or its log) | "Then the real run on Arc mainnet: deploy, an agent registers, a client agent hires it four times." |
| 2:05 | Explorer: tx `0x3b22f2d8…` with the USDC transfers and the `NewFeedback` event | "This is job 1 settling: $0.495 to the agent, $0.005 fee, and the review written by Earnest in the same transaction." |
| 2:25 | Explorer: failed tx `0x8c156537…` | "Here the agent's owner tries to rate its own agent. It fails on chain with `SelfReview`." |
| 2:40 | App: Try to Cheat, click Run all attacks | "Nine attacks against the live contract, every one refused with the right error." |
| 2:55 | App: Evidence page | "Every transaction and its gas is here. Earnest: agent reviews you can't fake." |

Sync turn: bring this project in line with the version now live on Arc mainnet. No new features.

Earnest is deployed on Arc Mainnet (chain 5042) at 0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3 from this
project's contracts/Earnest.sol, unchanged. Its demo ran there: ERC-8004 agent #2730, jobs 1 to 4, every
transaction listed in public/evidence/mainnet.json. The app is live at https://sanchay117.github.io/Earnest/.

The attached files replace the ones at the same paths. Keep them exactly as attached; do not reformat or
rewrite them. What they change:

- src/lib/abis.ts is unchanged, but src/hooks/useAgent.ts now decodes readAllFeedback as the live
  ReputationRegistry returns it: (agentId, address[] clientAddresses, string tag1, string tag2, bool includeRevoked)
  returning seven parallel arrays, zipped into one entry per review.
- src/components/CheatPage.tsx: each attack is an eth_call sent from the address that would really try it (the
  job's evaluator, read live with getJob, for SelfReview, BadRating and double complete), the revert data is found
  in viem's error chain and decoded against EARNEST_ABI, and an attack only counts as blocked when the decoded
  error equals the expected one. Attacks on the live job are skipped with a reason once that job is no longer
  Submitted or its deadline has passed.
- src/components/EvidencePage.tsx: gasUsed arrives as a decimal string, so the total now adds numbers instead of
  joining strings.
- src/config.ts: mainnet and testnet point at the real deployments and demo jobs.
- public/evidence/*.json: the real transaction logs from the testnet rehearsal and the mainnet run.
- AGENTS.md: the deployments table now lists the mainnet contract.
- index.html, src/components/AgentPage.tsx: text only.

Then check, without deploying anything and without sending any transaction:
1. forge test passes (20 tests, contracts unchanged).
2. The app typechecks and builds (vite build).
Report the results in two lines. Do not change any other file.

Answer to your question: Deny. Do not create an API key; skip the 3 USDC transfer.

First, one small contract fix, then redeploy to Arc Testnet with the same constructor args:

- Gas grief in _handleReview's catch branch. The evaluator controls the gas of complete(), so it can send just
  too little gas for giveFeedback, which then fails inside try with out-of-gas and lands in catch: the job
  completes and blockedReviews[agentId] goes up for an honest agent, whose page would then wrongly say its owner
  blocked reviews. Fix: in the catch branch, count a block only if the owner really authorized Earnest
  (identity.isApprovedForAll(owner, address(this)) || identity.getApproved(agentId) == address(this));
  otherwise revert with the original revert data (bubble it up), so the evaluator must retry with enough gas.
  Add a test that a registry failure without that approval reverts complete(), and keep the existing
  ReviewBlocked test passing. Run the full suite.

Then build the Earnest web app in this project, around the redeployed contract (use its compiled ABI from
contracts/out, including blockedReviews, deliverables and the ReviewBlocked event).
Follow the "App" section of context/spec/SPEC.md, with these specifics.

Stack and data:
- Vite + React + TypeScript + viem (wagmi is fine). Static site, no backend. It will be hosted on GitHub Pages
  under a sub-path, so use relative asset paths (vite base "./") and hash routing.
- Read everything through the public RPCs (https://rpc.mainnet.arc.io, https://rpc.testnet.arc.io). Reading must
  work with no wallet connected. Writes go through an injected wallet (offer to add/switch to the Arc network).
- Network switch in the header, default Arc Mainnet, ?network=testnet selects testnet.
- All addresses live in one file, src/config.ts: per network { chainId, rpc, explorer, usdc, identity,
  reputation, earnest, agentId, deployBlock, demoJobs: { completed, expired, rejected, live } }. Fill testnet
  with your deployment. Leave mainnet earnest as the zero address for now; the app must show a clear
  "not deployed on mainnet yet" state instead of erroring.
- Arc's RPC rejects eth_getLogs ranges above about 5,000 blocks, so do NOT scan events. Read jobs with
  jobCounter() + getJob(i) batched through Multicall3 (0xcA11bde05977b3631167028862bE2a173976CA11), and
  reviews with the ReputationRegistry's readAllFeedback / getSummary / getClients.

Pages:
1. Agent (home). Enter an ERC-8004 agent id (default config agentId). Show name and description from its
   agentURI (it may be a data:application/json;base64 URI), owner, agent wallet. Then the core of the product,
   two scores side by side:
   - "All reviews": getSummary(agentId, getClients(agentId), "", ""), count and average, with a list of every
     review (reviewer address, value, tag1) from readAllFeedback.
   - "Earnest-verified": getSummary(agentId, [earnest], "earnest", ""), count and average, plus paidVolume and
     reviewCount from Earnest, each review linked to the job it came from.
   Mark reviews whose reviewer is not Earnest as "unpaid". One sentence explains why the right column is the
   one to trust: Earnest only writes a review when USDC settled for the job. If blockedReviews(agentId) > 0,
   show a warning: "This agent's owner blocked N paid reviews" (the owner approved Earnest as an operator).
2. Hire. Agent id, task description, budget in USDC, deadline (minutes/hours/days), evaluator (default the
   connected wallet). Buttons: Create job (createAgentJob), Approve USDC, Fund (fund with abi.encode(budget) as
   expectedBudget). Show the job card and each tx link.
3. Jobs. Every job (newest first) with status, client, provider, evaluator, budget, deadline countdown. For the
   connected wallet show only the actions it may take: Submit (provider; text input hashed with keccak256 to
   the bytes32 deliverable), Complete with a 0-100 rating slider (evaluator; optParams abi.encode(uint8)),
   Complete without review, Reject (evaluator), Claim refund (anyone, after the deadline).
4. Try to cheat. A list of attacks, each with a "Run against live contract" button that does an eth_call (no
   wallet, no gas) from the attacker's address and shows the decoded custom error name, red if it reverted as
   expected. Use config.demoJobs to pick target jobs; skip an attack (greyed, with the reason) if its target
   job id is 0 or in the wrong state. demoJobs.live is a Submitted agent job with a long deadline whose
   evaluator is the agent's owner. Attacks:
   a. Refund a live job before its deadline (claimRefund on demoJobs.live) -> NotExpired
   b. Agent owner rates its own agent (complete with rating 100 on demoJobs.live, from that job's evaluator,
      which is the agent owner) -> SelfReview
   c. Rating above 100 (same job, rating 101) -> BadRating
   d. Pay out a job you are not the evaluator of (complete on demoJobs.live from a random address) -> Unauthorized
   e. Complete an already completed job (demoJobs.completed, from its evaluator) -> WrongStatus
   f. Refund an already paid job (claimRefund on demoJobs.completed) -> WrongStatus
   g. Hire an agent that does not exist (createAgentJob with agentId 2^64) -> UnknownAgent
   h. Deadline shorter than 5 minutes (createJob with expiredAt = now + 60) -> ExpiryTooShort
   i. Attach an arbitrary hook (createJob with hook = 0x...dEaD) -> HookNotSupported
   Also show the one real failed mainnet transaction if config has its hash (config.selfReviewFailedTx):
   "this attack was also sent for real and reverted on chain" with the explorer link.
5. Evidence. Contract address (explorer link), deploy tx, and every demo job from config.demoJobs with its
   live status, budget and where the money went. Also load ./evidence/mainnet.json and ./evidence/testnet.json
   if present (array of { step, outcome, hash, link, gasUsed, costUsdc }) and render them as a table, with a
   total gas cost row.

Design: clean, calm, light and dark mode, readable on a phone. The product name is Earnest, tagline
"Agent reviews you can't fake: only paid jobs get rated." No lorem ipsum, no fake numbers: every figure on
screen is read from the chain or from the evidence files.

Run the typecheck, lint and production build (vite build) and fix every error before you finish.

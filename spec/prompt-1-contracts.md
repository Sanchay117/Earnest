Build the smart contracts for "Earnest", specified in context/SPEC.md. Read it fully first; it is the source of truth.

This turn: contracts and tests only (the app comes in a later turn). Balanced preset.

1. Write contracts/Earnest.sol exactly as the spec describes: an ERC-8183 job escrow (reference signatures,
   events, state machine, 1% fee to an immutable treasury, no owner or admin) plus the Earnest extension:
   createAgentJob for ERC-8004 agents, the rating in complete()'s optParams as abi.encode(uint8), and the
   payment-backed review written by the contract into the ERC-8004 ReputationRegistry with tag1 "earnest".
   Enforce the SelfReview rule yourself, since the registry only ever sees Earnest as the caller.
   Use small local interfaces for the two ERC-8004 registries, matching the real ones exactly:
   giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32),
   getSummary(uint256,address[],string,string) returns (uint64,int128,uint8),
   getLastIndex(uint256,address) returns (uint64), getClients(uint256) returns (address[]),
   ownerOf(uint256), isApprovedForAll(address,address), getAgentWallet(uint256) returns (address).
   I checked these selectors against the live mainnet implementation.
2. Write the Foundry tests listed in the spec (12 cases including the fuzz/invariant one), with mocks for USDC,
   the IdentityRegistry and a ReputationRegistry that rejects feedback from the agent owner/operator like the
   real one. Run them and show me the results.
3. Review the contract (reentrancy, CEI, every revert path, fee rounding so provider + treasury == budget).
4. Deploy Earnest to Arc Testnet with the real testnet registries:
   USDC 0x3600000000000000000000000000000000000000,
   IdentityRegistry 0x8004A818BFB912233c491871b3d84c89A494BD9e,
   ReputationRegistry 0x8004B663056A597Dffe9eCcC1965A193B7388713,
   treasury = the deployer address, feeBps = 100.
5. On testnet, run one full happy-path job end to end against the real registries: register an ERC-8004 agent
   (from a second wallet so the client is not the owner), create an agent job for 1 USDC, fund, submit,
   complete with rating 90, then confirm the review is readable with
   getSummary(agentId, [earnestAddress], "earnest", ""). Then run one expired job: fund with the minimum
   expiry, wait it out, claimRefund, confirm the client got exactly the budget back.
   Report every transaction hash.

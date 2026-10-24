/**
 * Per-network configuration for Earnest.
 * All addresses live here, none in component code.
 */

export type NetworkKey = 'mainnet' | 'testnet'

export interface DemoJobs {
  /** A completed agent job (for WrongStatus attacks) */
  completed: number
  /** An expired/refunded job */
  expired: number
  /** A rejected job */
  rejected: number
  /**
   * A Submitted agent job whose evaluator IS the agent owner (for SelfReview attacks).
   * Set to 0 if not yet created.
   */
  live: number
}

export interface NetworkConfig {
  chainId: number
  rpc: string
  explorer: string
  usdc: `0x${string}`
  identity: `0x${string}`
  reputation: `0x${string}`
  earnest: `0x${string}`
  /** Default agent id shown on the Agent page */
  agentId: number
  /** Block the earnest contract was deployed at (for display; not used for scanning) */
  deployBlock: number
  deployTx: string
  demoJobs: DemoJobs
  /** Optional: a known self-review failed tx hash */
  selfReviewFailedTx?: string
}

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  mainnet: {
    chainId: 5042,
    rpc: 'https://rpc.mainnet.arc.io',
    explorer: 'https://explorer.arc.io',
    usdc: '0x3600000000000000000000000000000000000000',
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    // The mainnet run by scripts/mainnet-run.sh (see docs/EVIDENCE.md)
    earnest: '0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3',
    agentId: 2730,
    deployBlock: 27640516,
    deployTx: '0xba96a1ed0d84a41e5b1e8653d465810d1780d11a1a031cba7f56e6dc9ee1ad66',
    demoJobs: { completed: 1, expired: 2, rejected: 3, live: 4 },
    selfReviewFailedTx: '0x8c1565373bf58da7d2ba2030889ca3397db894a4ee3d20cc2f598a5166aee820',
  },
  testnet: {
    chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.io',
    explorer: 'https://explorer.testnet.arc.io',
    usdc: '0x3600000000000000000000000000000000000000',
    identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    // The live testnet rehearsal run by scripts/demo.ts (see docs/EVIDENCE.md)
    earnest: '0x125e29bcc055d87fdaa6710c0b1596389bee781a',
    agentId: 897441,
    deployBlock: 68810043,
    deployTx: '0x2d0dbdee861d3508feb74abe5312f56a97e39f713fa1f4568a3832c0b44ae98f',
    demoJobs: { completed: 1, expired: 2, rejected: 3, live: 4 },
    selfReviewFailedTx: '0xf52953034dd9ac033e46874601766ec2e1c627b94eba135562d5021246073074',
  },
}

/** Multicall3: same address on every EVM chain */
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

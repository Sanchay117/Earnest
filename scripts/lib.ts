// Shared helpers for the Earnest scripts: networks, wallets, clients and the --yes guard.
import { readFileSync, existsSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, formatUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ROOT = new URL("..", import.meta.url).pathname;

export const NETWORKS = {
  mainnet: {
    chain: defineChain({
      id: 5042,
      name: "Arc",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
      blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
    }),
    explorer: "https://explorer.arc.io",
    usdc: "0x3600000000000000000000000000000000000000" as Address,
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  },
  testnet: {
    chain: defineChain({
      id: 5042002,
      name: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
      blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" } },
    }),
    explorer: "https://explorer.testnet.arc.io",
    usdc: "0x3600000000000000000000000000000000000000" as Address,
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
    reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export function args() {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const network = (get("network") ?? "testnet") as NetworkName;
  if (!(network in NETWORKS)) throw new Error(`unknown --network ${network}`);
  return { argv, get, has: (name: string) => argv.includes(`--${name}`), network, yes: argv.includes("--yes") };
}

// Demo wallets live in .secrets/<network>-wallets.json (gitignored), created by scripts/wallets.ts.
export const ROLES = ["deployer", "client", "agent", "faker"] as const;
export type Role = (typeof ROLES)[number];

export function walletsPath(network: NetworkName) {
  return `${ROOT}.secrets/${network}-wallets.json`;
}

export function loadWallets(network: NetworkName) {
  const path = walletsPath(network);
  if (!existsSync(path)) throw new Error(`no wallets for ${network}: run node scripts/wallets.ts --network ${network}`);
  const keys = JSON.parse(readFileSync(path, "utf8")) as Record<Role, Hex>;
  return Object.fromEntries(ROLES.map((r) => [r, privateKeyToAccount(keys[r])])) as Record<
    Role,
    ReturnType<typeof privateKeyToAccount>
  >;
}

export function clients(network: NetworkName) {
  const { chain } = NETWORKS[network];
  const pub = createPublicClient({ chain, transport: http() });
  const wallet = (account: ReturnType<typeof privateKeyToAccount>) =>
    createWalletClient({ chain, transport: http(), account });
  return { pub, wallet };
}

export const usd = (units: bigint) => `$${formatUnits(units, 6)}`;
export const usdNative = (wei: bigint) => `$${formatUnits(wei, 18)}`;

export function txLink(network: NetworkName, hash: Hex) {
  return `${NETWORKS[network].explorer}/tx/${hash}`;
}

// On mainnet nothing is sent without --yes: the script prints its plan and stops.
export function guard(network: NetworkName, yes: boolean, plan: string[]) {
  console.log(`Plan on ${network}:`);
  for (const line of plan) console.log(`  - ${line}`);
  if (network === "mainnet" && !yes) {
    console.log("\nDry run. Nothing was sent. Re-run with --yes to send.");
    process.exit(0);
  }
}

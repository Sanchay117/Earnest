// Creates the demo wallets for a network in .secrets/<network>-wallets.json. Never overwrites an existing file.
// Usage: node scripts/wallets.ts --network mainnet|testnet
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { generatePrivateKey } from "viem/accounts";
import { args, ROLES, ROOT, walletsPath, loadWallets } from "./lib.ts";

const { network } = args();
const path = walletsPath(network);

if (!existsSync(path)) {
  mkdirSync(`${ROOT}.secrets`, { recursive: true });
  const keys = Object.fromEntries(ROLES.map((r) => [r, generatePrivateKey()]));
  writeFileSync(path, JSON.stringify(keys, null, 2) + "\n", { mode: 0o600 });
  console.log(`Created ${path} (back it up; it holds the demo keys).`);
} else {
  console.log(`${path} already exists, leaving it as is.`);
}

const wallets = loadWallets(network);
for (const role of ROLES) console.log(`${role.padEnd(9)} ${wallets[role].address}`);

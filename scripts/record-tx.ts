// Adds a transaction sent outside the scripts (from a browser wallet, through the live app) to the evidence
// log, so docs/EVIDENCE.md and the app's Evidence page list every transaction of the demo. Sends nothing.
// Usage: node scripts/record-tx.ts --network mainnet --hash 0x... --step "fund job 5 (live app)" --outcome "escrowed $0.05"
// Then run node scripts/evidence.ts to regenerate docs/EVIDENCE.md.
import { existsSync, readFileSync } from "node:fs";
import type { Hex } from "viem";
import { args, clients, ROOT } from "./lib.ts";
import { record, type EvidenceEntry } from "./record.ts";

const { get, network } = args();
const hash = get("hash") as Hex | undefined;
const step = get("step");
const outcome = get("outcome");
if (!hash || !step || !outcome) throw new Error("need --hash, --step and --outcome");

const path = `${ROOT}evidence/${network}.json`;
const log: EvidenceEntry[] = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
if (log.some((e) => e.hash.toLowerCase() === hash.toLowerCase())) {
  console.log(`${hash} is already recorded`);
  process.exit(0);
}

const { pub } = clients(network);
const r = await pub.getTransactionReceipt({ hash });
const block = await pub.getBlock({ blockNumber: r.blockNumber });
record(network, step, outcome, r, new Date(Number(block.timestamp) * 1000).toISOString());

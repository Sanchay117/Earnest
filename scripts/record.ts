// Deployment addresses and the evidence log: every transaction the scripts send is recorded in
// evidence/<network>.json with its gas cost, and docs/EVIDENCE.md is generated from it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Address, Hex, TransactionReceipt } from "viem";
import { ROOT, txLink, type NetworkName } from "./lib.ts";

export type Deployment = { earnest?: Address; agentId?: string; treasury?: Address; deployBlock?: string };
type Deployments = Partial<Record<NetworkName, Deployment>>;

const DEPLOYMENTS = `${ROOT}deployments.json`;

export function readDeployment(network: NetworkName): Deployment {
  if (!existsSync(DEPLOYMENTS)) return {};
  return (JSON.parse(readFileSync(DEPLOYMENTS, "utf8")) as Deployments)[network] ?? {};
}

export function writeDeployment(network: NetworkName, patch: Deployment) {
  const all: Deployments = existsSync(DEPLOYMENTS) ? JSON.parse(readFileSync(DEPLOYMENTS, "utf8")) : {};
  all[network] = { ...all[network], ...patch };
  writeFileSync(DEPLOYMENTS, JSON.stringify(all, null, 2) + "\n");
}

export type EvidenceEntry = {
  step: string;
  outcome: string;
  from: Address;
  hash: Hex;
  link: string;
  block: string;
  gasUsed: string;
  costUsdc: string;
  at: string;
};

// `at` defaults to now; pass the block time when recording a transaction after the fact.
export function record(network: NetworkName, step: string, outcome: string, r: TransactionReceipt, at?: string) {
  mkdirSync(`${ROOT}evidence`, { recursive: true });
  const path = `${ROOT}evidence/${network}.json`;
  const log: EvidenceEntry[] = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  const costWei = r.gasUsed * r.effectiveGasPrice;
  const entry: EvidenceEntry = {
    step,
    outcome: r.status === "success" ? outcome : `REVERTED: ${outcome}`,
    from: r.from,
    hash: r.transactionHash,
    link: txLink(network, r.transactionHash),
    block: r.blockNumber.toString(),
    gasUsed: r.gasUsed.toString(),
    costUsdc: (Number(costWei) / 1e18).toFixed(6),
    at: at ?? new Date().toISOString(),
  };
  log.push(entry);
  // Keep the log in chain order, so transactions recorded after the fact land where they happened.
  log.sort((a, b) => Number(BigInt(a.block) - BigInt(b.block)));
  writeFileSync(path, JSON.stringify(log, null, 2) + "\n");
  console.log(`  ${step}: ${entry.outcome}\n    ${entry.link} (gas ${entry.gasUsed}, $${entry.costUsdc})`);
  return entry;
}

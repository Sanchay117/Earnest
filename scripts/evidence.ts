// Writes docs/EVIDENCE.md from evidence/<network>.json and deployments.json, and copies the logs into
// app/public/evidence/ so the live app's Evidence page can show them. Sends nothing.
// Usage: node scripts/evidence.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NETWORKS, ROOT, type NetworkName } from "./lib.ts";
import { readDeployment, type EvidenceEntry } from "./record.ts";

const out: string[] = [
  "# Evidence",
  "",
  "Every transaction the demo scripts sent, generated from `evidence/<network>.json` by `node scripts/evidence.ts`.",
  "Costs are gas paid in USDC (Arc's native gas token). A row marked REVERTED is an attack that was sent for real",
  "and refused by the contract on chain.",
  "",
];

mkdirSync(`${ROOT}app/public/evidence`, { recursive: true });
mkdirSync(`${ROOT}docs`, { recursive: true });

for (const network of ["mainnet", "testnet"] as NetworkName[]) {
  const path = `${ROOT}evidence/${network}.json`;
  if (!existsSync(path)) continue;
  copyFileSync(path, `${ROOT}app/public/evidence/${network}.json`);
  const log = JSON.parse(readFileSync(path, "utf8")) as EvidenceEntry[];
  const dep = readDeployment(network);
  const { explorer } = NETWORKS[network];
  const total = log.reduce((s, e) => s + Number(e.costUsdc), 0);
  out.push(`## Arc ${network === "mainnet" ? "Mainnet" : "Testnet"}`, "");
  if (dep.earnest) out.push(`- Earnest: [\`${dep.earnest}\`](${explorer}/address/${dep.earnest})`);
  if (dep.agentId) out.push(`- Demo agent: ERC-8004 agent id ${dep.agentId} ("Arc Block Digest")`);
  out.push(`- ${log.length} transactions, $${total.toFixed(4)} of gas in total`, "");
  out.push("| # | Step | Outcome | Transaction | Gas | Cost |", "|---:|---|---|---|---:|---:|");
  log.forEach((e, i) =>
    out.push(`| ${i + 1} | ${e.step} | ${e.outcome} | [\`${e.hash.slice(0, 10)}…\`](${e.link}) | ${e.gasUsed} | $${e.costUsdc} |`),
  );
  out.push("");
}

writeFileSync(`${ROOT}docs/EVIDENCE.md`, out.join("\n"));
console.log(`wrote docs/EVIDENCE.md`);

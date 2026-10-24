// The work the demo agent sells: a digest of a range of Arc blocks. It is deterministic, so the client can
// recompute it and check the provider's deliverable hash before paying.
import { keccak256, toBytes, type PublicClient, type Hex } from "viem";

export type Digest = {
  chainId: number;
  from: number;
  to: number;
  blocks: number;
  txCount: number;
  gasUsed: string;
  firstHash: Hex;
  lastHash: Hex;
};

// Job descriptions carry the task as "digest:<from>-<to>", optionally followed by free text.
export function parseTask(description: string) {
  const m = /^digest:(\d+)-(\d+)/.exec(description);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (to < from || to - from > 199) return null;
  return { from, to };
}

export async function computeDigest(pub: PublicClient, from: number, to: number): Promise<Digest> {
  let txCount = 0;
  let gasUsed = 0n;
  let firstHash: Hex = "0x";
  let lastHash: Hex = "0x";
  for (let n = from; n <= to; n++) {
    const b = await pub.getBlock({ blockNumber: BigInt(n) });
    txCount += b.transactions.length;
    gasUsed += b.gasUsed;
    if (n === from) firstHash = b.hash;
    if (n === to) lastHash = b.hash;
  }
  return { chainId: await pub.getChainId(), from, to, blocks: to - from + 1, txCount, gasUsed: gasUsed.toString(), firstHash, lastHash };
}

export const digestHash = (d: Digest) => keccak256(toBytes(JSON.stringify(d)));

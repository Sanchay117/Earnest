// Sends what is left in the demo wallets to one address, after the demo is done.
// Usage: node scripts/sweep.ts --to 0x... --network mainnet [--keep-client 0.01] [--yes]
// The client keeps a little by default so it can later claim back the live job's budget after its deadline
// (claimRefund) and then be swept again. --keep-client 0 empties it too.
import { getAddress, parseUnits } from "viem";
import { args, clients, guard, loadWallets, ROLES, txLink, usdNative } from "./lib.ts";

const { get, network, yes } = args();
const to = getAddress(get("to") ?? "");
const keepClient = parseUnits(get("keep-client") ?? "0.01", 18);
const w = loadWallets(network);
const { pub, wallet } = clients(network);

const TRANSFER_GAS = 21_000n;
// Native USDC has 18 decimals but USDC itself has 6, so amounts are rounded down to whole micro-dollars.
const MICRO = 10n ** 12n;

const { maxFeePerGas, maxPriorityFeePerGas } = await pub.estimateFeesPerGas();
const plan = [];
for (const role of ROLES) {
  const from = w[role];
  const balance = await pub.getBalance({ address: from.address });
  const keep = role === "client" ? keepClient : 0n;
  const left = balance - TRANSFER_GAS * maxFeePerGas - keep;
  const value = left > 0n ? (left / MICRO) * MICRO : 0n;
  plan.push({ role, from, balance, keep, value });
}

guard(network, yes, [
  ...plan.map(
    (p) =>
      `${p.role.padEnd(8)} ${p.from.address} holds ${usdNative(p.balance)}: ` +
      (p.value > 0n ? `send ${usdNative(p.value)} to ${to}` : "nothing to send") +
      (p.keep > 0n ? `, keep ${usdNative(p.keep)} for the job 4 refund later` : ""),
  ),
  `total to ${to}: ${usdNative(plan.reduce((sum, p) => sum + p.value, 0n))}`,
]);

for (const p of plan) {
  if (p.value === 0n) continue;
  const hash = await wallet(p.from).sendTransaction({
    to,
    value: p.value,
    gas: TRANSFER_GAS,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${p.role}: sent ${usdNative(p.value)}, ${r.status}, ${txLink(network, hash)}`);
}

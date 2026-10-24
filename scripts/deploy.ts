// Deploys Earnest with the bytecode compiled from the Arc Studio project in app/.
// Usage: node scripts/deploy.ts --network mainnet|testnet [--treasury 0x...] [--yes]
// Build first: (cd app && forge build). Foundry writes artifacts to app/contracts/out.
import { readFileSync } from "node:fs";
import { encodeDeployData, type Address, type Hex } from "viem";
import { args, clients, guard, loadWallets, NETWORKS, ROOT, usdNative } from "./lib.ts";
import { record, writeDeployment, readDeployment } from "./record.ts";

export const ARTIFACT = `${ROOT}app/contracts/out/Earnest.sol/Earnest.json`;

const { get, network, yes } = args();
const net = NETWORKS[network];
const w = loadWallets(network);
const { pub, wallet } = clients(network);

const existing = readDeployment(network).earnest;
if (existing && !process.argv.includes("--force")) {
  console.log(`Earnest is already deployed on ${network} at ${existing}. Pass --force to deploy a new one.`);
  process.exit(0);
}

const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8")) as { abi: any[]; bytecode: { object: Hex } };
const treasury = (get("treasury") ?? w.deployer.address) as Address;
const feeBps = 100;
const ctorArgs = [net.usdc, net.identity, net.reputation, treasury, feeBps] as const;

const balance = await pub.getBalance({ address: w.deployer.address });
const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: ctorArgs });
const gas = await pub.estimateGas({ account: w.deployer.address, data });
const price = await pub.getGasPrice();

guard(network, yes, [
  `deployer ${w.deployer.address} holds ${usdNative(balance)}`,
  `deploy Earnest(usdc ${net.usdc}, identity ${net.identity}, reputation ${net.reputation}, treasury ${treasury}, feeBps ${feeBps})`,
  `estimated gas ${gas}, about ${usdNative(gas * price)}`,
]);

const hash = await wallet(w.deployer).deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: ctorArgs });
const r = await pub.waitForTransactionReceipt({ hash });
if (!r.contractAddress) throw new Error("deploy failed");
record(network, "deploy Earnest", `deployed at ${r.contractAddress}`, r);
writeDeployment(network, { earnest: r.contractAddress, treasury, deployBlock: r.blockNumber.toString() });
console.log(`Earnest ${r.contractAddress}`);

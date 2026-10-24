// The Earnest demo, one step per subcommand. Each wallet plays one role:
//   deployer  deploys Earnest and funds the others
//   agent     owns the ERC-8004 agent "Arc Block Digest" and does the work (the provider)
//   client    hires the agent and evaluates the work (client and evaluator)
//   faker     posts a free, unpaid review straight to the ERC-8004 registry, to show why filtering matters
//
// Usage: node scripts/demo.ts <step> --network mainnet|testnet [--yes]
//   fund                       deployer sends gas and budget money to the other wallets
//   register                   agent registers itself in the ERC-8004 IdentityRegistry
//   hire --budget 0.50 [--minutes 30] [--blocks 50]
//                              client creates an agent job, approves and funds it
//   work [--job N] [--sabotage]
//                              agent computes the digest for each funded job and submits its hash
//   evaluate [--job N]         client recomputes the digest: completes with a rating if it matches, rejects if not
//   refund --job N             anyone reclaims an expired job's budget for the client
//   self-review --job N        agent owner (as evaluator) tries to rate its own agent; sent for real, reverts on chain
//   fake-review                faker gives the agent 100/100 directly in the registry, no payment
//   status                     jobs, balances and both reputation scores
import { encodeAbiParameters, parseEventLogs, parseUnits, keccak256, toBytes, type Address, type Hex } from "viem";
import { args, clients, guard, loadWallets, NETWORKS, usd, usdNative } from "./lib.ts";
import { earnestAbi, erc20Abi, identityAbi, reputationAbi, STATUS } from "./abi.ts";
import { readDeployment, writeDeployment, record } from "./record.ts";
import { computeDigest, digestHash, parseTask } from "./digest.ts";

const { argv, get, has, network, yes } = args();
const step = argv[0];
const net = NETWORKS[network];
const w = loadWallets(network);
const { pub, wallet } = clients(network);
const dep = readDeployment(network);

function need<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) throw new Error(`missing ${what} for ${network}: run the earlier steps first`);
  return v;
}

async function send(step: string, outcome: string, account: (typeof w)[keyof typeof w], req: Record<string, unknown>) {
  // Simulate first: a step the contract would refuse stops here with the error name and sends nothing.
  const { request } = await pub.simulateContract({ account, ...(req as any) }).catch((e: any) => {
    console.error(`${step}: refused by the contract, nothing sent (${e.cause?.data?.errorName ?? e.shortMessage ?? e.message})`);
    process.exit(1);
  });
  const hash = await wallet(account).writeContract(request as any);
  const r = await pub.waitForTransactionReceipt({ hash });
  return { r, entry: record(network, step, outcome, r) };
}

async function jobs() {
  const earnest = need(dep.earnest, "earnest address");
  const n = await pub.readContract({ address: earnest, abi: earnestAbi, functionName: "jobCounter" });
  const out = [];
  for (let id = 1n; id <= n; id++) {
    out.push(await pub.readContract({ address: earnest, abi: earnestAbi, functionName: "getJob", args: [id] }));
  }
  return out;
}

const agentCard = (earnest: Address) => {
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Arc Block Digest",
    description:
      "Sells a deterministic digest of a range of Arc blocks (transaction count, gas used, first and last block hash), " +
      "paid in USDC through Earnest. Hire it with a job description that starts with digest:<fromBlock>-<toBlock>.",
    image: "",
    services: [{ name: "earnest", endpoint: `eip155:${net.chain.id}:${earnest}` }],
    supportedTrust: ["reputation"],
  };
  return `data:application/json;base64,${Buffer.from(JSON.stringify(card)).toString("base64")}`;
};

switch (step) {
  case "fund": {
    const plan: [keyof typeof w, string][] = [
      ["client", "1.2"],
      ["agent", "0.05"],
      ["faker", "0.03"],
    ];
    const bal = await pub.getBalance({ address: w.deployer.address });
    guard(network, yes, [
      `deployer ${w.deployer.address} holds ${usdNative(bal)}`,
      ...plan.map(([r, a]) => `send $${a} to ${r} ${w[r].address}`),
    ]);
    for (const [role, amount] of plan) {
      const hash = await wallet(w.deployer).sendTransaction({ to: w[role].address, value: parseUnits(amount, 18) });
      record(network, `fund ${role}`, `sent $${amount}`, await pub.waitForTransactionReceipt({ hash }));
    }
    break;
  }

  case "register": {
    const earnest = need(dep.earnest, "earnest address");
    guard(network, yes, [`agent ${w.agent.address} registers "Arc Block Digest" in ${net.identity}`]);
    const { r } = await send("register agent", "ERC-8004 agent registered", w.agent, {
      address: net.identity,
      abi: identityAbi,
      functionName: "register",
      args: [agentCard(earnest)],
    });
    const [transfer] = parseEventLogs({ abi: identityAbi, eventName: "Transfer", logs: r.logs });
    const agentId = need(transfer?.args.tokenId, "Transfer log");
    writeDeployment(network, { agentId: agentId.toString() });
    console.log(`agentId ${agentId}`);
    break;
  }

  case "hire": {
    const earnest = need(dep.earnest, "earnest address");
    const agentId = BigInt(need(dep.agentId, "agentId"));
    const budget = parseUnits(get("budget") ?? "0.50", 6);
    const minutes = Number(get("minutes") ?? "30");
    const blocks = Number(get("blocks") ?? "50");
    // --evaluator agent makes the agent's owner the evaluator: the setup for the self-review attack.
    const evaluator = get("evaluator") === "agent" ? w.agent.address : w.client.address;
    const head = Number(await pub.getBlockNumber());
    const from = head - blocks;
    const to = head - 1;
    const now = (await pub.getBlock()).timestamp;
    const expiredAt = now + BigInt(minutes * 60);
    const description = `digest:${from}-${to} Arc block digest for blocks ${from} to ${to}`;
    guard(network, yes, [
      `client ${w.client.address} hires agent ${agentId} for ${usd(budget)}, deadline in ${minutes} min`,
      `evaluator ${evaluator}${evaluator === w.agent.address ? " (the agent owner)" : " (the client)"}`,
      `task: ${description}`,
      `approve ${usd(budget)} to Earnest, then fund`,
    ]);
    const { r } = await send("create job", `agent job for ${usd(budget)}`, w.client, {
      address: earnest,
      abi: earnestAbi,
      functionName: "createAgentJob",
      args: [agentId, evaluator, expiredAt, description, budget],
    });
    const [created] = parseEventLogs({ abi: earnestAbi, eventName: "JobCreated", logs: r.logs });
    const jobId = need(created?.args.jobId, "JobCreated log");
    await send("approve", `approved ${usd(budget)}`, w.client, {
      address: net.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [earnest, budget],
    });
    await send(`fund job ${jobId}`, `escrowed ${usd(budget)}`, w.client, {
      address: earnest,
      abi: earnestAbi,
      functionName: "fund",
      args: [jobId, encodeAbiParameters([{ type: "uint256" }], [budget])],
    });
    console.log(`job ${jobId} funded`);
    break;
  }

  case "work": {
    const earnest = need(dep.earnest, "earnest address");
    const only = get("job");
    const todo = (await jobs()).filter(
      (j) => STATUS[j.status] === "Funded" && j.provider === w.agent.address && (!only || j.id === BigInt(only)),
    );
    guard(network, yes, todo.length ? todo.map((j) => `submit digest for job ${j.id}: ${j.description}`) : ["no funded jobs"]);
    for (const j of todo) {
      const task = parseTask(j.description);
      if (!task) {
        console.log(`job ${j.id}: not a digest task, skipping`);
        continue;
      }
      const d = await computeDigest(pub, task.from, task.to);
      if (has("sabotage")) d.txCount += 1;
      const deliverable = digestHash(d);
      console.log(`job ${j.id}: ${JSON.stringify(d)}`);
      await send(`submit job ${j.id}`, has("sabotage") ? "submitted a wrong digest (sabotage)" : "submitted digest", w.agent, {
        address: earnest,
        abi: earnestAbi,
        functionName: "submit",
        args: [j.id, deliverable, "0x"],
      });
    }
    break;
  }

  case "evaluate": {
    const earnest = need(dep.earnest, "earnest address");
    const only = get("job");
    const todo = (await jobs()).filter(
      (j) => STATUS[j.status] === "Submitted" && j.evaluator === w.client.address && (!only || j.id === BigInt(only)),
    );
    guard(network, yes, todo.length ? todo.map((j) => `check job ${j.id} and complete or reject`) : ["no submitted jobs"]);
    for (const j of todo) {
      const task = need(parseTask(j.description), "digest task");
      const expected = digestHash(await computeDigest(pub, task.from, task.to));
      const got = await pub.readContract({ address: earnest, abi: earnestAbi, functionName: "deliverables", args: [j.id] });
      console.log(`job ${j.id}: expected ${expected}, submitted ${got}`);
      if (got === expected) {
        await send(`complete job ${j.id}`, `digest verified, paid, rated 100`, w.client, {
          address: earnest,
          abi: earnestAbi,
          functionName: "complete",
          args: [j.id, expected, encodeAbiParameters([{ type: "uint8" }], [100])],
        });
      } else {
        await send(`reject job ${j.id}`, `digest mismatch, refunded`, w.client, {
          address: earnest,
          abi: earnestAbi,
          functionName: "reject",
          args: [j.id, keccak256(toBytes("digest mismatch")), "0x"],
        });
      }
    }
    break;
  }

  case "refund": {
    const earnest = need(dep.earnest, "earnest address");
    const id = BigInt(need(get("job"), "--job"));
    guard(network, yes, [`claimRefund on expired job ${id}`]);
    await send(`refund job ${id}`, "expired, budget returned to client", w.client, {
      address: earnest,
      abi: earnestAbi,
      functionName: "claimRefund",
      args: [id],
    });
    break;
  }

  case "self-review": {
    // Sent for real with a fixed gas limit (no simulation), so the revert lands on chain as a failed transaction.
    const earnest = need(dep.earnest, "earnest address");
    const id = BigInt(need(get("job"), "--job"));
    const j = await pub.readContract({ address: earnest, abi: earnestAbi, functionName: "getJob", args: [id] });
    if (j.evaluator !== w.agent.address || STATUS[j.status] !== "Submitted") {
      throw new Error(`job ${id} must be Submitted with the agent owner as evaluator (hire --evaluator agent, then work)`);
    }
    const refused = await pub
      .simulateContract({
        account: w.agent,
        address: earnest,
        abi: earnestAbi,
        functionName: "complete",
        args: [id, keccak256(toBytes("self-review")), encodeAbiParameters([{ type: "uint8" }], [100])],
      })
      .then(
        () => false,
        (e: any) => {
          console.log(`simulation: ${e.cause?.data?.errorName ?? e.shortMessage ?? e.message}`);
          return true;
        },
      );
    if (!refused) throw new Error("the self-review would go through, so it was not sent");
    guard(network, yes, [`agent owner ${w.agent.address} tries to rate its own agent 100 on job ${id}: expected to revert SelfReview`]);
    const hash = await wallet(w.agent).writeContract({
      address: earnest,
      abi: earnestAbi,
      functionName: "complete",
      args: [id, keccak256(toBytes("self-review")), encodeAbiParameters([{ type: "uint8" }], [100])],
      gas: 300_000n,
    });
    record(network, `self-review job ${id}`, "agent owner rated its own agent: SelfReview", await pub.waitForTransactionReceipt({ hash }));
    break;
  }

  case "fake-review": {
    const agentId = BigInt(need(dep.agentId, "agentId"));
    guard(network, yes, [`faker ${w.faker.address} gives agent ${agentId} a free 100/100 tagged "earnest" in the registry`]);
    await send("fake review", "unpaid 100/100 review written directly to the registry", w.faker, {
      address: net.reputation,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [agentId, 100n, 0, "earnest", "", "", "", "0x0000000000000000000000000000000000000000000000000000000000000000"],
    });
    break;
  }

  case "status": {
    for (const role of Object.keys(w) as (keyof typeof w)[]) {
      console.log(`${role.padEnd(9)} ${w[role].address} ${usdNative(await pub.getBalance({ address: w[role].address }))}`);
    }
    if (!dep.earnest) break;
    console.log(`\nEarnest ${dep.earnest} holds ${usd(await pub.readContract({ address: net.usdc, abi: erc20Abi, functionName: "balanceOf", args: [dep.earnest] }))}`);
    for (const j of await jobs()) console.log(`job ${j.id} ${STATUS[j.status].padEnd(9)} ${usd(j.budget)} ${j.description}`);
    if (!dep.agentId) break;
    const agentId = BigInt(dep.agentId);
    const all = await pub.readContract({ address: net.reputation, abi: reputationAbi, functionName: "getClients", args: [agentId] });
    const summary = (clients: readonly Address[], tag: string) =>
      clients.length
        ? pub.readContract({ address: net.reputation, abi: reputationAbi, functionName: "getSummary", args: [agentId, clients, tag, ""] })
        : Promise.resolve([0n, 0n, 0] as const);
    const [c1, v1] = await summary(all, "");
    const [c2, v2] = await summary([dep.earnest], "earnest");
    console.log(`\nagent ${agentId}: all reviews ${c1} (score ${v1}), Earnest-verified ${c2} (score ${v2})`);
    break;
  }

  default:
    console.log("steps: fund, register, hire, work, evaluate, refund, self-review, fake-review, status");
}

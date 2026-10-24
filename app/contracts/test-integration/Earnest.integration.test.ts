/**
 * Earnest Integration Tests — Live ARC-TESTNET
 * Two scenarios:
 *   1. Happy path: register agent → create agent job → fund → submit → complete (rating 90)
 *   2. Expiry path: create job → fund → wait for expiry → claimRefund
 *
 * Usage:
 *   Phase 1 (wallet provisioning):
 *     cd /home/user/app && bun run contracts/test-integration/Earnest.integration.test.ts
 *
 *   Phase 2 (run tests after faucet drip):
 *     cd /home/user/app && \
 *       CLIENT_WALLET_ID=<id> CLIENT_WALLET_ADDRESS=<addr> \
 *       AGENT_WALLET_ID=<id> AGENT_WALLET_ADDRESS=<addr> \
 *       bun run contracts/test-integration/Earnest.integration.test.ts
 */

import crypto from 'node:crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform';

// ── Constants ──────────────────────────────────────────────────────────────────
const NETWORK = 'ARC-TESTNET';

// Testnet guard
if (!/(TESTNET|SEPOLIA|AMOY|FUJI|BLAZE|ALFAJORES|APOTHEM|DEVNET|HOLESKY)/.test(NETWORK)) {
  console.error(JSON.stringify({ testName: 'testnet-guard', status: 'FAIL', detail: `refusing to run against non-testnet network: ${NETWORK}` }));
  process.exit(1);
}

const EARNEST_ADDRESS   = '0x5268053b86a3ebf1d657b6c9ed4c09617c747f47';
const USDC_ADDRESS      = '0x3600000000000000000000000000000000000000';
const IDENTITY_ADDRESS  = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
const REPUTATION_ADDRESS = '0x8004B663056A597Dffe9eCcC1965A193B7388713';
const TREASURY_ADDRESS  = '0x5B12Ce46C7194aD57d143bC22847224047b1Ef42';

// USDC amounts (6 decimals)
const JOB1_BUDGET = '1000000'; // 1 USDC
const JOB2_BUDGET = '500000';  // 0.5 USDC

// optParams for complete() with rating 90:
// abi.encode(uint8(90)) = 32 bytes, value 90 = 0x5a
const RATING_90_PARAMS = '0x000000000000000000000000000000000000000000000000000000000000005a';

// ── SDK clients ────────────────────────────────────────────────────────────────
const walletsClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.ENTITY_SECRET!,
});

const scpClient = initiateSmartContractPlatformClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.ENTITY_SECRET!,
});

// ── Polling helper ─────────────────────────────────────────────────────────────
const TERMINAL_STATES = new Set(['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED']);

async function waitForTerminal(txId: string, timeoutMs = 180_000): Promise<{ state: string; txHash?: string; errorDetails?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await walletsClient.getTransaction({ id: txId });
    const tx = resp.data?.transaction;
    const state = tx?.state;
    if (state && TERMINAL_STATES.has(state)) {
      return {
        state,
        txHash: (tx as any)?.txHash ?? (tx as any)?.transactionHash,
        errorDetails: (tx as any)?.errorDetails,
      };
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Transaction ${txId} did not reach terminal state within ${timeoutMs}ms`);
}

// ── Query helper ───────────────────────────────────────────────────────────────
async function query(address: string, sig: string, params: string[]): Promise<string[]> {
  const res = await scpClient.queryContract({
    blockchain: NETWORK,
    address,
    abiFunctionSignature: sig,
    abiParameters: params,
  });
  return (res.data?.outputValues ?? []) as string[];
}

// ── Write helper ───────────────────────────────────────────────────────────────
async function write(walletId: string, address: string, sig: string, params: string[]): Promise<{ txId: string }> {
  const resp = await walletsClient.createContractExecutionTransaction({
    walletId,
    contractAddress: address,
    abiFunctionSignature: sig,
    abiParameters: params,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: crypto.randomUUID(),
  });
  const txId = resp.data?.id;
  if (!txId) throw new Error(`Failed to initiate tx for ${sig}: ${JSON.stringify(resp)}`);
  return { txId };
}

// ── Test result collector ──────────────────────────────────────────────────────
interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  detail?: string;
  txHash?: string;
  txId?: string;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];
let exitCode = 0;

function log(r: TestResult) {
  if (r.status === 'FAIL') exitCode = 1;
  console.log(JSON.stringify(r));
  results.push(r);
}

// ── Wallet provisioning phase ─────────────────────────────────────────────────
const clientWalletId   = process.env.CLIENT_WALLET_ID;
const clientWalletAddr = process.env.CLIENT_WALLET_ADDRESS;
const agentWalletId    = process.env.AGENT_WALLET_ID;
const agentWalletAddr  = process.env.AGENT_WALLET_ADDRESS;

if (!clientWalletId || !clientWalletAddr || !agentWalletId || !agentWalletAddr) {
  // Provisioning phase: create both wallets and exit
  console.log(JSON.stringify({ phase: 'wallet_provisioning', step: 'creating_wallets' }));

  const walletSetResp = await walletsClient.createWalletSet({
    name: `earnest-integration-${Date.now()}`,
    idempotencyKey: crypto.randomUUID(),
  });
  const walletSetId = walletSetResp.data?.walletSet?.id;
  if (!walletSetId) throw new Error(`Failed to create wallet set: ${JSON.stringify(walletSetResp)}`);

  const walletsResp = await walletsClient.createWallets({
    blockchains: [NETWORK],
    count: 2,
    accountType: 'EOA',
    walletSetId,
    idempotencyKey: crypto.randomUUID(),
  });

  const wallets = walletsResp.data?.wallets ?? [];
  if (wallets.length < 2) throw new Error(`Expected 2 wallets, got ${wallets.length}: ${JSON.stringify(walletsResp)}`);

  const clientWallet = wallets[0];
  const agentWallet  = wallets[1];

  console.log(JSON.stringify({
    phase: 'wallet_provisioning',
    clientWalletId: clientWallet.id,
    clientWalletAddress: clientWallet.address,
    agentWalletId: agentWallet.id,
    agentWalletAddress: agentWallet.address,
  }));
  process.exit(0);
}

// ── Test phase ────────────────────────────────────────────────────────────────
console.log(JSON.stringify({
  phase: 'test_execution',
  clientWalletAddress: clientWalletAddr,
  agentWalletAddress: agentWalletAddr,
}));

// ── SCENARIO 1: Happy path ─────────────────────────────────────────────────────

let agentId: string | null = null;
let jobId1: string | null = null;

// Step 1: Register agent with IdentityRegistry
{
  const t0 = Date.now();
  try {
    const { txId } = await write(
      agentWalletId,
      IDENTITY_ADDRESS,
      'registerAgent(string)',
      ['https://example.com/agent.json'],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    if (state !== 'COMPLETE') {
      log({ testName: 'S1: registerAgent', status: 'FAIL', txId, detail: `state=${state} errorDetails=${errorDetails}`, durationMs: Date.now() - t0 });
    } else {
      // Read agentId by finding out the total supply or ownerOf — query ownerOf for increasing ids
      // Actually we need to query the counter. Try getLastTokenId or totalSupply, or just query
      // with current block. Instead, let's poll increasing IDs to find one owned by agentWallet.
      // Simpler: query ownerOf(1..N) until we find agentWalletAddr or use jobCounter approach.
      // Best: the IdentityRegistry likely has a counter. Try totalSupply first.
      let foundId: string | null = null;
      try {
        const [supply] = await query(IDENTITY_ADDRESS, 'totalSupply()', []);
        // The newly minted token should be at supply (latest)
        foundId = supply;
      } catch {
        // totalSupply not available, try scanning from 1
        for (let i = 1; i <= 50; i++) {
          try {
            const [owner] = await query(IDENTITY_ADDRESS, 'ownerOf(uint256)', [i.toString()]);
            if (owner.toLowerCase() === agentWalletAddr.toLowerCase()) {
              foundId = i.toString();
              break;
            }
          } catch { break; }
        }
      }
      if (foundId) {
        agentId = foundId;
        log({ testName: 'S1: registerAgent', status: 'PASS', txId, txHash, detail: `agentId=${agentId}`, durationMs: Date.now() - t0 });
      } else {
        log({ testName: 'S1: registerAgent', status: 'FAIL', txId, txHash, detail: 'Could not determine agentId after registration', durationMs: Date.now() - t0 });
      }
    }
  } catch (e: any) {
    log({ testName: 'S1: registerAgent', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 2: Verify ownerOf(agentId) == agentWalletAddr
if (agentId) {
  const t0 = Date.now();
  try {
    const [owner] = await query(IDENTITY_ADDRESS, 'ownerOf(uint256)', [agentId]);
    const pass = owner.toLowerCase() === agentWalletAddr.toLowerCase();
    log({
      testName: 'S1: ownerOf(agentId) == agentWallet',
      status: pass ? 'PASS' : 'FAIL',
      detail: `expected=${agentWalletAddr} got=${owner}`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: ownerOf(agentId) == agentWallet', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 3: Approve Earnest to spend USDC (client wallet approves 2 USDC total for both jobs)
{
  const t0 = Date.now();
  try {
    const { txId } = await write(
      clientWalletId,
      USDC_ADDRESS,
      'approve(address,uint256)',
      [EARNEST_ADDRESS, '2000000'],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S1: approve USDC for Earnest',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : 'approved 2 USDC',
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: approve USDC for Earnest', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 4: createAgentJob — client is evaluator; expiry = now + 2 hours
if (agentId) {
  const t0 = Date.now();
  try {
    const expiredAt = (Math.floor(Date.now() / 1000) + 7200).toString(); // +2h
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'createAgentJob(uint256,address,uint256,string,uint256)',
      [agentId, clientWalletAddr, expiredAt, 'Integration test job', JOB1_BUDGET],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    if (state === 'COMPLETE') {
      // Read jobCounter to learn the jobId
      const [counter] = await query(EARNEST_ADDRESS, 'jobCounter()', []);
      jobId1 = counter; // latest job
      log({ testName: 'S1: createAgentJob', status: 'PASS', txId, txHash, detail: `jobId=${jobId1}`, durationMs: Date.now() - t0 });
    } else {
      log({ testName: 'S1: createAgentJob', status: 'FAIL', txId, txHash, detail: `state=${state} errorDetails=${errorDetails}`, durationMs: Date.now() - t0 });
    }
  } catch (e: any) {
    log({ testName: 'S1: createAgentJob', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 5: Verify getJob — status==Open, provider==agentWallet
if (jobId1) {
  const t0 = Date.now();
  try {
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId1]);
    // out is a tuple — outputValues may be a single stringified object or array
    // The SCP query returns outputValues as array; for a tuple it's typically [JSON-string]
    const jobRaw = out[0];
    let status: number;
    let provider: string;
    let budget: string;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      const j = JSON.parse(jobRaw);
      status = Number(j.status);
      provider = j.provider;
      budget = j.budget;
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      const j = jobRaw as any;
      status = Number(j.status);
      provider = j.provider;
      budget = j.budget;
    } else {
      // outputValues may be spread as separate elements for each tuple field
      // [id, client, provider, evaluator, description, budget, expiredAt, status, hook]
      status = Number(out[7]);
      provider = out[2];
      budget = out[5];
    }
    const providerOk = provider?.toLowerCase() === agentWalletAddr.toLowerCase();
    const statusOk = status === 0; // Open
    const budgetOk = budget?.toString() === JOB1_BUDGET;
    const pass = providerOk && statusOk && budgetOk;
    log({
      testName: 'S1: getJob after createAgentJob',
      status: pass ? 'PASS' : 'FAIL',
      detail: `status=${status}(Open=0) provider=${provider} budget=${budget}`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: getJob after createAgentJob', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 6: fund the job
if (jobId1) {
  const t0 = Date.now();
  try {
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'fund(uint256,bytes)',
      [jobId1, '0x'],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S1: fund(jobId1)',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : `funded ${JOB1_BUDGET} USDC`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: fund(jobId1)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 7: Verify status == Funded (1)
if (jobId1) {
  const t0 = Date.now();
  try {
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId1]);
    const jobRaw = out[0];
    let status: number;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      status = Number(JSON.parse(jobRaw).status);
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      status = Number((jobRaw as any).status);
    } else {
      status = Number(out[7]);
    }
    log({
      testName: 'S1: job status == Funded after fund()',
      status: status === 1 ? 'PASS' : 'FAIL',
      detail: `status=${status} (Funded=1)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: job status == Funded after fund()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 8: submit (from agent wallet)
if (jobId1) {
  const t0 = Date.now();
  try {
    const deliverable = '0x' + Buffer.from('my deliverable').toString('hex').padEnd(64, '0');
    const deliverableHash = '0x6d792064656c697665261626c650000000000000000000000000000000000000';
    // Use a proper bytes32 deliverable hash
    const delBytes32 = '0x6d792064656c6976657261626c650000000000000000000000000000000000';
    // Ensure exactly 32 bytes (66 hex chars including 0x)
    const del32 = '0x6d792064656c6976657261626c650000000000000000000000000000000000'.padEnd(66, '0').slice(0, 66);
    const { txId } = await write(
      agentWalletId,
      EARNEST_ADDRESS,
      'submit(uint256,bytes32,bytes)',
      [jobId1, del32, '0x'],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S1: submit(jobId1)',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : 'submitted deliverable',
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: submit(jobId1)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 9: Verify status == Submitted (2)
if (jobId1) {
  const t0 = Date.now();
  try {
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId1]);
    const jobRaw = out[0];
    let status: number;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      status = Number(JSON.parse(jobRaw).status);
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      status = Number((jobRaw as any).status);
    } else {
      status = Number(out[7]);
    }
    log({
      testName: 'S1: job status == Submitted after submit()',
      status: status === 2 ? 'PASS' : 'FAIL',
      detail: `status=${status} (Submitted=2)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: job status == Submitted after submit()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 10: Read agent and treasury USDC balances before complete()
let agentBalanceBefore = BigInt(0);
let treasuryBalanceBefore = BigInt(0);
{
  try {
    const [ab] = await query(USDC_ADDRESS, 'balanceOf(address)', [agentWalletAddr]);
    const [tb] = await query(USDC_ADDRESS, 'balanceOf(address)', [TREASURY_ADDRESS]);
    agentBalanceBefore = BigInt(ab ?? '0');
    treasuryBalanceBefore = BigInt(tb ?? '0');
  } catch (e: any) {
    console.log(JSON.stringify({ phase: 'balance_read', error: e.message }));
  }
}

// Step 11: complete(jobId1, reason=0x00..., optParams=abi.encode(uint8(90)))
if (jobId1) {
  const t0 = Date.now();
  try {
    const reason = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'complete(uint256,bytes32,bytes)',
      [jobId1, reason, RATING_90_PARAMS],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S1: complete(jobId1, rating=90)',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : 'completed with rating 90',
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: complete(jobId1, rating=90)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 12: Verify status == Completed (3)
if (jobId1) {
  const t0 = Date.now();
  try {
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId1]);
    const jobRaw = out[0];
    let status: number;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      status = Number(JSON.parse(jobRaw).status);
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      status = Number((jobRaw as any).status);
    } else {
      status = Number(out[7]);
    }
    log({
      testName: 'S1: job status == Completed after complete()',
      status: status === 3 ? 'PASS' : 'FAIL',
      detail: `status=${status} (Completed=3)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: job status == Completed after complete()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 13: Verify payment split — agent got 990_000, treasury got 10_000
if (jobId1) {
  const t0 = Date.now();
  try {
    const [ab] = await query(USDC_ADDRESS, 'balanceOf(address)', [agentWalletAddr]);
    const [tb] = await query(USDC_ADDRESS, 'balanceOf(address)', [TREASURY_ADDRESS]);
    const agentDelta = BigInt(ab ?? '0') - agentBalanceBefore;
    const treasuryDelta = BigInt(tb ?? '0') - treasuryBalanceBefore;
    const agentOk = agentDelta === BigInt(990_000);
    const treasuryOk = treasuryDelta === BigInt(10_000);
    log({
      testName: 'S1: payment split 99%/1%',
      status: (agentOk && treasuryOk) ? 'PASS' : 'FAIL',
      detail: `agentDelta=${agentDelta} (want 990000), treasuryDelta=${treasuryDelta} (want 10000)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: payment split 99%/1%', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 14: Check paidVolume and reviewCount
if (agentId && jobId1) {
  const t0 = Date.now();
  try {
    const [pv] = await query(EARNEST_ADDRESS, 'paidVolume(uint256)', [agentId]);
    const [rc] = await query(EARNEST_ADDRESS, 'reviewCount(uint256)', [agentId]);
    const pvOk = pv?.toString() === JOB1_BUDGET;
    const rcOk = rc?.toString() === '1';
    log({
      testName: 'S1: paidVolume and reviewCount',
      status: (pvOk && rcOk) ? 'PASS' : 'FAIL',
      detail: `paidVolume=${pv} (want ${JOB1_BUDGET}), reviewCount=${rc} (want 1)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: paidVolume and reviewCount', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 15: ReputationRegistry.getSummary — expect count=1, average=90
if (agentId) {
  const t0 = Date.now();
  try {
    // getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)
    // SCP abiParameters: pass array as JSON string for address[]
    const out = await query(
      REPUTATION_ADDRESS,
      'getSummary(uint256,address[],string,string)',
      [agentId, JSON.stringify([EARNEST_ADDRESS]), 'earnest', ''],
    );
    // returns (uint64 count, int128 average, uint8 averageDecimals)
    const count = out[0];
    const average = out[1];
    const decimals = out[2];
    const countOk = count?.toString() === '1';
    const avgOk = Number(average) === 90;
    log({
      testName: 'S1: ReputationRegistry.getSummary count=1 avg=90',
      status: (countOk && avgOk) ? 'PASS' : 'FAIL',
      detail: `count=${count} average=${average} decimals=${decimals}`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S1: ReputationRegistry.getSummary count=1 avg=90', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// ── SCENARIO 2: Expiry path ────────────────────────────────────────────────────

let jobId2: string | null = null;

// Step 1: createAgentJob with expiry = now + 5min15s (just above the 5 min minimum)
if (agentId) {
  const t0 = Date.now();
  try {
    const expiredAt = (Math.floor(Date.now() / 1000) + 315).toString(); // +5min15s
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'createAgentJob(uint256,address,uint256,string,uint256)',
      [agentId, clientWalletAddr, expiredAt, 'Expiry test job', JOB2_BUDGET],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    if (state === 'COMPLETE') {
      const [counter] = await query(EARNEST_ADDRESS, 'jobCounter()', []);
      jobId2 = counter;
      log({ testName: 'S2: createAgentJob (expiry)', status: 'PASS', txId, txHash, detail: `jobId=${jobId2} expiredAt=${expiredAt}`, durationMs: Date.now() - t0 });
    } else {
      log({ testName: 'S2: createAgentJob (expiry)', status: 'FAIL', txId, txHash, detail: `state=${state} errorDetails=${errorDetails}`, durationMs: Date.now() - t0 });
    }
  } catch (e: any) {
    log({ testName: 'S2: createAgentJob (expiry)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 2: Read client USDC balance before fund
let clientBalanceBeforeFund = BigInt(0);
if (jobId2) {
  try {
    const [cb] = await query(USDC_ADDRESS, 'balanceOf(address)', [clientWalletAddr]);
    clientBalanceBeforeFund = BigInt(cb ?? '0');
  } catch {}
}

// Step 3: fund the job
if (jobId2) {
  const t0 = Date.now();
  try {
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'fund(uint256,bytes)',
      [jobId2, '0x'],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S2: fund(jobId2)',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : `funded ${JOB2_BUDGET} USDC`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S2: fund(jobId2)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 4: Verify balance decreased by 500_000
if (jobId2) {
  const t0 = Date.now();
  try {
    const [cb] = await query(USDC_ADDRESS, 'balanceOf(address)', [clientWalletAddr]);
    const delta = clientBalanceBeforeFund - BigInt(cb ?? '0');
    const pass = delta === BigInt(500_000);
    log({
      testName: 'S2: client balance decreased by 500000 after fund()',
      status: pass ? 'PASS' : 'FAIL',
      detail: `delta=${delta} (want 500000)`,
      durationMs: Date.now() - t0,
    });
    clientBalanceBeforeFund = BigInt(cb ?? '0'); // update for refund check
  } catch (e: any) {
    log({ testName: 'S2: client balance decreased by 500000 after fund()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 5: Wait for expiry — poll getJob.expiredAt then wait until block.timestamp >= expiredAt
if (jobId2) {
  const t0 = Date.now();
  console.log(JSON.stringify({ phase: 'waiting_for_expiry', jobId: jobId2, note: 'polling chain until expiredAt' }));
  try {
    // Get expiredAt from the job
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId2]);
    const jobRaw = out[0];
    let expiredAt: number;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      expiredAt = Number(JSON.parse(jobRaw).expiredAt);
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      expiredAt = Number((jobRaw as any).expiredAt);
    } else {
      expiredAt = Number(out[6]);
    }

    const waitMs = (expiredAt * 1000 - Date.now()) + 15_000; // 15s buffer
    console.log(JSON.stringify({ phase: 'waiting_for_expiry', expiredAt, waitMs: Math.max(waitMs, 0) }));

    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }

    log({ testName: 'S2: waited for job expiry', status: 'PASS', detail: `waited until expiredAt=${expiredAt}`, durationMs: Date.now() - t0 });
  } catch (e: any) {
    log({ testName: 'S2: waited for job expiry', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 6: claimRefund
if (jobId2) {
  const t0 = Date.now();
  try {
    const { txId } = await write(
      clientWalletId,
      EARNEST_ADDRESS,
      'claimRefund(uint256)',
      [jobId2],
    );
    const { state, txHash, errorDetails } = await waitForTerminal(txId);
    log({
      testName: 'S2: claimRefund(jobId2)',
      status: state === 'COMPLETE' ? 'PASS' : 'FAIL',
      txId, txHash,
      detail: state !== 'COMPLETE' ? `state=${state} errorDetails=${errorDetails}` : 'refund claimed',
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S2: claimRefund(jobId2)', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 7: Verify client got 500_000 back
if (jobId2) {
  const t0 = Date.now();
  try {
    const [cb] = await query(USDC_ADDRESS, 'balanceOf(address)', [clientWalletAddr]);
    const delta = BigInt(cb ?? '0') - clientBalanceBeforeFund;
    const pass = delta === BigInt(500_000);
    log({
      testName: 'S2: client refunded 500000 USDC after claimRefund()',
      status: pass ? 'PASS' : 'FAIL',
      detail: `delta=${delta} (want 500000) newBalance=${cb}`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S2: client refunded 500000 USDC after claimRefund()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// Step 8: Verify status == Expired (5)
if (jobId2) {
  const t0 = Date.now();
  try {
    const out = await query(EARNEST_ADDRESS, 'getJob(uint256)', [jobId2]);
    const jobRaw = out[0];
    let status: number;
    if (typeof jobRaw === 'string' && jobRaw.startsWith('{')) {
      status = Number(JSON.parse(jobRaw).status);
    } else if (typeof jobRaw === 'object' && jobRaw !== null) {
      status = Number((jobRaw as any).status);
    } else {
      status = Number(out[7]);
    }
    log({
      testName: 'S2: job status == Expired after claimRefund()',
      status: status === 5 ? 'PASS' : 'FAIL',
      detail: `status=${status} (Expired=5)`,
      durationMs: Date.now() - t0,
    });
  } catch (e: any) {
    log({ testName: 'S2: job status == Expired after claimRefund()', status: 'FAIL', error: e.message, durationMs: Date.now() - t0 });
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
const passed  = results.filter(r => r.status === 'PASS').length;
const failed  = results.filter(r => r.status === 'FAIL').length;
const skipped = results.filter(r => r.status === 'SKIPPED').length;
console.log(JSON.stringify({ phase: 'summary', passed, failed, skipped, total: results.length }));

process.exit(exitCode);

/**
 * One-shot USDC transfer script — ARC-TESTNET
 * Sends exactly 3 USDC (3_000_000 base units) to a recipient address.
 *
 * Phase 1 (no env vars): creates a fresh dev-controlled wallet and prints its
 *   id + address, then exits 0.  The caller drips USDC to the printed address,
 *   then re-runs with SENDER_WALLET_ID set.
 *
 * Phase 2 (SENDER_WALLET_ID set): executes the transfer and reports the tx hash.
 *
 * Usage:
 *   cd /home/user/app
 *   bun run contracts/test-integration/usdc-transfer.ts
 *   # (drip USDC to printed address via faucet)
 *   SENDER_WALLET_ID=<id> bun run contracts/test-integration/usdc-transfer.ts
 */

import crypto from 'node:crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// ── Constants ─────────────────────────────────────────────────────────────────
const NETWORK           = 'ARC-TESTNET';
const USDC_ADDRESS      = '0x3600000000000000000000000000000000000000';
const RECIPIENT_ADDRESS = '0xC67d319fBd2b8b59B387601E7622F9507eea81D6';
const TRANSFER_AMOUNT   = '3000000'; // 3 USDC in 6-decimal base units

// Testnet guard
if (!/(TESTNET|SEPOLIA|AMOY|FUJI|BLAZE|ALFAJORES|APOTHEM|DEVNET|HOLESKY)/.test(NETWORK)) {
  console.error(JSON.stringify({ status: 'FAIL', detail: `refusing to run against non-testnet: ${NETWORK}` }));
  process.exit(1);
}

// ── SDK client ────────────────────────────────────────────────────────────────
const walletsClient = initiateDeveloperControlledWalletsClient({
  apiKey:       process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.ENTITY_SECRET!,
});

// ── Polling helper ────────────────────────────────────────────────────────────
const TERMINAL_STATES = new Set(['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED']);

async function waitForTerminal(
  txId: string,
  timeoutMs = 180_000,
): Promise<{ state: string; txHash?: string; errorDetails?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await walletsClient.getTransaction({ id: txId });
    const tx   = resp.data?.transaction;
    const state = tx?.state;
    if (state && TERMINAL_STATES.has(state)) {
      return {
        state,
        txHash:       (tx as any)?.txHash ?? (tx as any)?.transactionHash,
        errorDetails: (tx as any)?.errorDetails,
      };
    }
    await new Promise(r => setTimeout(r, 3_000));
  }
  throw new Error(`Transaction ${txId} did not reach terminal state within ${timeoutMs}ms`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — wallet provisioning
// ─────────────────────────────────────────────────────────────────────────────
const senderWalletId = process.env.SENDER_WALLET_ID;

if (!senderWalletId) {
  console.log(JSON.stringify({ phase: 'wallet_provisioning', step: 'creating_wallet' }));

  const walletSetResp = await walletsClient.createWalletSet({
    name:            `usdc-transfer-${Date.now()}`,
    idempotencyKey:  crypto.randomUUID(),
  });
  const walletSetId = walletSetResp.data?.walletSet?.id;
  if (!walletSetId) {
    console.error(JSON.stringify({ status: 'FAIL', detail: 'Failed to create wallet set', raw: JSON.stringify(walletSetResp) }));
    process.exit(1);
  }

  const walletsResp = await walletsClient.createWallets({
    blockchains:   [NETWORK],
    count:         1,
    accountType:   'EOA',
    walletSetId,
    idempotencyKey: crypto.randomUUID(),
  });

  const wallets = walletsResp.data?.wallets ?? [];
  if (wallets.length < 1) {
    console.error(JSON.stringify({ status: 'FAIL', detail: 'No wallets returned', raw: JSON.stringify(walletsResp) }));
    process.exit(1);
  }

  const wallet = wallets[0];
  console.log(JSON.stringify({
    phase:         'wallet_provisioning',
    walletId:      wallet.id,
    walletAddress: wallet.address,
    instructions:  `Drip USDC to ${wallet.address} on ${NETWORK}, then re-run with SENDER_WALLET_ID=${wallet.id}`,
  }));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — execute transfer
// ─────────────────────────────────────────────────────────────────────────────
console.log(JSON.stringify({
  phase:          'transfer',
  senderWalletId,
  recipient:      RECIPIENT_ADDRESS,
  amount:         TRANSFER_AMOUNT,
  usdcContract:   USDC_ADDRESS,
  network:        NETWORK,
}));

// ABI-encode transfer(address,uint256)
// Using Circle SDK's abiFunctionSignature / abiParameters approach (same as the SCP client)
// — but we call it as a contract-execution transaction on the wallets client.
const txResp = await walletsClient.createContractExecutionTransaction({
  walletId:             senderWalletId,
  contractAddress:      USDC_ADDRESS,
  abiFunctionSignature: 'transfer(address,uint256)',
  abiParameters:        [RECIPIENT_ADDRESS, TRANSFER_AMOUNT],
  fee:                  { type: 'level', config: { feeLevel: 'MEDIUM' } },
  idempotencyKey:       crypto.randomUUID(),
});

const txId = txResp.data?.id;
if (!txId) {
  console.error(JSON.stringify({ status: 'FAIL', detail: 'createContractExecutionTransaction returned no id', raw: JSON.stringify(txResp) }));
  process.exit(1);
}

console.log(JSON.stringify({ phase: 'transfer', step: 'waiting', txId }));

const { state, txHash, errorDetails } = await waitForTerminal(txId);

if (state !== 'COMPLETE') {
  console.error(JSON.stringify({
    status:       'FAIL',
    txId,
    state,
    errorDetails,
    detail:       `Transfer did not complete — state: ${state}`,
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  status:    'PASS',
  txId,
  txHash,
  recipient: RECIPIENT_ADDRESS,
  amount:    TRANSFER_AMOUNT,
  network:   NETWORK,
  detail:    'Transfer of 3 USDC completed successfully',
}));
process.exit(0);

/**
 * Debug RPC proxy response format for Arc Testnet
 */

const RPC_BASE = process.env.RPC_PROXY_BASE_URL;
const RPC_TOKEN = process.env.RPC_PROXY_TOKEN;
const RPC_CHAINS = (process.env.RPC_PROXY_CHAINS ?? '').split(',');

const compassChain = 'Arc_Testnet';
const RPC_URL = RPC_BASE && RPC_CHAINS.includes(compassChain)
  ? `${RPC_BASE}/api/rpc/${compassChain}?_rpc_token=${RPC_TOKEN}`
  : null;

if (!RPC_URL) {
  console.error('No RPC URL');
  process.exit(1);
}

// Dump the full raw response
const resp = await fetch(RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
});
const text = await resp.text();
console.log('STATUS:', resp.status);
console.log('RAW:', text.slice(0, 500));

// Also try eth_blockNumber
const resp2 = await fetch(RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 }),
});
const text2 = await resp2.text();
console.log('BLOCKNUM:', text2.slice(0, 200));

// Try eth_call for USDC balanceOf on recipient  
const USDC = '0x3600000000000000000000000000000000000000';
const RECIPIENT = '0xC67d319fBd2b8b59B387601E7622F9507eea81D6';
const data = '0x70a08231' + '000000000000000000000000' + RECIPIENT.slice(2).toLowerCase();

const resp3 = await fetch(RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: USDC, data }, 'latest'], id: 3 }),
});
const text3 = await resp3.text();
console.log('BALANCEOF:', text3.slice(0, 300));

process.exit(0);

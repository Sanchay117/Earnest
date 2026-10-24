// Test if RPC is alive (Bun reads .env automatically from cwd)
const RPC_BASE = process.env.RPC_PROXY_BASE_URL;
const RPC_TOKEN = process.env.RPC_PROXY_TOKEN;
const RPC_CHAINS = (process.env.RPC_PROXY_CHAINS ?? '').split(',');

const compassChain = 'Arc_Testnet';
const RPC_URL = RPC_BASE && RPC_CHAINS.includes(compassChain)
  ? `${RPC_BASE}/api/rpc/${compassChain}?_rpc_token=${RPC_TOKEN}`
  : null;

console.log({ rpcAvailable: !!RPC_URL, chains: RPC_CHAINS.slice(0, 5) });

if (!RPC_URL) { console.error('no rpc'); process.exit(1); }

const resp = await fetch(RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
});
const text = await resp.text();
console.log('status:', resp.status, 'body:', text.slice(0, 200));
process.exit(0);

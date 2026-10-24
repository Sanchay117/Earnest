/**
 * Check USDC balance on Arc Testnet via RPC proxy
 */

const RPC_BASE = process.env.RPC_PROXY_BASE_URL;
const RPC_TOKEN = process.env.RPC_PROXY_TOKEN;
const RPC_CHAINS = (process.env.RPC_PROXY_CHAINS ?? '').split(',');

const compassChain = 'Arc_Testnet';
const RPC_URL = RPC_BASE && RPC_CHAINS.includes(compassChain)
  ? `${RPC_BASE}/api/rpc/${compassChain}?_rpc_token=${RPC_TOKEN}`
  : null;

console.log(JSON.stringify({ rpcAvailable: !!RPC_URL }));

if (!RPC_URL) {
  console.error('No RPC URL available');
  process.exit(1);
}

const USDC = '0x3600000000000000000000000000000000000000';
const RECIPIENT = '0xC67d319fBd2b8b59B387601E7622F9507eea81D6';

async function rpc(method: string, params: any[]): Promise<any> {
  const resp = await fetch(RPC_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json = await resp.json() as any;
  console.log(JSON.stringify({ method, result: json.result, error: json.error }));
  return json;
}

// balanceOf(address) = 0x70a08231
const balanceOfSelector = '0x70a08231';
const paddedAddress = (addr: string) => '000000000000000000000000' + addr.slice(2).toLowerCase();

async function balanceOf(address: string): Promise<string> {
  const data = balanceOfSelector + paddedAddress(address);
  const resp = await rpc('eth_call', [{ to: USDC, data }, 'latest']);
  if (resp.error) throw new Error(`eth_call error: ${JSON.stringify(resp.error)}`);
  const hex = resp.result as string;
  if (!hex || hex === '0x') return '0';
  const padded = hex.startsWith('0x') ? hex : '0x' + hex;
  return BigInt(padded).toString();
}

// Check chain id
await rpc('eth_chainId', []);
await rpc('eth_blockNumber', []);

// Check recipient balance
const recipientBal = await balanceOf(RECIPIENT);
console.log(JSON.stringify({ address: RECIPIENT, usdcBalance: recipientBal, label: 'recipient' }));

// Check well-known anvil 0
const anvil0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const anvil0Bal = await balanceOf(anvil0);
console.log(JSON.stringify({ address: anvil0, usdcBalance: anvil0Bal, label: 'anvil0' }));

process.exit(0);

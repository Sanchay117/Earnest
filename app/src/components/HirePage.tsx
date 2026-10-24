import { useState } from 'react'
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { encodeAbiParameters, parseAbiParameters, createPublicClient, http } from 'viem'
import { ExternalLink, ChevronDown } from 'lucide-react'
import { EARNEST_ABI, USDC_ABI } from '../lib/abis'
import { formatUsdc, shortAddr } from '../lib/format'
import type { NetworkConfig } from '../config'

interface Props {
  network: NetworkConfig
  networkKey: string
}

const DEADLINE_OPTIONS = [
  { label: '30 minutes', value: 30 * 60 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 6 * 3600 },
  { label: '1 day', value: 86400 },
  { label: '3 days', value: 3 * 86400 },
  { label: '1 week', value: 7 * 86400 },
]

interface TxState {
  hash?: string
  status: 'idle' | 'pending' | 'success' | 'error'
  label: string
  error?: string
}

function TxRow({ tx, explorer }: { tx: TxState; explorer: string }) {
  if (tx.status === 'idle') return null
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 8, background: 'var(--surface-muted)',
        border: `1px solid ${tx.status === 'error' ? 'var(--danger)' : 'var(--border)'}`,
      }}
    >
      {tx.status === 'pending' && (
        <span
          style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid var(--accent)', borderTopColor: 'transparent',
            display: 'inline-block', animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {tx.status === 'success' && <span style={{ color: 'var(--success)' }}>✓</span>}
      {tx.status === 'error' && <span style={{ color: 'var(--danger)' }}>✗</span>}
      <span style={{ fontSize: 13, flex: 1 }}>
        {tx.label}{tx.status === 'error' ? `: ${tx.error}` : ''}
      </span>
      {tx.hash && (
        <a
          href={`${explorer}/tx/${tx.hash}`}
          target="_blank" rel="noopener noreferrer"
          className="mono"
          style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          {shortAddr(tx.hash)} <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}

export function HirePage({ network, networkKey }: Props) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const notDeployed = network.earnest === '0x0000000000000000000000000000000000000000'
  const onRightChain = chainId === network.chainId

  const [agentId, setAgentId] = useState(String(network.agentId))
  const [description, setDescription] = useState('')
  const [budgetUsdc, setBudgetUsdc] = useState('1')
  const [deadlineSeconds, setDeadlineSeconds] = useState(3600)
  const [evaluator, setEvaluator] = useState('')
  const [useConnectedAsEvaluator, setUseConnectedAsEvaluator] = useState(true)

  const [jobId, setJobId] = useState<bigint | null>(null)
  const [createTx, setCreateTx] = useState<TxState>({ status: 'idle', label: 'Create job' })
  const [approveTx, setApproveTx] = useState<TxState>({ status: 'idle', label: 'Approve USDC' })
  const [fundTx, setFundTx] = useState<TxState>({ status: 'idle', label: 'Fund job' })

  const resolvedEvaluator = useConnectedAsEvaluator ? (address ?? '') : evaluator

  async function handleCreate() {
    if (!address || !onRightChain) return
    setCreateTx({ status: 'pending', label: 'Creating job…' })
    try {
      const agentIdBig = BigInt(agentId)
      const budgetRaw = BigInt(Math.round(parseFloat(budgetUsdc) * 1e6))
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)
      const evalAddr = resolvedEvaluator as `0x${string}`

      const hash = await writeContractAsync({
        address: network.earnest,
        abi: EARNEST_ABI,
        functionName: 'createAgentJob',
        args: [agentIdBig, evalAddr, expiredAt, description, budgetRaw],
        chainId: network.chainId,
      })
      setCreateTx({ status: 'pending', label: 'Creating job…', hash })

      // Wait for receipt and decode jobId from event
      const client = createPublicClient({ transport: http(network.rpc) })
      await client.waitForTransactionReceipt({ hash })
      // Read jobCounter to get the new jobId
      const counter = await client.readContract({
        address: network.earnest, abi: EARNEST_ABI, functionName: 'jobCounter',
      })
      const newJobId = counter
      setJobId(newJobId)
      setCreateTx({ status: 'success', label: `Job #${newJobId} created`, hash })
    } catch (e) {
      setCreateTx({ status: 'error', label: 'Create job', error: (e as Error).message.slice(0, 80) })
    }
  }

  async function handleApprove() {
    if (!address || !onRightChain || !jobId) return
    setApproveTx({ status: 'pending', label: 'Approving USDC…' })
    try {
      const budgetRaw = BigInt(Math.round(parseFloat(budgetUsdc) * 1e6))
      const hash = await writeContractAsync({
        address: network.usdc, abi: USDC_ABI,
        functionName: 'approve',
        args: [network.earnest, budgetRaw],
        chainId: network.chainId,
      })
      const client = createPublicClient({ transport: http(network.rpc) })
      await client.waitForTransactionReceipt({ hash })
      setApproveTx({ status: 'success', label: 'USDC approved', hash })
    } catch (e) {
      setApproveTx({ status: 'error', label: 'Approve USDC', error: (e as Error).message.slice(0, 80) })
    }
  }

  async function handleFund() {
    if (!address || !onRightChain || !jobId) return
    setFundTx({ status: 'pending', label: 'Funding job…' })
    try {
      const budgetRaw = BigInt(Math.round(parseFloat(budgetUsdc) * 1e6))
      const optParams = encodeAbiParameters(parseAbiParameters('uint256'), [budgetRaw])
      const hash = await writeContractAsync({
        address: network.earnest, abi: EARNEST_ABI,
        functionName: 'fund',
        args: [jobId, optParams],
        chainId: network.chainId,
      })
      const client = createPublicClient({ transport: http(network.rpc) })
      await client.waitForTransactionReceipt({ hash })
      setFundTx({ status: 'success', label: `Job #${jobId} funded with $${formatUsdc(budgetRaw)} USDC`, hash })
    } catch (e) {
      setFundTx({ status: 'error', label: 'Fund job', error: (e as Error).message.slice(0, 80) })
    }
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '32px 16px' }}>
      <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>
        Hire an Agent
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        Create a job, approve USDC, and fund it. The agent gets paid when the job completes.
      </p>

      {notDeployed && (
        <div
          style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--surface-muted)', border: '1px solid var(--border)',
            marginBottom: 24, fontSize: 14, color: 'var(--muted)',
          }}
        >
          Earnest is not deployed on mainnet yet. Switch to testnet to try it.
        </div>
      )}

      {!address ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>Connect a wallet to hire an agent.</p>
          <ConnectKitButton />
        </div>
      ) : !onRightChain ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Switch to Arc {networkKey === 'mainnet' ? 'Mainnet' : 'Testnet'} (chain {network.chainId}) to continue.
          </p>
          <button
            onClick={() => switchChain({ chainId: network.chainId })}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: 'white', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Switch network
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Form */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16, padding: '20px 20px',
            }}
          >
            <Field label="Agent ID">
              <input
                type="number" value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={createTx.status === 'success'}
                style={inputStyle}
              />
            </Field>

            <Field label="Task description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the work to be done…"
                disabled={createTx.status === 'success'}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              />
            </Field>

            <Field label="Budget (USDC)">
              <input
                type="number" value={budgetUsdc} min="0.000001" step="0.01"
                onChange={(e) => setBudgetUsdc(e.target.value)}
                disabled={createTx.status === 'success'}
                style={inputStyle}
              />
            </Field>

            <Field label="Deadline">
              <div style={{ position: 'relative' }}>
                <select
                  value={deadlineSeconds}
                  onChange={(e) => setDeadlineSeconds(Number(e.target.value))}
                  disabled={createTx.status === 'success'}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
                >
                  {DEADLINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--subtle)' }}
                />
              </div>
            </Field>

            <Field label="Evaluator">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
                <input
                  type="checkbox" checked={useConnectedAsEvaluator}
                  onChange={(e) => setUseConnectedAsEvaluator(e.target.checked)}
                />
                Use my wallet ({shortAddr(address)})
              </label>
              {!useConnectedAsEvaluator && (
                <input
                  type="text" value={evaluator}
                  onChange={(e) => setEvaluator(e.target.value)}
                  placeholder="0x…"
                  style={inputStyle}
                />
              )}
            </Field>

            <button
              onClick={() => void handleCreate()}
              disabled={!description || createTx.status === 'success' || createTx.status === 'pending' || notDeployed}
              style={{
                ...btnStyle,
                opacity: (!description || createTx.status === 'success' || createTx.status === 'pending' || notDeployed) ? 0.5 : 1,
                marginTop: 4,
              }}
            >
              {createTx.status === 'pending' ? 'Creating…' : 'Create job'}
            </button>
          </div>

          {/* Tx statuses */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TxRow tx={createTx} explorer={network.explorer} />
          </div>

          {/* Approve + Fund */}
          {jobId !== null && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16, padding: '20px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
                Job #{jobId.toString()} created. Approve USDC then fund the job.
              </p>
              <button
                onClick={() => void handleApprove()}
                disabled={approveTx.status === 'success' || approveTx.status === 'pending'}
                style={{
                  ...btnStyle,
                  background: 'var(--surface-muted)',
                  color: 'var(--ink)',
                  border: '1px solid var(--border)',
                  opacity: (approveTx.status === 'success' || approveTx.status === 'pending') ? 0.5 : 1,
                }}
              >
                {approveTx.status === 'pending' ? 'Approving…' : `Approve $${formatUsdc(BigInt(Math.round(parseFloat(budgetUsdc) * 1e6)))} USDC`}
              </button>
              <TxRow tx={approveTx} explorer={network.explorer} />
              <button
                onClick={() => void handleFund()}
                disabled={approveTx.status !== 'success' || fundTx.status === 'success' || fundTx.status === 'pending'}
                style={{
                  ...btnStyle,
                  opacity: (approveTx.status !== 'success' || fundTx.status === 'success' || fundTx.status === 'pending') ? 0.5 : 1,
                }}
              >
                {fundTx.status === 'pending' ? 'Funding…' : 'Fund job'}
              </button>
              <TxRow tx={fundTx} explorer={network.explorer} />
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--surface-muted)', color: 'var(--ink)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
  background: 'var(--accent)', color: 'white', fontWeight: 600,
  fontSize: 14, cursor: 'pointer',
}

import { useState } from 'react'
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { createPublicClient, http, keccak256, toHex, encodeAbiParameters, parseAbiParameters } from 'viem'
import { ExternalLink, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useJobs, type Job } from '../hooks/useJobs'
import { EARNEST_ABI } from '../lib/abis'
import { formatUsdc, shortAddr, formatDeadline, JOB_STATUS_LABEL, JOB_STATUS_COLOR } from '../lib/format'
import type { NetworkConfig } from '../config'

interface Props {
  network: NetworkConfig
  networkKey: string
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export function JobsPage({ network, networkKey }: Props) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const notDeployed = network.earnest === '0x0000000000000000000000000000000000000000'
  const onRightChain = chainId === network.chainId
  const { jobs, loading, error, reload } = useJobs(network)

  // eslint-disable-next-line react-compiler/react-compiler
  const [renderNow] = useState(() => Math.floor(globalThis.Date.now() / 1000))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [txStatus, setTxStatus] = useState<Record<string, { hash?: string; err?: string; pending: boolean }>>({})

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  async function runTx(key: string, fn: () => Promise<`0x${string}`>) {
    setTxStatus((s) => ({ ...s, [key]: { pending: true } }))
    try {
      const hash = await fn()
      const client = createPublicClient({ transport: http(network.rpc) })
      await client.waitForTransactionReceipt({ hash })
      setTxStatus((s) => ({ ...s, [key]: { hash, pending: false } }))
      reload()
    } catch (e) {
      setTxStatus((s) => ({ ...s, [key]: { err: (e as Error).message.slice(0, 100), pending: false } }))
    }
  }

  function canSubmit(job: Job) {
    return address && job.provider.toLowerCase() === address.toLowerCase() && job.status === 1
  }
  function canComplete(job: Job) {
    return address && job.evaluator.toLowerCase() === address.toLowerCase() && job.status === 2
  }
  function canReject(job: Job) {
    return address && (
      (job.status === 0 && job.client.toLowerCase() === address.toLowerCase()) ||
      ((job.status === 1 || job.status === 2) && job.evaluator.toLowerCase() === address.toLowerCase())
    )
  }
  function canClaimRefund(job: Job, nowSec: number) {
    return (job.status === 1 || job.status === 2) && nowSec >= Number(job.expiredAt)
  }
  function isMine(job: Job) {
    if (!address) return false
    const a = address.toLowerCase()
    return job.client.toLowerCase() === a || job.provider.toLowerCase() === a || job.evaluator.toLowerCase() === a
  }

  const myJobs = jobs.filter(isMine)
  const otherJobs = jobs.filter((j) => !isMine(j))

  function renderJob(job: Job) {
    const key = job.id.toString()
    const expanded_ = expanded[key]
    const tx = txStatus[key]
    const statusNum = job.status
    const statusLabel = JOB_STATUS_LABEL[statusNum] ?? 'Unknown'
    const statusColor = JOB_STATUS_COLOR[statusNum] ?? ''

    return (
      <div
        key={key}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 10,
        }}
      >
        {/* Header row */}
        <button
          onClick={() => toggleExpand(key)}
          style={{
            width: '100%', padding: '14px 16px', border: 'none', cursor: 'pointer',
            background: 'transparent', display: 'flex', alignItems: 'center', gap: 12,
            textAlign: 'left',
          }}
        >
          <span className="mono" style={{ fontSize: 13, color: 'var(--subtle)', minWidth: 36 }}>
            #{key}
          </span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.description || '(no description)'}
          </span>
          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            ${formatUsdc(job.budget)}
          </span>
          <span style={{ color: 'var(--subtle)' }}>
            {expanded_ ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* Expanded detail */}
        {expanded_ && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 12 }}>
              {[
                { label: 'Client', value: job.client },
                { label: 'Provider', value: job.provider },
                { label: 'Evaluator', value: job.evaluator },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <a href={`${network.explorer}/address/${value}`} target="_blank" rel="noopener noreferrer"
                    className="mono" style={{ display: 'block', fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                    {shortAddr(value)}
                  </a>
                </div>
              ))}
              <div>
                <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</span>
                <div style={{ fontSize: 13, marginTop: 2, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDeadline(job.expiredAt)}
                </div>
              </div>
              {job.isAgentJob && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</span>
                  <div style={{ fontSize: 13, marginTop: 2, color: 'var(--ink)' }}>#{job.agentId.toString()}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            {address && onRightChain && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SubmitAction job={job} canSubmit={canSubmit(job)} runTx={runTx} txKey={key} writeContractAsync={writeContractAsync} network={network} />
                <CompleteAction job={job} canComplete={canComplete(job)} runTx={runTx} txKey={key} writeContractAsync={writeContractAsync} network={network} />
                {canReject(job) && (
                  <button
                    disabled={tx?.pending}
                    onClick={() => void
                      runTx(`${key}-reject`, () =>
                        writeContractAsync({
                          address: network.earnest, abi: EARNEST_ABI, functionName: 'reject',
                          args: [job.id, ZERO_BYTES32, '0x'],
                          chainId: network.chainId,
                        })
                      )
                    }
                    style={{ ...actionBtn, background: 'var(--danger)', opacity: tx?.pending ? 0.5 : 1 }}
                  >
                    Reject
                  </button>
                )}
                {canClaimRefund(job, renderNow) && (
                  <button
                    disabled={tx?.pending}
                    onClick={() => void
                      runTx(`${key}-refund`, () =>
                        writeContractAsync({
                          address: network.earnest, abi: EARNEST_ABI, functionName: 'claimRefund',
                          args: [job.id],
                          chainId: network.chainId,
                        })
                      )
                    }
                    style={{ ...actionBtn, opacity: tx?.pending ? 0.5 : 1 }}
                  >
                    Claim refund
                  </button>
                )}
              </div>
            )}
            {address && !onRightChain && (
              <button onClick={() => switchChain({ chainId: network.chainId })} style={{ ...actionBtn, marginTop: 12 }}>
                Switch to Arc {networkKey === 'mainnet' ? 'Mainnet' : 'Testnet'}
              </button>
            )}

            {tx && (
              <div style={{ marginTop: 8, fontSize: 13, color: tx.err ? 'var(--danger)' : 'var(--success)' }}>
                {tx.err ? `Error: ${tx.err}` : tx.hash ? (
                  <a href={`${network.explorer}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    View tx <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Jobs</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 6 }}>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} on Arc {networkKey === 'mainnet' ? 'Mainnet' : 'Testnet'}
          </p>
        </div>
        <button onClick={reload} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {notDeployed && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Earnest is not deployed on mainnet yet.
        </div>
      )}

      {!notDeployed && !address && (
        <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: 'var(--surface-muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--muted)', flex: 1 }}>Connect a wallet to take actions on jobs.</span>
          <ConnectKitButton />
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading jobs…</div>}
      {error && <div style={{ color: 'var(--danger)', padding: 16 }}>{error}</div>}

      {!loading && !error && !notDeployed && (
        <>
          {myJobs.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                My Jobs
              </h2>
              {myJobs.map(renderJob)}
            </section>
          )}
          {otherJobs.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                All Jobs
              </h2>
              {otherJobs.map(renderJob)}
            </section>
          )}
          {jobs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--subtle)' }}>No jobs yet. Hire an agent to create the first one.</div>
          )}
        </>
      )}
    </div>
  )
}

function SubmitAction({ job, canSubmit, runTx, txKey, writeContractAsync, network }: {
  job: Job; canSubmit: boolean | undefined; runTx: (key: string, fn: () => Promise<`0x${string}`>) => Promise<void>
  txKey: string; writeContractAsync: ReturnType<typeof useWriteContract>['writeContractAsync']; network: NetworkConfig
}) {
  const [deliverableText, setDeliverableText] = useState('')
  if (!canSubmit) return null
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="text" placeholder="Deliverable (text or URL)"
        value={deliverableText} onChange={(e) => setDeliverableText(e.target.value)}
        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-muted)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
      />
      <button
        disabled={!deliverableText}
        onClick={() => void
          runTx(`${txKey}-submit`, () =>
            writeContractAsync({
              address: network.earnest, abi: EARNEST_ABI, functionName: 'submit',
              args: [job.id, keccak256(toHex(deliverableText)), '0x'],
              chainId: network.chainId,
            })
          )
        }
        style={{ ...actionBtn, minWidth: 80, opacity: deliverableText ? 1 : 0.5 }}
      >
        Submit
      </button>
    </div>
  )
}

function CompleteAction({ job, canComplete, runTx, txKey, writeContractAsync, network }: {
  job: Job; canComplete: boolean | undefined; runTx: (key: string, fn: () => Promise<`0x${string}`>) => Promise<void>
  txKey: string; writeContractAsync: ReturnType<typeof useWriteContract>['writeContractAsync']; network: NetworkConfig
}) {
  const [rating, setRating] = useState(80)
  const [withRating, setWithRating] = useState(true)
  if (!canComplete) return null

  const optParams = withRating && job.isAgentJob
    ? encodeAbiParameters(parseAbiParameters('uint8'), [rating])
    : '0x'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {job.isAgentJob && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={withRating} onChange={(e) => setWithRating(e.target.checked)} />
            Rate agent ({rating}/100)
          </label>
          {withRating && (
            <input
              type="range" min={0} max={100} value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          )}
        </>
      )}
      <button
        onClick={() => void
          runTx(`${txKey}-complete`, () =>
            writeContractAsync({
              address: network.earnest, abi: EARNEST_ABI, functionName: 'complete',
              args: [job.id, '0x0000000000000000000000000000000000000000000000000000000000000000', optParams],
              chainId: network.chainId,
            })
          )
        }
        style={{ ...actionBtn, background: 'var(--success)' }}
      >
        Complete{withRating && job.isAgentJob ? ` (rate ${rating}/100)` : ' without review'}
      </button>
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 9, border: 'none',
  background: 'var(--accent)', color: 'white', fontWeight: 600,
  fontSize: 13, cursor: 'pointer',
}

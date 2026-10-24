import { useState } from 'react'
import {
  BaseError, createPublicClient, http, encodeFunctionData, decodeErrorResult,
  encodeAbiParameters, parseAbiParameters, type PublicClient,
} from 'viem'
import { CheckCircle, XCircle, Minus, AlertTriangle } from 'lucide-react'
import { EARNEST_ABI } from '../lib/abis'
import type { NetworkConfig } from '../config'
import { shortAddr } from '../lib/format'

interface Props {
  network: NetworkConfig
  networkKey: string
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`
const DEAD = '0x000000000000000000000000000000000000dEaD' as `0x${string}`
// An address with no role in any job: a stranger trying their luck.
const STRANGER = '0x1234567890123456789012345678901234567890' as `0x${string}`

// blocked: reverted with the expected error. unexpected: reverted, but with a different error.
type AttackStatus = 'idle' | 'running' | 'blocked' | 'unexpected' | 'succeeded' | 'skipped'

interface AttackResult {
  status: AttackStatus
  errorName?: string
  from?: `0x${string}`
  fromLabel?: string
  skipReason?: string
}

interface PreparedCall {
  data: `0x${string}`
  from: `0x${string}`
  fromLabel: string
}

interface Attack {
  id: string
  label: string
  description: string
  expectedError: string
  skipReason?: string
  // Checked live before running: a reason here means the target job has moved on and the attack no longer applies.
  precheck?: (client: PublicClient, cfg: NetworkConfig) => Promise<string | undefined>
  prepare: (client: PublicClient, cfg: NetworkConfig) => Promise<PreparedCall>
}

const rating = (value: number) => encodeAbiParameters(parseAbiParameters('uint8'), [value])
const inSeconds = (s: number) => BigInt(Math.floor(Date.now() / 1000) + s)

const readJob = (client: PublicClient, cfg: NetworkConfig, jobId: number) =>
  client.readContract({ address: cfg.earnest, abi: EARNEST_ABI, functionName: 'getJob', args: [BigInt(jobId)] })

// Reads a job's evaluator live, so attacks that need the evaluator's own address are sent from it.
async function evaluatorOf(client: PublicClient, cfg: NetworkConfig, jobId: number) {
  return (await readJob(client, cfg, jobId)).evaluator
}

const SUBMITTED = 2

// The live job is meant to stay Submitted; once it is refunded or completed, attacks on it test nothing.
async function liveJobGone(client: PublicClient, cfg: NetworkConfig) {
  const job = await readJob(client, cfg, cfg.demoJobs.live)
  return job.status === SUBMITTED ? undefined : `Job #${cfg.demoJobs.live} is no longer waiting for evaluation`
}

async function liveDeadlinePassed(client: PublicClient, cfg: NetworkConfig) {
  const job = await readJob(client, cfg, cfg.demoJobs.live)
  if (job.status !== SUBMITTED) return `Job #${cfg.demoJobs.live} is no longer waiting for evaluation`
  const deadline = new Date(Number(job.expiredAt) * 1000)
  return deadline.getTime() <= Date.now() ? `Job #${cfg.demoJobs.live}'s deadline passed on ${deadline.toUTCString()}` : undefined
}

function buildAttacks(cfg: NetworkConfig): Attack[] {
  const { demoJobs } = cfg
  const notDeployed = cfg.earnest === ZERO_ADDR
  const needs = (jobId: number, what: string) =>
    notDeployed ? 'Not deployed on this network' : jobId === 0 ? `No ${what} job configured` : undefined

  return [
    {
      id: 'refund-live',
      label: 'Refund before deadline',
      description: `claimRefund on live job #${demoJobs.live}, whose deadline has not passed`,
      expectedError: 'NotExpired',
      skipReason: needs(demoJobs.live, 'live'),
      precheck: liveDeadlinePassed,
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({ abi: EARNEST_ABI, functionName: 'claimRefund', args: [BigInt(demoJobs.live)] }),
      }),
    },
    {
      id: 'self-review',
      label: 'Agent owner rates its own agent',
      description: `complete live job #${demoJobs.live} with rating 100, sent by its evaluator, who owns the agent`,
      expectedError: 'SelfReview',
      skipReason: needs(demoJobs.live, 'live'),
      precheck: liveJobGone,
      prepare: async (client, c) => ({
        from: await evaluatorOf(client, c, demoJobs.live), fromLabel: 'the evaluator (agent owner)',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'complete', args: [BigInt(demoJobs.live), ZERO_BYTES32, rating(100)],
        }),
      }),
    },
    {
      id: 'bad-rating',
      label: 'Rating above 100',
      description: `complete live job #${demoJobs.live} with rating 101, sent by its evaluator`,
      expectedError: 'BadRating',
      skipReason: needs(demoJobs.live, 'live'),
      precheck: liveJobGone,
      prepare: async (client, c) => ({
        from: await evaluatorOf(client, c, demoJobs.live), fromLabel: 'the evaluator',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'complete', args: [BigInt(demoJobs.live), ZERO_BYTES32, rating(101)],
        }),
      }),
    },
    {
      id: 'unauthorized-complete',
      label: 'Pay out a job you do not evaluate',
      description: `complete live job #${demoJobs.live} from an address with no role in it`,
      expectedError: 'Unauthorized',
      skipReason: needs(demoJobs.live, 'live'),
      precheck: liveJobGone,
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'complete', args: [BigInt(demoJobs.live), ZERO_BYTES32, '0x'],
        }),
      }),
    },
    {
      id: 'double-complete',
      label: 'Complete a job twice',
      description: `complete job #${demoJobs.completed} again, sent by its own evaluator`,
      expectedError: 'WrongStatus',
      skipReason: needs(demoJobs.completed, 'completed'),
      prepare: async (client, c) => ({
        from: await evaluatorOf(client, c, demoJobs.completed), fromLabel: 'the evaluator',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'complete', args: [BigInt(demoJobs.completed), ZERO_BYTES32, rating(100)],
        }),
      }),
    },
    {
      id: 'refund-completed',
      label: 'Refund a job that was already paid',
      description: `claimRefund on completed job #${demoJobs.completed}`,
      expectedError: 'WrongStatus',
      skipReason: needs(demoJobs.completed, 'completed'),
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({ abi: EARNEST_ABI, functionName: 'claimRefund', args: [BigInt(demoJobs.completed)] }),
      }),
    },
    {
      id: 'unknown-agent',
      label: 'Hire an agent that does not exist',
      description: 'createAgentJob for agent id 2^64',
      expectedError: 'UnknownAgent',
      skipReason: notDeployed ? 'Not deployed on this network' : undefined,
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'createAgentJob',
          args: [2n ** 64n, STRANGER, inSeconds(3600), 'test', 1_000_000n],
        }),
      }),
    },
    {
      id: 'expiry-too-short',
      label: 'Deadline shorter than 5 minutes',
      description: 'createJob with a deadline 60 seconds away',
      expectedError: 'ExpiryTooShort',
      skipReason: notDeployed ? 'Not deployed on this network' : undefined,
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'createJob', args: [STRANGER, STRANGER, inSeconds(60), 'test', ZERO_ADDR],
        }),
      }),
    },
    {
      id: 'hook-not-supported',
      label: 'Attach an arbitrary hook contract',
      description: 'createJob with hook 0x...dEaD',
      expectedError: 'HookNotSupported',
      skipReason: notDeployed ? 'Not deployed on this network' : undefined,
      prepare: () => Promise.resolve({
        from: STRANGER, fromLabel: 'a stranger',
        data: encodeFunctionData({
          abi: EARNEST_ABI, functionName: 'createJob', args: [STRANGER, STRANGER, inSeconds(3600), 'test', DEAD],
        }),
      }),
    },
  ]
}

// Finds the revert data inside viem's error chain and decodes it against Earnest's custom errors.
function revertName(err: unknown): string {
  if (!(err instanceof BaseError)) return '(no revert data)'
  const withData = err.walk((e) => typeof (e as { data?: unknown }).data === 'string') as { data?: string } | null
  const data = withData?.data
  if (!data || !data.startsWith('0x') || data === '0x') return '(no revert data)'
  try {
    return decodeErrorResult({ abi: EARNEST_ABI, data: data as `0x${string}` }).errorName
  } catch {
    return data.slice(0, 10)
  }
}

export function CheatPage({ network }: Props) {
  const attacks = buildAttacks(network)
  const [results, setResults] = useState<Record<string, AttackResult>>({})

  const client = createPublicClient({ transport: http(network.rpc) })

  async function runAttack(attack: Attack) {
    if (attack.skipReason) {
      setResults((r) => ({ ...r, [attack.id]: { status: 'skipped' } }))
      return
    }
    setResults((r) => ({ ...r, [attack.id]: { status: 'running' } }))
    let call: PreparedCall
    try {
      const skipReason = await attack.precheck?.(client, network)
      if (skipReason) {
        setResults((r) => ({ ...r, [attack.id]: { status: 'skipped', skipReason } }))
        return
      }
      call = await attack.prepare(client, network)
    } catch {
      setResults((r) => ({ ...r, [attack.id]: { status: 'unexpected', errorName: '(could not read the target job)' } }))
      return
    }
    try {
      await client.call({ to: network.earnest, data: call.data, account: call.from })
      setResults((r) => ({ ...r, [attack.id]: { status: 'succeeded', from: call.from, fromLabel: call.fromLabel } }))
    } catch (e) {
      const errorName = revertName(e)
      const status: AttackStatus = errorName === attack.expectedError ? 'blocked' : 'unexpected'
      setResults((r) => ({ ...r, [attack.id]: { status, errorName, from: call.from, fromLabel: call.fromLabel } }))
    }
  }

  async function runAll() {
    for (const attack of attacks) await runAttack(attack)
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          Try to Cheat
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, maxWidth: 560 }}>
          Each attack is sent to the live contract as an <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>eth_call</code> from
          the address that would really try it, and the contract's own revert is decoded and shown.
          No wallet and no gas needed.
        </p>
        <button
          onClick={() => void runAll()}
          style={{
            marginTop: 12, padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: 'white', fontWeight: 600,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Run all attacks
        </button>
      </div>

      {network.selfReviewFailedTx && (
        <div
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'var(--surface-muted)', border: '1px solid var(--border)',
            marginBottom: 20, fontSize: 13, color: 'var(--muted)',
          }}
        >
          The self-review attack was also sent for real, and failed on chain:{' '}
          <a
            href={`${network.explorer}/tx/${network.selfReviewFailedTx}`}
            target="_blank" rel="noopener noreferrer"
            className="mono"
            style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            {shortAddr(network.selfReviewFailedTx)}
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {attacks.map((attack) => {
          const r = results[attack.id]
          const isSkipped = !!attack.skipReason
          const status = r?.status ?? (isSkipped ? 'skipped' : 'idle')
          const border =
            status === 'blocked' ? 'var(--success)33'
              : status === 'succeeded' || status === 'unexpected' ? 'var(--danger)33'
                : 'var(--border)'

          return (
            <div
              key={attack.id}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${border}`,
                borderRadius: 12, padding: '14px 16px',
                opacity: isSkipped ? 0.55 : 1,
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}
            >
              <div style={{ marginTop: 2, flexShrink: 0 }}>
                {status === 'idle' && <Minus size={16} style={{ color: 'var(--subtle)' }} />}
                {status === 'running' && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                )}
                {status === 'blocked' && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                {status === 'unexpected' && <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />}
                {status === 'succeeded' && <XCircle size={16} style={{ color: 'var(--danger)' }} />}
                {status === 'skipped' && <Minus size={16} style={{ color: 'var(--subtle)' }} />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{attack.label}</span>
                  {(status === 'blocked' || status === 'unexpected') && r?.errorName && (
                    <span
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: status === 'blocked' ? 'var(--success)' : 'var(--danger)', color: 'white',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {r.errorName}
                    </span>
                  )}
                  {status === 'succeeded' && (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--danger)', color: 'white' }}>
                      Did not revert!
                    </span>
                  )}
                  {status === 'skipped' && (r?.skipReason ?? attack.skipReason) && (
                    <span style={{ fontSize: 12, color: 'var(--subtle)' }}>{r?.skipReason ?? attack.skipReason}</span>
                  )}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>{attack.description}</p>
                {r?.from && (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--subtle)' }}>
                    Sent from {r.fromLabel} <span className="mono">{shortAddr(r.from)}</span>
                  </p>
                )}
                {status === 'blocked' && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--success)' }}>
                    Refused by the contract with <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r?.errorName}</code>, as expected
                  </p>
                )}
                {status === 'unexpected' && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--danger)' }}>
                    Expected <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{attack.expectedError}</code>, got{' '}
                    <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r?.errorName}</code>
                  </p>
                )}
              </div>

              {!isSkipped && status === 'idle' && (
                <button
                  onClick={() => void runAttack(attack)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface-muted)', color: 'var(--ink)',
                    fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Run
                </button>
              )}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

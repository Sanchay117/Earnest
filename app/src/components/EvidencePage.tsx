import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useJobs } from '../hooks/useJobs'
import { formatUsdc, shortAddr, JOB_STATUS_LABEL } from '../lib/format'
import type { NetworkConfig } from '../config'

interface Props {
  network: NetworkConfig
  networkKey: string
}

interface EvidenceEntry {
  step: string
  outcome: string
  hash?: string
  link?: string
  // The scripts write gas as a decimal string (it is a bigint on chain)
  gasUsed?: number | string
  costUsdc?: string
}

export function EvidencePage({ network, networkKey }: Props) {
  const notDeployed = network.earnest === '0x0000000000000000000000000000000000000000'
  const { jobs, loading } = useJobs(network)
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([])

  useEffect(() => {
    const file = networkKey === 'mainnet' ? './evidence/mainnet.json' : './evidence/testnet.json'
    fetch(file)
      .then((r) => r.json())
      .then((data: EvidenceEntry[]) => setEvidence(data))
      .catch(() => setEvidence([]))
  }, [networkKey])

  const { demoJobs } = network
  const demoIds = [demoJobs.completed, demoJobs.expired, demoJobs.rejected, demoJobs.live].filter((id) => id > 0)
  const demoJobsData = jobs.filter((j) => demoIds.includes(Number(j.id)))

  const totalGas = evidence.reduce((acc, e) => acc + Number(e.gasUsed ?? 0), 0)
  const totalCostUsdc = evidence.reduce((acc, e) => acc + parseFloat(e.costUsdc ?? '0'), 0)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px' }}>
      <h1 className="display" style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>
        Evidence
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        All deployments, demo transactions, and their outcomes on Arc{' '}
        {networkKey === 'mainnet' ? 'Mainnet' : 'Testnet'}.
      </p>

      {/* Contract info */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14, padding: '18px 20px', marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--ink)' }}>Contract</h2>
        {notDeployed ? (
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Not deployed on mainnet yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Address">
              <a
                href={`${network.explorer}/address/${network.earnest}`}
                target="_blank" rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: 13, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {network.earnest} <ExternalLink size={11} />
              </a>
            </Row>
            {network.deployTx && (
              <Row label="Deploy tx">
                <a
                  href={`${network.explorer}/tx/${network.deployTx}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mono"
                  style={{ fontSize: 13, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {shortAddr(network.deployTx)} <ExternalLink size={11} />
                </a>
              </Row>
            )}
          </div>
        )}
      </div>

      {/* Demo jobs */}
      {!notDeployed && demoJobsData.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: '18px 20px', marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--ink)' }}>Demo Jobs</h2>
          {loading ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Description', 'Status', 'Budget', 'Budget destination'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 0 8px', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoJobsData.map((job) => {
                  const statusNum = job.status
                  let destination = '-'
                  if (statusNum === 3) destination = `Provider (99%) + Treasury (1%)`
                  else if (statusNum === 4 || statusNum === 5) destination = 'Client (refunded)'
                  else if (statusNum === 1 || statusNum === 2) destination = 'Locked in contract'
                  return (
                    <tr key={job.id.toString()} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 0', color: 'var(--muted)' }}>#{job.id.toString()}</td>
                      <td style={{ padding: '10px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.description || '-'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{JOB_STATUS_LABEL[statusNum]}</td>
                      <td style={{ padding: '10px 8px', fontVariantNumeric: 'tabular-nums' }}>${formatUsdc(job.budget)}</td>
                      <td style={{ padding: '10px 0', color: 'var(--muted)', fontSize: 12 }}>{destination}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Evidence table */}
      {evidence.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: '18px 20px',
          }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: 'var(--ink)' }}>
            Transaction Log
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Step', 'Outcome', 'Tx hash', 'Gas', 'Cost (USDC)'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0 4px 8px', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidence.map((entry, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 4px', fontWeight: 500 }}>{entry.step}</td>
                  <td style={{ padding: '9px 4px', color: 'var(--muted)' }}>{entry.outcome}</td>
                  <td style={{ padding: '9px 4px' }}>
                    {entry.hash ? (
                      <a
                        href={entry.link ?? `${network.explorer}/tx/${entry.hash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mono"
                        style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        {shortAddr(entry.hash)} <ExternalLink size={10} />
                      </a>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '9px 4px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                    {entry.gasUsed !== undefined ? Number(entry.gasUsed).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '9px 4px', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                    {entry.costUsdc ?? '-'}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '9px 4px', fontWeight: 600 }}>Total</td>
                <td style={{ padding: '9px 4px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totalGas.toLocaleString()}</td>
                <td style={{ padding: '9px 4px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>${totalCostUsdc.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {evidence.length === 0 && !notDeployed && (
        <div
          style={{
            padding: '24px 20px', borderRadius: 14,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--subtle)', fontSize: 14, textAlign: 'center',
          }}
        >
          No evidence file found at <code className="mono" style={{ fontSize: 12 }}>./evidence/{networkKey}.json</code>.
          Add one with an array of <code className="mono" style={{ fontSize: 12 }}>{'{ step, outcome, hash, link, gasUsed, costUsdc }'}</code> entries.
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--subtle)', minWidth: 90, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </div>
  )
}

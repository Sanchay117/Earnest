import { useState } from 'react'
import { ExternalLink, AlertTriangle, ShieldCheck, User } from 'lucide-react'
import { useAgent } from '../hooks/useAgent'
import { formatUsdc, shortAddr } from '../lib/format'
import type { NetworkConfig } from '../config'

interface Props {
  network: NetworkConfig
  networkKey: string
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '20px 24px',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--subtle)',
      }}
    >
      {children}
    </span>
  )
}

function AddrRow({ label, value, explorer }: { label: string; value: string; explorer: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <a
        href={`${explorer}/address/${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
        style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {shortAddr(value)}
        <ExternalLink size={11} />
      </a>
    </div>
  )
}

export function AgentPage({ network, networkKey }: Props) {
  const [agentIdInput, setAgentIdInput] = useState(String(network.agentId))
  const [agentId, setAgentId] = useState(network.agentId)
  const notDeployed = network.earnest === '0x0000000000000000000000000000000000000000'

  const info = useAgent(agentId, network)

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(agentIdInput, 10)
    if (!isNaN(n) && n > 0) setAgentId(n)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Agent Profile
        </h1>
        <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 15, maxWidth: 560 }}>
          Agent reviews you can&apos;t fake: only paid jobs get rated. Compare all reviews against
          Earnest-verified ones to see the signal.
        </p>
      </div>

      {/* Agent ID input */}
      <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8, marginBottom: 28, maxWidth: 380 }}>
        <input
          type="number"
          min={1}
          value={agentIdInput}
          onChange={(e) => setAgentIdInput(e.target.value)}
          placeholder="Agent ID"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-muted)', color: 'var(--ink)',
            fontSize: 15, fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: 'white', fontWeight: 600,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Look up
        </button>
      </form>

      {notDeployed && (
        <Card style={{ marginBottom: 20, borderColor: '#f59e0b44' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Earnest not deployed on mainnet yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Earnest-verified scores are only available on testnet. Switch to testnet to see them,
                or wait for the mainnet deployment.
              </p>
            </div>
          </div>
        </Card>
      )}

      {info.loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading…</div>
      )}

      {info.error && (
        <Card style={{ borderColor: 'var(--danger)' }}>
          <p style={{ color: 'var(--danger)', margin: 0 }}>Failed to load agent: {info.error}</p>
        </Card>
      )}

      {!info.loading && !info.error && (
        <>
          {/* Agent card */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {info.card?.image ? (
                <img
                  src={info.card.image}
                  alt={info.card.name}
                  style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: 'var(--surface-muted)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <User size={22} style={{ color: 'var(--subtle)' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 className="display" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {info.card?.name || `Agent #${agentId}`}
                  </h2>
                  <a
                    href={`${network.explorer}/address/${network.identity}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--subtle)', textDecoration: 'none' }}
                  >
                    #{agentId}
                  </a>
                </div>
                {info.card?.description && (
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14, maxWidth: 520 }}>
                    {info.card.description}
                  </p>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <AddrRow label="Owner" value={info.owner} explorer={network.explorer} />
              {info.agentWallet !== '0x0000000000000000000000000000000000000000' && (
                <AddrRow label="Agent wallet" value={info.agentWallet} explorer={network.explorer} />
              )}
            </div>
          </Card>

          {/* Blocked reviews warning */}
          {!notDeployed && info.blockedReviews > 0n && (
            <Card style={{ marginBottom: 20, borderColor: 'var(--danger)44' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 14, color: 'var(--danger)' }}>
                  This agent&apos;s owner blocked{' '}
                  <strong>{info.blockedReviews.toString()}</strong>{' '}
                  paid review{info.blockedReviews === 1n ? '' : 's'} by authorizing Earnest as an operator,
                  which causes the reputation registry to reject Earnest&apos;s submissions.
                </p>
              </div>
            </Card>
          )}

          {/* Two-column scores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* All reviews */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Label>All reviews</Label>
              </div>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <div className="display" style={{ fontSize: 36, fontWeight: 700, tabularNums: true } as React.CSSProperties}>
                    {info.allCount > 0n ? (Number(info.allAverage)).toFixed(1) : '-'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>avg score</div>
                </div>
                <div>
                  <div className="display" style={{ fontSize: 36, fontWeight: 700 }}>
                    {info.allCount.toString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>reviews</div>
                </div>
              </div>
              {info.allFeedback.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {info.allFeedback.slice(0, 10).map((fb, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: 8,
                        background: 'var(--surface-muted)',
                        border: fb.clientAddress.toLowerCase() !== network.earnest.toLowerCase()
                          ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {shortAddr(fb.clientAddress)}
                        </span>
                        {fb.tag1 && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--subtle)' }}>
                            #{fb.tag1}
                          </span>
                        )}
                        {fb.clientAddress.toLowerCase() !== network.earnest.toLowerCase() && (
                          <span
                            style={{
                              marginLeft: 6, fontSize: 10, fontWeight: 600,
                              color: 'var(--subtle)', letterSpacing: '0.04em',
                            }}
                          >
                            unpaid
                          </span>
                        )}
                      </div>
                      <span className="display" style={{ fontWeight: 600, fontSize: 16 }}>
                        {Number(fb.value).toString()}
                      </span>
                    </div>
                  ))}
                  {info.allFeedback.length > 10 && (
                    <p style={{ fontSize: 12, color: 'var(--subtle)', margin: '4px 0 0', textAlign: 'center' }}>
                      +{info.allFeedback.length - 10} more
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--subtle)', fontSize: 13, margin: 0 }}>No reviews yet.</p>
              )}
            </Card>

            {/* Earnest-verified */}
            <Card style={{ border: notDeployed ? '1px solid var(--border)' : '1.5px solid var(--accent)44' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                <Label>Earnest-verified</Label>
              </div>
              {notDeployed ? (
                <p style={{ color: 'var(--subtle)', fontSize: 13, margin: 0 }}>
                  Earnest not deployed on this network.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                    <div>
                      <div className="display" style={{ fontSize: 36, fontWeight: 700 }}>
                        {info.earnestCount > 0n ? (Number(info.earnestAverage)).toFixed(1) : '-'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>avg score</div>
                    </div>
                    <div>
                      <div className="display" style={{ fontSize: 36, fontWeight: 700 }}>
                        {info.earnestCount.toString()}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>paid reviews</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Paid volume: </span>
                      <strong style={{ fontFeatureSettings: '"tnum"' }}>${formatUsdc(info.paidVolume)}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)' }}>Reviews: </span>
                      <strong>{info.reviewCount.toString()}</strong>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--subtle)', margin: '0 0 12px' }}>
                    Earnest only writes a review when USDC settled for the job. No payment, no review.
                  </p>
                  {info.earnestFeedback.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {info.earnestFeedback.map((fb, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '8px 10px', borderRadius: 8,
                            background: 'var(--surface-muted)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {shortAddr(network.earnest)} <span style={{ fontSize: 10, color: 'var(--subtle)' }}>#earnest</span>
                            </span>
                            <span className="display" style={{ fontWeight: 600, fontSize: 16 }}>
                              {Number(fb.value).toString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--subtle)', fontSize: 13, margin: 0 }}>No paid reviews yet.</p>
                  )}
                </>
              )}
            </Card>
          </div>

          <p style={{ fontSize: 12, color: 'var(--subtle)', textAlign: 'center' }}>
            Network: Arc {networkKey === 'mainnet' ? 'Mainnet' : 'Testnet'} &middot;
            Identity registry:{' '}
            <a
              href={`${network.explorer}/address/${network.identity}`}
              target="_blank" rel="noopener noreferrer"
              className="mono"
              style={{ color: 'var(--subtle)' }}
            >
              {shortAddr(network.identity)}
            </a>
          </p>
        </>
      )}
    </div>
  )
}

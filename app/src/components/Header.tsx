import { useState, useEffect } from 'react'
import { Sun, Moon, ChevronDown } from 'lucide-react'
import type { NetworkKey } from '../config'

interface HeaderProps {
  network: NetworkKey
  page: string
  onNavigate: (page: string) => void
}

const NAV = [
  { id: 'agent', label: 'Agent' },
  { id: 'hire', label: 'Hire' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'cheat', label: 'Try to Cheat' },
  { id: 'evidence', label: 'Evidence' },
]

export function Header({ network, page, onNavigate }: HeaderProps) {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [netOpen, setNetOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  function switchNetwork(n: NetworkKey) {
    setNetOpen(false)
    const hash = window.location.hash.replace(/[?&]network=[^&]*/g, '')
    const sep = hash.includes('?') ? '&' : '?'
    const newUrl = window.location.pathname + '#' + hash.replace(/^#/, '') + sep + `network=${n}`
    window.history.pushState(null, '', newUrl)
    window.location.reload()
  }

  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo */}
        <button
          onClick={() => onNavigate('agent')}
          className="display font-semibold text-base shrink-0"
          style={{ color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Earnest
        </button>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: page === item.id ? 600 : 400,
                color: page === item.id ? 'var(--ink)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {/* Network picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNetOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 10px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                color: 'var(--ink)',
              }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: network === 'mainnet' ? 'var(--success)' : '#f59e0b',
                  display: 'inline-block',
                }}
              />
              {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
              <ChevronDown size={13} />
            </button>
            {netOpen && (
              <div
                style={{
                  position: 'absolute', top: '110%', right: 0, minWidth: 130,
                  background: 'var(--surface-strong)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: 4,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 100,
                }}
              >
                {(['mainnet', 'testnet'] as NetworkKey[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => switchNetwork(n)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', border: 'none', borderRadius: 8,
                      background: network === n ? 'var(--surface-muted)' : 'transparent',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      color: 'var(--ink)',
                    }}
                  >
                    {n === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode */}
          <button
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 8px',
              cursor: 'pointer', color: 'var(--ink)',
              display: 'flex', alignItems: 'center',
            }}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex overflow-x-auto gap-0 px-4 pb-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 10px', borderRadius: 8,
              fontSize: 13, fontWeight: page === item.id ? 600 : 400,
              color: page === item.id ? 'var(--ink)' : 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  )
}

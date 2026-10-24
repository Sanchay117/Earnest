import { useState, useEffect } from 'react'
import { NETWORKS, type NetworkKey } from './config'
import { Header } from './components/Header'
import { AgentPage } from './components/AgentPage'
import { HirePage } from './components/HirePage'
import { JobsPage } from './components/JobsPage'
import { CheatPage } from './components/CheatPage'
import { EvidencePage } from './components/EvidencePage'

function getInitialPage(hash: string): string {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  const valid = ['agent', 'hire', 'jobs', 'cheat', 'evidence']
  return valid.includes(path) ? path : 'agent'
}

function getNetworkKey(): NetworkKey {
  const search = typeof window !== 'undefined' ? window.location.search + window.location.hash : ''
  return /network=testnet/i.test(search) ? 'testnet' : 'mainnet'
}

export default function App() {
  const [page, setPage] = useState(() => getInitialPage(window.location.hash))
  const [networkKey, setNetworkKey] = useState<NetworkKey>(getNetworkKey)

  // Sync page from hash changes (back/forward)
  useEffect(() => {
    function onHashChange() {
      setPage(getInitialPage(window.location.hash))
      setNetworkKey(getNetworkKey())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigate(newPage: string) {
    const netParam = networkKey === 'testnet' ? '?network=testnet' : ''
    window.location.hash = `#/${newPage}${netParam}`
    setPage(newPage)
  }

  const network = NETWORKS[networkKey]

  function renderPage() {
    switch (page) {
      case 'agent':
        return <AgentPage network={network} networkKey={networkKey} />
      case 'hire':
        return <HirePage network={network} networkKey={networkKey} />
      case 'jobs':
        return <JobsPage network={network} networkKey={networkKey} />
      case 'cheat':
        return <CheatPage network={network} networkKey={networkKey} />
      case 'evidence':
        return <EvidencePage network={network} networkKey={networkKey} />
      default:
        return <AgentPage network={network} networkKey={networkKey} />
    }
  }

  return (
    <div
      style={{ minHeight: '100dvh', background: 'var(--bg-gradient)' }}
      data-theme={
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
    >
      <Header network={networkKey} page={page} onNavigate={navigate} />
      <main>{renderPage()}</main>
    </div>
  )
}

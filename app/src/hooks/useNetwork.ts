import { useMemo } from 'react'
import { NETWORKS, type NetworkKey, type NetworkConfig } from '../config'

/** Read ?network=testnet from the hash query string (#/path?network=testnet) */
function getNetworkKey(): NetworkKey {
  // Support both ?network= in the real query and in the hash fragment
  const search =
    typeof window !== 'undefined'
      ? window.location.search + window.location.hash
      : ''
  if (/network=testnet/i.test(search)) return 'testnet'
  return 'mainnet'
}

export function useNetworkKey(): NetworkKey {
  // Re-read on every render; navigation updates happen synchronously
  // In a full SPA this would be driven by a router, but we use a simple hash router
  return useMemo(() => getNetworkKey(), [])
}

export function useNetworkConfig(): NetworkConfig {
  const key = useNetworkKey()
  return NETWORKS[key]
}

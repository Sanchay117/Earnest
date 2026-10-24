/** Format a USDC amount (6 decimals) as a human-readable string */
export function formatUsdc(raw: bigint, decimals = 2): string {
  const n = Number(raw) / 1e6
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Shorten an address: 0x1234...abcd */
export function shortAddr(addr: string): string {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format a unix timestamp as a relative time string */
export function formatDeadline(expiredAt: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = Number(expiredAt) - now
  if (diff <= 0) return 'Expired'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const JOB_STATUS_LABEL = [
  'Open',
  'Funded',
  'Submitted',
  'Completed',
  'Rejected',
  'Expired',
] as const

export const JOB_STATUS_COLOR: Record<number, string> = {
  0: 'text-blue-600 dark:text-blue-400',
  1: 'text-yellow-600 dark:text-yellow-400',
  2: 'text-purple-600 dark:text-purple-400',
  3: 'text-green-700 dark:text-green-400',
  4: 'text-red-600 dark:text-red-400',
  5: 'text-gray-500',
}

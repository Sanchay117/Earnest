import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { IDENTITY_ABI, REPUTATION_ABI, EARNEST_ABI } from '../lib/abis'
import type { NetworkConfig } from '../config'

export interface FeedbackEntry {
  clientAddress: `0x${string}`
  index: bigint
  value: bigint
  valueDecimals: number
  tag1: string
  tag2: string
  isRevoked: boolean
}

type ReadAllFeedbackResult = readonly [
  readonly `0x${string}`[], readonly bigint[], readonly bigint[], readonly number[],
  readonly string[], readonly string[], readonly boolean[],
]

// ERC-8004 readAllFeedback returns parallel arrays; zip them into one entry per review.
function zipFeedback([clients, indexes, values, decimals, tag1s, tag2s, revoked]: ReadAllFeedbackResult): FeedbackEntry[] {
  return clients.map((clientAddress, i) => ({
    clientAddress,
    index: indexes[i],
    value: values[i],
    valueDecimals: decimals[i],
    tag1: tag1s[i],
    tag2: tag2s[i],
    isRevoked: revoked[i],
  }))
}

export interface AgentCard {
  name: string
  description: string
  image?: string
}

export interface AgentInfo {
  owner: `0x${string}`
  agentWallet: `0x${string}`
  card: AgentCard | null
  allCount: bigint
  allAverage: bigint
  earnestCount: bigint
  earnestAverage: bigint
  allFeedback: FeedbackEntry[]
  earnestFeedback: FeedbackEntry[]
  clients: `0x${string}`[]
  paidVolume: bigint
  reviewCount: bigint
  blockedReviews: bigint
  loading: boolean
  error: string | null
}

async function fetchAgentCard(uri: string): Promise<AgentCard | null> {
  try {
    let json: unknown
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.replace('data:application/json;base64,', '')
      json = JSON.parse(atob(b64))
    } else if (uri.startsWith('data:application/json,')) {
      json = JSON.parse(decodeURIComponent(uri.replace('data:application/json,', '')))
    } else {
      const res = await fetch(uri)
      json = await res.json()
    }
    const obj = json as Record<string, unknown>
    return {
      name: (obj.name as string) ?? '',
      description: (obj.description as string) ?? '',
      image: (obj.image as string | undefined) ?? undefined,
    }
  } catch {
    return null
  }
}

export function useAgent(agentId: number, network: NetworkConfig): AgentInfo {
  const [info, setInfo] = useState<AgentInfo>({
    owner: '0x0000000000000000000000000000000000000000',
    agentWallet: '0x0000000000000000000000000000000000000000',
    card: null,
    allCount: 0n,
    allAverage: 0n,
    earnestCount: 0n,
    earnestAverage: 0n,
    allFeedback: [],
    earnestFeedback: [],
    clients: [],
    paidVolume: 0n,
    reviewCount: 0n,
    blockedReviews: 0n,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const client = createPublicClient({ transport: http(network.rpc) })
    const notDeployed = network.earnest === '0x0000000000000000000000000000000000000000'

    async function load() {
      if (!cancelled) setInfo((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const id = BigInt(agentId)

        // Identity
        const [owner, agentWallet, tokenUri] = await Promise.all([
          client.readContract({ address: network.identity, abi: IDENTITY_ABI, functionName: 'ownerOf', args: [id] }),
          client.readContract({ address: network.identity, abi: IDENTITY_ABI, functionName: 'getAgentWallet', args: [id] }),
          client.readContract({ address: network.identity, abi: IDENTITY_ABI, functionName: 'tokenURI', args: [id] }),
        ])

        const card = await fetchAgentCard(tokenUri)

        // Reputation: get all clients first
        const clients = await client.readContract({
          address: network.reputation, abi: REPUTATION_ABI, functionName: 'getClients', args: [id],
        }) as `0x${string}`[]

        // All-review summary
        const [allCount, allAverage] = clients.length > 0
          ? await client.readContract({
              address: network.reputation, abi: REPUTATION_ABI, functionName: 'getSummary',
              args: [id, clients, '', ''],
            }).then((r) => r as [bigint, bigint, number])
          : [0n, 0n, 0]

        // Earnest-verified summary
        const earnestAddr = network.earnest
        const [earnestCount, earnestAverage] = !notDeployed
          ? await client.readContract({
              address: network.reputation, abi: REPUTATION_ABI, functionName: 'getSummary',
              args: [id, [earnestAddr], 'earnest', ''],
            }).then((r) => r as [bigint, bigint, number])
          : [0n, 0n, 0]

        // All feedback entries (from every reviewer)
        const allFeedback = clients.length > 0
          ? zipFeedback(await client.readContract({
              address: network.reputation, abi: REPUTATION_ABI, functionName: 'readAllFeedback',
              args: [id, clients, '', '', false],
            }))
          : []

        // Earnest feedback
        const earnestFeedback = !notDeployed
          ? zipFeedback(await client.readContract({
              address: network.reputation, abi: REPUTATION_ABI, functionName: 'readAllFeedback',
              args: [id, [earnestAddr], 'earnest', '', false],
            }))
          : []

        // Earnest stats
        const [paidVolume, reviewCount, blockedReviews] = !notDeployed
          ? await Promise.all([
              client.readContract({ address: earnestAddr, abi: EARNEST_ABI, functionName: 'paidVolume', args: [id] }),
              client.readContract({ address: earnestAddr, abi: EARNEST_ABI, functionName: 'reviewCount', args: [id] }),
              client.readContract({ address: earnestAddr, abi: EARNEST_ABI, functionName: 'blockedReviews', args: [id] }),
            ])
          : [0n, 0n, 0n]

        if (!cancelled) {
          setInfo({
            owner: owner,
            agentWallet: agentWallet,
            card,
            allCount: allCount,
            allAverage: allAverage,
            earnestCount: earnestCount,
            earnestAverage: earnestAverage,
            allFeedback,
            earnestFeedback,
            clients: clients,
            paidVolume: paidVolume,
            reviewCount: reviewCount,
            blockedReviews: blockedReviews,
            loading: false,
            error: null,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setInfo((prev) => ({
            ...prev,
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load agent',
          }))
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [agentId, network.identity, network.reputation, network.earnest, network.rpc])

  return info
}

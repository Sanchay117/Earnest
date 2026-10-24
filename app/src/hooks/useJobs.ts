import { useEffect, useState, useCallback } from 'react'
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem'
import { EARNEST_ABI, MULTICALL3_ABI } from '../lib/abis'
import { MULTICALL3 } from '../config'
import type { NetworkConfig } from '../config'

export interface Job {
  id: bigint
  client: `0x${string}`
  provider: `0x${string}`
  evaluator: `0x${string}`
  description: string
  budget: bigint
  expiredAt: bigint
  status: number
  hook: `0x${string}`
  agentId: bigint
  isAgentJob: boolean
}

interface UseJobsResult {
  jobs: Job[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useJobs(network: NetworkConfig): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (network.earnest === '0x0000000000000000000000000000000000000000') {
      // Clear on next microtask to avoid synchronous setState inside effect
      Promise.resolve().then(() => setJobs([])).catch(() => undefined)
      return
    }

    let cancelled = false
    const client = createPublicClient({ transport: http(network.rpc) })

    async function load() {
      if (!cancelled) { setLoading(true); setError(null) }
      try {
        // Step 1: get jobCounter
        const counter = await client.readContract({
          address: network.earnest,
          abi: EARNEST_ABI,
          functionName: 'jobCounter',
        })
        const total = Number(counter)
        if (total === 0) {
          if (!cancelled) { setJobs([]); setLoading(false) }
          return
        }

        // Step 2: batch getJob + agentOf via Multicall3
        const BATCH_SIZE = 50
        const allJobs: Job[] = []

        for (let start = 1; start <= total; start += BATCH_SIZE) {
          if (cancelled) return
          const end = Math.min(start + BATCH_SIZE - 1, total)
          const calls: { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }[] = []

          for (let i = start; i <= end; i++) {
            calls.push({
              target: network.earnest,
              allowFailure: false,
              callData: encodeFunctionData({
                abi: EARNEST_ABI,
                functionName: 'getJob',
                args: [BigInt(i)],
              }),
            })
            calls.push({
              target: network.earnest,
              allowFailure: false,
              callData: encodeFunctionData({
                abi: EARNEST_ABI,
                functionName: 'agentOf',
                args: [BigInt(i)],
              }),
            })
          }

          const results = await client.readContract({
            address: MULTICALL3,
            abi: MULTICALL3_ABI,
            functionName: 'aggregate3',
            args: [calls],
          })

          for (let i = 0; i < end - start + 1; i++) {
            const jobResult = results[i * 2]
            const agentResult = results[i * 2 + 1]
            if (!jobResult.success || !agentResult.success) continue

            const job = decodeFunctionResult({
              abi: EARNEST_ABI,
              functionName: 'getJob',
              data: jobResult.returnData,
            })
            const [agentId, isAgentJob] = decodeFunctionResult({
              abi: EARNEST_ABI,
              functionName: 'agentOf',
              data: agentResult.returnData,
            })

            allJobs.push({
              ...job,
              status: job.status,
              agentId: agentId,
              isAgentJob: isAgentJob,
            })
          }
        }

        if (!cancelled) {
          setJobs(allJobs.reverse()) // newest first
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load jobs')
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [network.earnest, network.rpc, tick])

  return { jobs, loading, error, reload }
}

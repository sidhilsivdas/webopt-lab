import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Probe } from './probe'

export interface Sample {
  fps: number
  heapMB: number | null
  domNodes: number
  busyPct: number
}

export interface MetricsSnapshot {
  samples: Sample[]
  latest: Sample | null
  longestTaskMs: number
  totalBlockingMs: number
  rowsLoaded: number
  commits: number
  lastCommitMs: number
  totalCommitMs: number
  lastInteractionMs: number | null
  heapSupported: boolean
  longTaskSupported: boolean
}

// Chrome/Edge only, non-standard.
type MemoryPerformance = Performance & { memory?: { usedJSHeapSize: number } }

const heapSupported = typeof (performance as MemoryPerformance).memory !== 'undefined'
const longTaskSupported =
  typeof PerformanceObserver !== 'undefined' &&
  (PerformanceObserver.supportedEntryTypes ?? []).includes('longtask')

const emptySnapshot = (): MetricsSnapshot => ({
  samples: [],
  latest: null,
  longestTaskMs: 0,
  totalBlockingMs: 0,
  rowsLoaded: 0,
  commits: 0,
  lastCommitMs: 0,
  totalCommitMs: 0,
  lastInteractionMs: null,
  heapSupported,
  longTaskSupported,
})

/**
 * Samples FPS, JS heap, DOM node count under `targetRef`, and main-thread
 * busy time (from Long Tasks) every `intervalMs`. Restarts when `resetKey` changes.
 */
export function useMetrics(
  targetRef: RefObject<HTMLElement | null>,
  probeRef: RefObject<Probe>,
  resetKey: unknown,
  { intervalMs = 500, maxSamples = 60 } = {},
): MetricsSnapshot {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const optsRef = useRef({ intervalMs, maxSamples })

  useEffect(() => {
    const { intervalMs, maxSamples } = optsRef.current
    setSnapshot(emptySnapshot())

    let frames = 0
    let rafId = 0
    const countFrame = () => {
      frames++
      rafId = requestAnimationFrame(countFrame)
    }
    rafId = requestAnimationFrame(countFrame)

    let windowBusyMs = 0
    let longestTaskMs = 0
    let totalBlockingMs = 0
    let observer: PerformanceObserver | undefined
    if (longTaskSupported) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          windowBusyMs += entry.duration
          longestTaskMs = Math.max(longestTaskMs, entry.duration)
          totalBlockingMs += Math.max(0, entry.duration - 50)
        }
      })
      observer.observe({ type: 'longtask' })
    }

    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const elapsed = now - last
      last = now

      const sample: Sample = {
        fps: Math.round((frames * 1000) / elapsed),
        heapMB: heapSupported
          ? (performance as MemoryPerformance).memory!.usedJSHeapSize / 1048576
          : null,
        domNodes: targetRef.current?.getElementsByTagName('*').length ?? 0,
        busyPct: Math.min(100, (windowBusyMs / elapsed) * 100),
      }
      frames = 0
      windowBusyMs = 0

      const probe = probeRef.current
      setSnapshot((prev) => {
        const samples = [...prev.samples, sample].slice(-maxSamples)
        return {
          ...prev,
          samples,
          latest: sample,
          longestTaskMs,
          totalBlockingMs,
          rowsLoaded: probe.rowsLoaded,
          commits: probe.commits,
          lastCommitMs: probe.lastCommitMs,
          totalCommitMs: probe.totalCommitMs,
          lastInteractionMs: probe.lastInteractionMs,
        }
      })
    }, intervalMs)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(timer)
      observer?.disconnect()
    }
  }, [resetKey, targetRef, probeRef])

  return snapshot
}

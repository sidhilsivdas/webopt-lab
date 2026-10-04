// A mutable bag the demo lists write into and the metrics panel samples.
// It is deliberately not React state: writing to it must not cause renders,
// or the measurement would distort what it measures.

export interface Probe {
  rowsLoaded: number
  commits: number
  lastCommitMs: number
  totalCommitMs: number
  lastInteractionMs: number | null
}

export function createProbe(): Probe {
  return { rowsLoaded: 0, commits: 0, lastCommitMs: 0, totalCommitMs: 0, lastInteractionMs: null }
}

/**
 * Call at the start of a click handler. Records the time until the browser
 * has painted the result (rAF runs before paint, the timeout after it).
 */
export function measureInteraction(probe: Probe) {
  const start = performance.now()
  requestAnimationFrame(() => {
    setTimeout(() => {
      probe.lastInteractionMs = performance.now() - start
    })
  })
}

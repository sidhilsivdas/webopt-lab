import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { memo, Profiler, useEffect, useMemo, useRef, useState, type ProfilerOnRenderCallback, type RefObject } from 'react'
import { MetricsPanel } from '../../metrics/MetricsPanel'
import { createProbe, type Probe } from '../../metrics/probe'
import { useMetrics } from '../../metrics/useMetrics'
import { NaiveList } from './NaiveList'
import { QueryList } from './QueryList'
import { QueryVirtualList } from './QueryVirtualList'
import { CodeNotes } from './CodeNotes'

export type Mode = 'naive' | 'query' | 'virtual'

export const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: 'naive', label: 'Without TanStack Query', sub: 'useEffect fetch + render all' },
  { id: 'query', label: 'TanStack Query', sub: 'useInfiniteQuery, pages on scroll' },
  { id: 'virtual', label: 'TanStack Query + Virtual', sub: 'pages + only visible rows' },
]

const ROW_COUNTS = [10_000, 25_000, 50_000, 100_000]

// Rough freeze times for the naive version, measured in desktop Chrome.
const NAIVE_FREEZE: Record<number, string> = {
  10_000: 'a couple of seconds',
  25_000: 'several seconds',
  50_000: 'around 15–20 seconds',
  100_000: 'over a minute',
}

interface ListHostProps {
  mode: Mode
  total: number
  scrollRef: RefObject<HTMLDivElement | null>
  probe: Probe
  queryClient: QueryClient
}

// memo: parent updates (auto-scroll toggle, etc.) must not re-render the list,
// or the controls themselves would add load to the measurement.
const ListHost = memo(function ListHost({ mode, total, scrollRef, probe, queryClient }: ListHostProps) {
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    probe.commits++
    probe.lastCommitMs = actualDuration
    probe.totalCommitMs += actualDuration
  }
  const List = mode === 'naive' ? NaiveList : mode === 'query' ? QueryList : QueryVirtualList

  return (
    <QueryClientProvider client={queryClient}>
      <Profiler id="list" onRender={onRender}>
        <List total={total} scrollRef={scrollRef} probe={probe} />
      </Profiler>
    </QueryClientProvider>
  )
})

// Owns the sampled metrics state, so each sample re-renders only the panel.
function LiveMetrics(props: { listAreaRef: RefObject<HTMLDivElement | null>; probe: Probe; runKey: string }) {
  const probeRef = useRef(props.probe)
  probeRef.current = props.probe
  const metrics = useMetrics(props.listAreaRef, probeRef, props.runKey)
  return <MetricsPanel m={metrics} />
}

export function LargeListDemo() {
  const [mode, setMode] = useState<Mode>('naive')
  const [total, setTotal] = useState(10_000)
  const [run, setRun] = useState(0)
  const [autoScroll, setAutoScroll] = useState(false)

  const runKey = `${mode}-${total}-${run}`
  const probe = useMemo(() => createProbe(), [runKey])

  // A fresh cache per run so every measurement starts cold.
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false } } }),
    [runKey],
  )

  const listAreaRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The naive version freezes the tab, so it only mounts on an explicit click.
  const [startedKey, setStartedKey] = useState<string | null>(null)
  const started = mode !== 'naive' || startedKey === runKey

  // Scripted scroll so runs are comparable without relying on a steady hand.
  useEffect(() => {
    if (!autoScroll) return
    let raf = 0
    const stopAt = performance.now() + 8000
    // Paged lists can be caught at the bottom while the next page is still
    // loading, so only treat the bottom as the end once it stays put for 1 s.
    let atBottomSince: number | null = null
    const step = (now: number) => {
      const el = scrollRef.current
      const atBottom = !!el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      atBottomSince = atBottom ? (atBottomSince ?? now) : null
      if (!el || now > stopAt || (atBottomSince !== null && now - atBottomSince > 1000)) {
        setAutoScroll(false)
        return
      }
      el.scrollTop += 80
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [autoScroll])

  useEffect(() => setAutoScroll(false), [runKey])

  return (
    <section id="demo" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-widest text-sky-400 uppercase">Trick #1</span>
        <h2 className="text-3xl font-bold text-white">Rendering huge lists</h2>
        <p className="max-w-3xl text-slate-400">
          Same data, three implementations. Pick one, scroll the list or click rows on the left, and watch the
          main thread, memory and DOM size on the right. Each switch unmounts the previous version, so runs don't
          share state.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div role="tablist" className="grid grid-cols-1 gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id)
                setStartedKey(null) // coming back to the naive tab must ask again
              }}
              className={`rounded-lg px-4 py-2 text-left transition ${
                mode === m.id ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-sm font-semibold">{m.label}</div>
              <div className={`text-xs ${mode === m.id ? 'text-slate-900/80' : 'text-slate-500'}`}>{m.sub}</div>
            </button>
          ))}
        </div>
        {/* A link to another page, not a tab: styled apart so it doesn't read as a fourth mode. */}
        <a
          href="results.html"
          title="Automated test results: proof behind the numbers"
          className="group flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/50 px-3 py-2 text-sm font-semibold whitespace-nowrap text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/10"
        >
          <span aria-hidden="true">📊</span>
          Test results
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">↗</span>
        </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            Rows
            <select
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
              className="rounded-lg bg-slate-900 px-2 py-1.5 text-slate-100 ring-1 ring-slate-700 focus:ring-sky-500 focus:outline-none"
            >
              {ROW_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            {autoScroll ? '■ Stop auto-scroll' : '▶ Auto-scroll'}
          </button>
          <button
            onClick={() => setRun((r) => r + 1)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            ↻ Restart run
          </button>
        </div>
      </div>

      {/* Demo + metrics */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl bg-slate-900/50 ring-1 ring-slate-800">
          <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
            users · {total.toLocaleString()} total
          </div>
          {/* contain: strict isolates the list, so repaints elsewhere on the page (header
              FPS badge, metric charts) don't walk its subtree, which can hold 500k+ nodes. */}
          <div ref={listAreaRef} className="h-[560px] [contain:strict]" data-testid="list-area">
            {started ? (
              <ListHost key={runKey} mode={mode} total={total} scrollRef={scrollRef} probe={probe} queryClient={queryClient} />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="max-w-sm">
                  <p className="text-slate-300">
                    This version fetches and mounts all <b className="text-white">{total.toLocaleString()}</b> rows at once.
                  </p>
                  <p className="mt-2 text-sm text-amber-300">
                    The tab will freeze for {NAIVE_FREEZE[total]} while it renders. That's the point.
                  </p>
                  {total >= 50_000 && (
                    <p className="mt-2 text-xs text-slate-400">
                      If the browser shows a “Page unresponsive” dialog, choose <b>Wait</b>.
                    </p>
                  )}
                  <button
                    onClick={() => setStartedKey(runKey)}
                    className="mt-5 rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-sky-400"
                  >
                    ▶ Mount {total.toLocaleString()} rows
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside>
          <LiveMetrics listAreaRef={listAreaRef} probe={probe} runKey={runKey} />
        </aside>
      </div>

      <CodeNotes mode={mode} />
    </section>
  )
}

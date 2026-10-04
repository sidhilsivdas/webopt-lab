import type { MetricsSnapshot } from './useMetrics'
import { Sparkline } from './Sparkline'

const CAPACITY = 60

const fmtInt = (v: number) => Math.round(v).toLocaleString()
const fmtMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)

function fpsStatus(fps: number | undefined) {
  if (fps === undefined) return null
  if (fps >= 50) return { text: '● Smooth', cls: 'text-emerald-400' }
  if (fps >= 25) return { text: '▲ Janky', cls: 'text-amber-400' }
  return { text: '■ Frozen', cls: 'text-rose-400' }
}

function Tile(props: {
  title: string
  value: string
  unit?: string
  hint: string
  values: number[]
  max?: number
  format: (v: number) => string
  badge?: { text: string; cls: string } | null
  metric: string
  raw: number | null | undefined
}) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-3 ring-1 ring-slate-800" data-metric={props.metric} data-value={props.raw ?? ''}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span title={props.hint}>{props.title}</span>
        {props.badge && <span className={`font-medium ${props.badge.cls}`}>{props.badge.text}</span>}
      </div>
      <div className="mt-1 mb-2 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
        {props.value}
        {props.unit && <span className="ml-1 text-sm font-normal text-slate-400">{props.unit}</span>}
      </div>
      <Sparkline values={props.values} max={props.max} capacity={CAPACITY} format={props.format} label={props.title} />
    </div>
  )
}

function Stat(props: { label: string; value: string; hint: string; metric: string; raw: number | null }) {
  const { label, value, hint } = props
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" title={hint} data-metric={props.metric} data-value={props.raw ?? ''}>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-mono text-slate-100 tabular-nums">{value}</dd>
    </div>
  )
}

export function MetricsPanel({ m }: { m: MetricsSnapshot }) {
  const s = m.samples
  const latest = m.latest

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Tile
          title="Frame rate"
          value={latest ? fmtInt(latest.fps) : '–'}
          unit="fps"
          hint="Frames painted per second, counted with requestAnimationFrame"
          values={s.map((x) => x.fps)}
          max={70}
          format={(v) => `${fmtInt(v)} fps`}
          badge={fpsStatus(latest?.fps)}
          metric="fps"
          raw={latest?.fps}
        />
        <Tile
          title="Main thread busy"
          value={latest ? fmtInt(latest.busyPct) : '–'}
          unit="%"
          hint="Share of each sample window spent in Long Tasks (>50 ms). The closest proxy to CPU load a web page can see."
          values={s.map((x) => x.busyPct)}
          max={100}
          format={(v) => `${fmtInt(v)}%`}
          metric="busy"
          raw={latest?.busyPct}
        />
        <Tile
          title="JS heap used"
          value={latest?.heapMB != null ? latest.heapMB.toFixed(1) : 'n/a'}
          unit={latest?.heapMB != null ? 'MB' : undefined}
          hint="performance.memory.usedJSHeapSize (Chrome/Edge only)"
          values={s.map((x) => x.heapMB ?? 0)}
          format={(v) => `${v.toFixed(1)} MB`}
          metric="heap"
          raw={latest?.heapMB}
        />
        <Tile
          title="DOM nodes in list"
          value={latest ? fmtInt(latest.domNodes) : '–'}
          hint="Elements currently mounted inside the list panel"
          values={s.map((x) => x.domNodes)}
          format={fmtInt}
          metric="dom"
          raw={latest?.domNodes}
        />
      </div>

      <dl className="rounded-xl bg-slate-900/70 px-4 py-2 text-sm ring-1 ring-slate-800">
        <Stat label="Rows in memory" value={fmtInt(m.rowsLoaded)} hint="Rows the component currently holds" metric="rows" raw={m.rowsLoaded} />
        <Stat label="React commits" value={fmtInt(m.commits)} hint="Commits measured by <Profiler> around the list" metric="commits" raw={m.commits} />
        <Stat label="Last commit" value={fmtMs(m.lastCommitMs)} hint="actualDuration of the most recent list render" metric="lastCommit" raw={m.lastCommitMs} />
        <Stat label="Total render time" value={fmtMs(m.totalCommitMs)} hint="Sum of all list render durations this run" metric="totalCommit" raw={m.totalCommitMs} />
        <Stat
          label="Click → paint"
          value={m.lastInteractionMs === null ? 'click a row' : fmtMs(m.lastInteractionMs)}
          hint="Time from clicking a row until the selection is painted"
          metric="clickPaint"
          raw={m.lastInteractionMs}
        />
        <Stat label="Longest task" value={m.longTaskSupported ? fmtMs(m.longestTaskMs) : 'n/a'} hint="Longest single main-thread block" metric="longestTask" raw={m.longestTaskMs} />
        <Stat
          label="Total blocking time"
          value={m.longTaskSupported ? fmtMs(m.totalBlockingMs) : 'n/a'}
          hint="Sum of (task − 50 ms) for every Long Task this run"
          metric="tbt"
          raw={m.totalBlockingMs}
        />
      </dl>

      {(!m.heapSupported || !m.longTaskSupported) && (
        <p className="text-xs text-amber-400/90">
          Some metrics need a Chromium browser (Chrome or Edge). Open this page there for heap and long-task numbers.
        </p>
      )}
    </div>
  )
}

// Test results page. Deliberately framework-free: one static render from
// bundled JSON, so the page costs almost nothing to load and run.
import '../index.css'
import data from './test-results.json'

type Mode = 'naive' | 'query' | 'virtual'
type Status = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
interface Cell { status: Status; value?: string }
interface Perf {
  mode: Mode
  total: number
  status: Status
  dnf: boolean
  mountMs?: number
  mountLongestTaskMs?: number
  clickPaintMs?: number
  scrollAvgFps?: number
  heapAfterScrollMB?: number
  domAfterScroll?: number
}
interface Results {
  generatedAt: string
  durationMs: number
  browser: string
  machine: string
  stats: { total: number; passed: number; failed: number; skipped: number }
  features: ({ feature: string } & Record<Mode, Cell | null>)[]
  perf: Perf[]
  checks: { group: string; title: string; status: Status; durationMs: number | null }[]
  failures: { title: string; error: string }[]
}

const R = data as unknown as Results
const MODES: Mode[] = ['naive', 'query', 'virtual']
const MODE_NAME: Record<Mode, string> = {
  naive: 'Without TanStack Query',
  query: 'TanStack Query',
  virtual: 'TanStack Query + Virtual',
}
const MODE_HOW: Record<Mode, string> = {
  naive: 'Downloads every row at once and puts all of them on the page.',
  query: 'Downloads 200 rows at a time as you scroll, but keeps every loaded row on the page.',
  virtual: 'Downloads 200 rows at a time, and only puts the rows you can see on the page.',
}

// Plain-language names for the feature tests (keyed by test title).
const FEATURE_TEXT: Record<string, [string, string]> = {
  'Shows a loading state before data arrives': ['Shows a loading message', 'You see that something is happening instead of an empty box.'],
  'Rows in memory after first load': ['Loads the right amount of data first', 'The first version downloads every row; the other two start with 200.'],
  'Rows mounted in the DOM after first load': ['Puts the right number of rows on the page', 'The virtual list only adds the rows that fit on screen.'],
  'Row shows id, name, email, status and score': ['Each row shows the right details', 'Number, name, email, status and score are all there.'],
  'Same data on every run (deterministic mock)': ['Shows the same data every time', 'So every comparison is fair.'],
  'Fetches more rows when scrolled to the bottom': ['Loads more when you reach the bottom', 'The first version already has everything, so it must not fetch again.'],
  'Loads every row when scrolled to the end': ['You can reach the very last row', 'Nothing gets lost when data arrives in pages.'],
  'DOM size after scrolling 2,000 rows deep': ['Page size after scrolling 2,000 rows', 'How many page elements exist. Fewer means less work for the browser.'],
  'Clicking a row selects it and deselects the previous': ['Clicking selects a row', 'Only one row is highlighted at a time.'],
  'Click → paint latency is measured': ['How fast a click shows on screen', 'Under 100 ms feels instant.'],
  'Selection survives scrolling away and back': ['Selection is remembered while scrolling', 'Even when the row was removed from the page and added back.'],
  'Idle metric sampling does not re-render the list (bug #1)': ["Doesn't redraw the list when nothing changes", 'Guards against the bug that used to crash the page.'],
  'Stays smooth while idle after mount (bug #2)': ['Stays smooth when idle', 'Guards against the bug that kept the browser busy for no reason.'],
}

const GROUP_TEXT: Record<string, string> = {
  'Home & header': 'Links, buttons and cards on the home screen go where they should.',
  'Responsive (mobile 390×844)': 'The page works on a phone-sized screen.',
  'Demo controls': 'Tabs, the row-count menu, restart and auto-scroll behave correctly.',
  'Metrics panel': 'The live measurements on the right show up and update.',
  'Test results page': 'This page loads, stays lightweight, and links back to the demo.',
  'Test results page › on a phone': 'This page fits on a phone-sized screen.',
}

// ---------- formatting helpers
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const num = (n: number) => n.toLocaleString('en-US')
const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`)
const mins = (v: number) => (v >= 60_000 ? `${Math.round(v / 60_000)} min` : `${Math.round(v / 1000)} s`)

const STATUS: Record<Status, [string, string, string]> = {
  passed: ['✓', 'Passed', 'text-emerald-400'],
  failed: ['✗', 'Failed', 'text-rose-400'],
  timedOut: ['⏱', 'Timed out', 'text-amber-400'],
  skipped: ['–', 'Skipped', 'text-slate-400'],
  interrupted: ['■', 'Interrupted', 'text-rose-400'],
}
const badge = (s: Status, extra = '') => {
  const [icon, label, cls] = STATUS[s] ?? STATUS.failed
  return `<span class="${cls} font-medium whitespace-nowrap" title="${label}">${icon} <span class="sr-only">${label}</span></span>${
    extra ? ` <span class="text-slate-300">${esc(extra)}</span>` : ''
  }`
}

const section = (id: string, title: string, intro: string, body: string) => `
  <section id="${id}" class="mt-16 scroll-mt-20">
    <h2 class="text-2xl font-bold text-white">${title}</h2>
    <p class="mt-2 max-w-3xl text-slate-400">${intro}</p>
    <div class="mt-6">${body}</div>
  </section>`

const table = (head: string[], rows: string[][], firstColWide = true) => `
  <div class="relative overflow-x-auto rounded-xl ring-1 ring-slate-800">
    <!-- relative: the absolutely-positioned sr-only labels must be clipped by this scroll box -->

    <table class="w-full min-w-[560px] text-left text-sm">
      <thead class="bg-slate-900 text-xs text-slate-400">
        <tr>${head.map((h, i) => `<th scope="col" class="px-4 py-3 font-medium ${i && 'text-right'} ${i === 0 && firstColWide ? 'w-2/5' : ''}">${h}</th>`).join('')}</tr>
      </thead>
      <tbody class="divide-y divide-slate-800/80">
        ${rows.map((r) => `<tr class="bg-slate-950">${r.map((c, i) => `<td class="px-4 py-3 align-top ${i ? 'text-right' : ''}">${c}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>`

// ---------- sections
function summary() {
  const allGood = R.stats.failed === 0
  const when = new Date(R.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  return `
  <div class="mt-10 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center rounded-2xl bg-slate-900/70 p-6 ring-1 ${allGood ? 'ring-emerald-500/30' : 'ring-rose-500/40'}">
    <div class="flex items-center gap-4">
      <span class="grid size-14 shrink-0 place-items-center rounded-full text-2xl ${allGood ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}">${allGood ? '✓' : '!'}</span>
      <div>
        <div class="text-3xl font-bold text-white tabular-nums">${R.stats.passed} / ${R.stats.total}</div>
        <div class="text-sm ${allGood ? 'text-emerald-300' : 'text-rose-300'}">${allGood ? 'checks passed' : `checks passed · ${R.stats.failed} failed`}</div>
      </div>
    </div>
    <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:border-l sm:border-slate-800 sm:pl-6 lg:grid-cols-4">
      <div><dt class="text-slate-500">Last run</dt><dd class="text-slate-200">${esc(when)}</dd></div>
      <div><dt class="text-slate-500">Took</dt><dd class="text-slate-200">${mins(R.durationMs)}</dd></div>
      <div><dt class="text-slate-500">Browser</dt><dd class="text-slate-200">${esc(R.browser)}</dd></div>
      <div><dt class="text-slate-500">Computer</dt><dd class="text-slate-200">${esc(R.machine)}</dd></div>
    </dl>
  </div>`
}

function shortVersion() {
  const at = (mode: Mode) => R.perf.find((p) => p.mode === mode && p.total === 25_000 && !p.dnf)
  const slow = at('naive')
  const fast = at('virtual')
  if (!slow || !fast) return ''
  const cards: [string, string, string, string][] = [
    ['Opening the list', ms(slow.mountMs!), ms(fast.mountMs!), `${Math.round(slow.mountMs! / fast.mountMs!)}× faster`],
    ['Clicking a row', ms(slow.clickPaintMs!), ms(fast.clickPaintMs!), `${Math.round(slow.clickPaintMs! / fast.clickPaintMs!)}× faster`],
    ['Scrolling', `${slow.scrollAvgFps} fps`, `${fast.scrollAvgFps} fps`, fast.scrollAvgFps! >= 55 ? 'perfectly smooth' : 'smoother'],
    ['Memory used', `${slow.heapAfterScrollMB} MB`, `${fast.heapAfterScrollMB} MB`, `${Math.round(slow.heapAfterScrollMB! / fast.heapAfterScrollMB!)}× less`],
  ]
  return section(
    'short',
    'The short version',
    'With 25,000 rows, here is the first version compared with the fully optimized one.',
    `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${cards
        .map(
          ([label, before, after, gain]) => `
        <div class="rounded-2xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div class="text-sm text-slate-400">${label}</div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-slate-500 line-through decoration-slate-600">${before}</span>
            <span aria-hidden="true" class="text-slate-600">→</span>
            <span class="text-2xl font-bold text-white tabular-nums">${after}</span>
          </div>
          <div class="mt-1 text-sm font-medium text-sky-400">${gain}</div>
        </div>`,
        )
        .join('')}
    </div>`,
  )
}

function versions() {
  return section(
    'versions',
    'The three versions being compared',
    'All three show the same list of users. Only the technique changes.',
    `<div class="grid gap-4 md:grid-cols-3">
      ${MODES.map(
        (m, i) => `
        <div class="rounded-2xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div class="font-mono text-xs text-slate-500">Version ${i + 1}</div>
          <div class="mt-1 font-semibold text-white">${MODE_NAME[m]}</div>
          <p class="mt-2 text-sm text-slate-400">${MODE_HOW[m]}</p>
        </div>`,
      ).join('')}
    </div>`,
  )
}

function whatWeTest() {
  const count = (pred: (g: string) => boolean) => R.checks.filter((c) => pred(c.group)).length
  const perfCount = R.perf.length
  const items: [string, string, number][] = [
    ['Each version works correctly', 'Loading, scrolling, clicking and selecting rows, checked in all three versions.', R.features.length * MODES.length],
    ['Speed measurements', 'Every version timed with 10,000 up to 100,000 rows.', perfCount],
    ['Demo controls & live metrics', 'The buttons and the measurement panel in the demo.', count((g) => g === 'Demo controls' || g === 'Metrics panel')],
    ['Home page & phones', 'Navigation, links, cards, and the layout on a small screen.', count((g) => g.startsWith('Home') || g.startsWith('Responsive'))],
  ]
  return section(
    'what',
    'What we test, and why',
    'A robot (Playwright) opens the app in real Chrome and uses it like a person would: it clicks, scrolls and waits, then checks the result. This proves the demo works, and that the numbers it shows are real.',
    `<div class="grid gap-4 sm:grid-cols-2">
      ${items
        .map(
          ([title, text, n]) => `
        <div class="flex gap-4 rounded-2xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <div class="text-2xl font-bold text-sky-400 tabular-nums">${n}</div>
          <div>
            <div class="font-semibold text-white">${title}</div>
            <p class="mt-1 text-sm text-slate-400">${text}</p>
          </div>
        </div>`,
        )
        .join('')}
    </div>`,
  )
}

function features() {
  const rows = R.features.map((f) => {
    const [name, why] = FEATURE_TEXT[f.feature] ?? [f.feature, '']
    return [
      `<div class="font-medium text-slate-100">${esc(name)}</div>${why ? `<div class="mt-0.5 text-xs text-slate-500">${esc(why)}</div>` : ''}`,
      ...MODES.map((m) => (f[m] ? badge(f[m]!.status, f[m]!.value) : '<span class="text-slate-600">—</span>')),
    ]
  })
  return section(
    'correct',
    'Does each version behave correctly?',
    'Each check runs on all three versions with 10,000 rows. ✓ means it passed; a number shows what was measured.',
    table(['What we check', ...MODES.map((m) => MODE_NAME[m])], rows),
  )
}

const METRICS: { key: keyof Perf; title: string; text: string; higherIsBetter?: boolean; fmt: (v: number) => string }[] = [
  { key: 'mountMs', title: 'Time to show the list', text: 'From the click until rows are on screen and the page responds again.', fmt: ms },
  { key: 'mountLongestTaskMs', title: 'Longest freeze while opening', text: 'The longest stretch where the page could not respond to anything.', fmt: ms },
  { key: 'clickPaintMs', title: 'Time for a click to show', text: 'From clicking a row until it is highlighted. Under 100 ms feels instant.', fmt: ms },
  { key: 'scrollAvgFps', title: 'Smoothness while scrolling', text: 'Frames per second during an 8-second scroll. 60 is perfectly smooth; under 30 looks choppy.', higherIsBetter: true, fmt: (v) => `${v} fps` },
  { key: 'heapAfterScrollMB', title: 'Memory used', text: 'JavaScript memory after scrolling.', fmt: (v) => `${v} MB` },
  { key: 'domAfterScroll', title: 'Page elements in the list', text: 'Every element costs memory and browser work.', fmt: num },
]

function speed() {
  const totals = [...new Set(R.perf.map((p) => p.total))].sort((a, b) => a - b)
  const blocks = METRICS.map((m) => {
    const values = R.perf.filter((p) => !p.dnf).map((p) => Number(p[m.key]))
    const max = m.higherIsBetter ? 60 : Math.max(1, ...values)
    const rows = totals.map((t) => [
      `<span class="font-medium text-slate-200 tabular-nums">${num(t)}</span> <span class="text-slate-500">rows</span>`,
      ...MODES.map((mode) => {
        const p = R.perf.find((x) => x.mode === mode && x.total === t)
        if (!p) return '<span class="text-xs text-slate-500">not measured (too slow)</span>'
        if (p.dnf) return badge(p.status, 'did not finish')
        const v = Number(p[m.key])
        const pct = Math.max(2, Math.min(100, (v / max) * 100))
        return `<div class="tabular-nums text-slate-100">${m.fmt(v)}</div>
          <div class="mt-1 ml-auto h-1.5 w-full max-w-32 rounded-full bg-slate-800" aria-hidden="true"><div class="h-full rounded-full bg-sky-400/80" style="width:${pct.toFixed(1)}%"></div></div>`
      }),
    ])
    return `
      <div class="mt-10 first:mt-0">
        <h3 class="font-semibold text-white">${m.title}</h3>
        <p class="mt-1 mb-3 text-sm text-slate-400">${m.text} <span class="text-slate-300">${m.higherIsBetter ? 'Higher is better.' : 'Lower is better.'}</span></p>
        ${table(['List size', ...MODES.map((x) => MODE_NAME[x])], rows, false)}
      </div>`
  }).join('')
  return section(
    'speed',
    'How fast is each version?',
    'Each measurement uses a fresh browser page. "Not measured" means the first version took too long at that size to finish on the test computer, which is the point of this demo.',
    blocks,
  )
}

function checks() {
  const groups = [...new Set(R.checks.map((c) => c.group))]
  return section(
    'checks',
    'Every other check',
    'The rest of the app: home page, controls, live metrics and phone layout. Open a group to see each check.',
    `<div class="space-y-3">
      ${groups
        .map((g) => {
          const list = R.checks.filter((c) => c.group === g)
          const ok = list.filter((c) => c.status === 'passed').length
          return `
          <details class="group rounded-xl bg-slate-900/70 ring-1 ring-slate-800">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
              <span>
                <span class="font-semibold text-white">${esc(g)}</span>
                <span class="block text-sm text-slate-400">${esc(GROUP_TEXT[g] ?? '')}</span>
              </span>
              <span class="flex shrink-0 items-center gap-3 text-sm">
                <span class="${ok === list.length ? 'text-emerald-400' : 'text-rose-400'} tabular-nums">${ok}/${list.length} passed</span>
                <span aria-hidden="true" class="text-slate-500 transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            <ul class="divide-y divide-slate-800/80 border-t border-slate-800 text-sm">
              ${list
                .map(
                  (c) => `<li class="flex items-start justify-between gap-4 px-5 py-2.5">
                    <span class="flex gap-2">${badge(c.status)}<span class="text-slate-300">${esc(c.title.charAt(0).toUpperCase() + c.title.slice(1))}</span></span>
                    ${c.durationMs == null ? '' : `<span class="shrink-0 text-xs text-slate-500 tabular-nums">${(c.durationMs / 1000).toFixed(1)} s</span>`}
                  </li>`,
                )
                .join('')}
            </ul>
          </details>`
        })
        .join('')}
    </div>`,
  )
}

function failures() {
  if (!R.failures.length) return ''
  return section(
    'failures',
    'What failed',
    'These checks did not pass in the last run.',
    `<ul class="space-y-3">${R.failures
      .map((f) => `<li class="rounded-xl bg-rose-500/10 p-4 ring-1 ring-rose-500/30"><div class="font-medium text-rose-200">${esc(f.title)}</div><code class="mt-1 block text-xs break-words text-rose-300/80">${esc(f.error)}</code></li>`)
      .join('')}</ul>`,
  )
}

function glossary() {
  const terms: [string, string][] = [
    ['fps (frames per second)', 'How many times per second the screen is redrawn. 60 looks smooth.'],
    ['Freeze', 'A moment where the browser is too busy to react to clicks or scrolling.'],
    ['Page elements (DOM nodes)', 'The building blocks of a web page. Each row here is about 10 of them.'],
    ['Memory (JS heap)', 'How much memory the page’s JavaScript is using.'],
    ['Virtualization', 'Only putting the rows you can see on the page, and swapping them as you scroll.'],
    ['TanStack Query', 'A library that fetches data in pieces, caches it, and tracks loading.'],
  ]
  return section(
    'glossary',
    'Words used on this page',
    '',
    `<dl class="grid gap-4 sm:grid-cols-2">${terms
      .map(([t, d]) => `<div class="rounded-xl bg-slate-900/70 p-4 ring-1 ring-slate-800"><dt class="font-semibold text-white">${t}</dt><dd class="mt-1 text-sm text-slate-400">${d}</dd></div>`)
      .join('')}</dl>`,
  )
}

function rerun() {
  return section(
    'rerun',
    'Run the tests yourself',
    'From the project folder. The results on this page update after the report step.',
    `<pre class="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-300 ring-1 ring-slate-800"><code>npm run test:quick    # everything except the speed measurements (~10 min)
npm run test:e2e      # everything (~15 min)
npm run test:report   # refresh TEST-MATRIX.md and this page</code></pre>`,
  )
}

const NAV: [string, string][] = [
  ['#short', 'Summary'],
  ['#correct', 'Correctness'],
  ['#speed', 'Speed'],
  ['#checks', 'All checks'],
  ['#glossary', 'Glossary'],
]

document.getElementById('app')!.innerHTML = `
  <nav class="sticky top-0 z-10 border-b border-slate-900 bg-slate-950/90 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <a href="./" class="flex items-center gap-2 font-semibold text-white">
        <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-xs text-slate-950">⚡</span>
        WebOpt Lab
      </a>
      <div class="hidden gap-1 text-sm md:flex">
        ${NAV.map(([href, label]) => `<a href="${href}" class="rounded-md px-2 py-1 text-slate-400 hover:text-white">${label}</a>`).join('')}
      </div>
      <a href="./#demo" class="rounded-lg px-3 py-1.5 text-sm text-sky-400 ring-1 ring-sky-500/40 hover:bg-sky-500/10">← Back to demo</a>
    </div>
  </nav>
  <main class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <span class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Test results</span>
    <h1 class="mt-2 text-3xl font-bold text-white sm:text-4xl">Is the demo telling the truth?</h1>
    <p class="mt-3 max-w-3xl text-lg text-slate-400">
      Automated tests use the app in a real browser and measure it, so every claim in the demo is checked.
    </p>
    ${summary()}
    ${failures()}
    ${shortVersion()}
    ${versions()}
    ${whatWeTest()}
    ${features()}
    ${speed()}
    ${checks()}
    ${glossary()}
    ${rerun()}
  </main>
  <footer class="border-t border-slate-900 py-8 text-center text-sm text-slate-500">
    WebOpt Lab · results from the last automated test run
  </footer>`

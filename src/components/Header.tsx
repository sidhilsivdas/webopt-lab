import { useEffect, useRef, useState } from 'react'

const TRICKS = [
  { n: 1, title: 'Huge lists', desc: 'TanStack Query + virtualization vs rendering everything.', live: true, href: '#demo' },
  { n: 2, title: 'Memoization', desc: 'memo, useMemo and useCallback, and when they don’t help.', live: false },
  { n: 3, title: 'Transitions', desc: 'useTransition and useDeferredValue for responsive input.', live: false },
  { n: 4, title: 'Code splitting', desc: 'lazy() and Suspense to shrink the initial bundle.', live: false },
  { n: 5, title: 'Web Workers', desc: 'Move heavy computation off the main thread.', live: false },
  { n: 6, title: 'Debounce & throttle', desc: 'Tame high-frequency events like search and resize.', live: false },
]

function useLiveFps() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let frames = 0
    let raf = 0
    const tick = () => {
      frames++
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      setFps(Math.round((frames * 1000) / (now - last)))
      frames = 0
      last = now
    }, 500)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
    }
  }, [])
  return fps
}

function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  const fps = useLiveFps()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fpsColor = fps >= 50 ? 'bg-emerald-400' : fps >= 25 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? 'bg-slate-950/80 shadow-lg shadow-black/20 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold text-white">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-slate-950">
            ⚡
          </span>
          WebOpt Lab
        </a>
        <div className="flex items-center gap-1 text-sm sm:gap-4">
          <a href="#tricks" className="hidden rounded-md px-2 py-1 text-slate-300 hover:text-white sm:block">
            Tricks
          </a>
          <a href="#demo" className="hidden rounded-md px-2 py-1 text-slate-300 hover:text-white sm:block">
            Live demo
          </a>
          <span
            className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 font-mono text-xs text-slate-300 ring-1 ring-slate-800"
            title="This page's own frame rate, right now"
          >
            <span className={`size-2 rounded-full ${fpsColor} animate-pulse`} />
            {fps} fps
          </span>
        </div>
      </div>
    </nav>
  )
}

function TrickCard({ trick }: { trick: (typeof TRICKS)[number] }) {
  const ref = useRef<HTMLAnchorElement>(null)

  // Spotlight that follows the cursor, driven by CSS variables (no re-render).
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <a
      ref={ref}
      href={trick.live ? trick.href : undefined}
      onPointerMove={onMove}
      aria-disabled={!trick.live}
      className={`group relative overflow-hidden rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800 transition duration-300 ${
        trick.live ? 'cursor-pointer hover:-translate-y-1 hover:ring-sky-500/60' : 'cursor-default opacity-70 hover:opacity-90'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(240px circle at var(--x) var(--y), rgba(56,189,248,0.15), transparent 70%)' }}
      />
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-xs text-slate-500">#{String(trick.n).padStart(2, '0')}</span>
        {trick.live ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
            ● Live demo
          </span>
        ) : (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">Coming soon</span>
        )}
      </div>
      <h3 className="relative mt-3 font-semibold text-white">{trick.title}</h3>
      <p className="relative mt-1 text-sm text-slate-400">{trick.desc}</p>
      {trick.live && (
        <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-400">
          Try it <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      )}
    </a>
  )
}

export function Header() {
  const heroRef = useRef<HTMLElement>(null)

  const onMove = (e: React.PointerEvent) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <header id="top">
      <NavBar />
      <section ref={heroRef} onPointerMove={onMove} className="hero relative overflow-hidden pt-32 pb-20">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="hero-spot pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700">
              <span className="size-1.5 rounded-full bg-sky-400" /> React performance, measured live
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Make React apps{' '}
              <span className="animate-gradient bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-[length:200%_auto] bg-clip-text text-transparent">
                feel instant
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-400">
              Side-by-side demos of optimization tricks. Interact with the slow version and the fast version, and
              watch frame rate, main-thread load and memory change in real time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="#demo"
                className="rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
              >
                Start the demo
              </a>
              <a
                href="#tricks"
                className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-800"
              >
                Browse tricks
              </a>
            </div>
          </div>

          <div id="tricks" className="mt-16 grid scroll-mt-24 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRICKS.map((t) => (
              <TrickCard key={t.n} trick={t} />
            ))}
          </div>
        </div>
      </section>
    </header>
  )
}

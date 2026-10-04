import { useState } from 'react'

interface SparklineProps {
  values: number[]
  /** Fixed y-domain max; when omitted the line scales to its own peak. */
  max?: number
  capacity: number
  format: (v: number) => string
  label: string
}

const W = 200
const H = 48

export function Sparkline({ values, max, capacity, format, label }: SparklineProps) {
  const [hover, setHover] = useState<number | null>(null)
  const peak = max ?? Math.max(1, ...values) * 1.15
  // Pin samples to the right edge so the line grows leftwards as history fills.
  const x = (i: number) => ((capacity - values.length + i) / (capacity - 1)) * W
  const y = (v: number) => H - 2 - (Math.min(v, peak) / peak) * (H - 4)

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = values.length > 1 ? `${line}L${x(values.length - 1)},${H}L${x(0)},${H}Z` : ''

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!values.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round((px / W) * (capacity - 1)) - (capacity - values.length)
    setHover(i >= 0 && i < values.length ? i : null)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-12 w-full cursor-crosshair"
        role="img"
        aria-label={`${label} over the last ${values.length} samples`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line x1="0" x2={W} y1={H - 1} y2={H - 1} className="stroke-slate-700" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {area && <path d={area} className="fill-sky-400/10" />}
        {line && (
          <path d={line} fill="none" className="stroke-sky-400" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-slate-400" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-slate-100 ring-1 ring-slate-700"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          {format(values[hover])}
        </div>
      )}
    </div>
  )
}

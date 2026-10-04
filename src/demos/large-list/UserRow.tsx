import type { CSSProperties } from 'react'
import type { User } from '../../lib/mockApi'

export const ROW_HEIGHT = 56

const statusStyle: Record<User['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  invited: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  suspended: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
}

interface UserRowProps {
  user: User
  selected: boolean
  onSelect: (id: number) => void
  style?: CSSProperties
}

// Intentionally not memoized: the demo shows what an ordinary row costs.
export function UserRow({ user, selected, onSelect, style }: UserRowProps) {
  return (
    <div
      style={{ height: ROW_HEIGHT, ...style }}
      onClick={() => onSelect(user.id)}
      data-testid="user-row"
      data-id={user.id}
      data-selected={selected || undefined}
      className={`flex cursor-pointer items-center gap-3 border-b border-slate-800/80 px-3 text-sm transition-colors ${
        selected ? 'bg-sky-500/15' : 'hover:bg-slate-800/50'
      }`}
    >
      <span className="w-14 shrink-0 font-mono text-xs text-slate-500">#{user.id}</span>
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
        {user.firstName[0]}
        {user.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-100">
          {user.firstName} {user.lastName}
        </div>
        <div className="truncate text-xs text-slate-400">{user.email}</div>
      </div>
      <div className="hidden w-28 shrink-0 truncate text-xs text-slate-400 md:block">
        {user.role} · {user.city}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusStyle[user.status]}`}>{user.status}</span>
      <div className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-800 sm:block" title={`Score ${user.score}`}>
        <div className="h-full rounded-full bg-sky-400" style={{ width: `${user.score}%` }} />
      </div>
    </div>
  )
}

export function StatusLine({ children }: { children: React.ReactNode }) {
  return <div className="flex h-14 items-center justify-center gap-2 text-sm text-slate-400">{children}</div>
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
}

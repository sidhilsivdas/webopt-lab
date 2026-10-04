import type { Mode } from './LargeListDemo'

const NOTES: Record<Mode, { code: string; watch: string[] }> = {
  naive: {
    code: `const [users, setUsers] = useState<User[] | null>(null)

useEffect(() => {
  fetchAllUsers(total).then(setUsers)   // one huge response
}, [total])

return users?.map((u) => <UserRow key={u.id} user={u} />)`,
    watch: [
      'Main thread pegged at 100% while all rows mount, and FPS drops to ~0.',
      'DOM node count in the hundreds of thousands, and the heap jumps.',
      'Clicking a row re-renders every row, so click → paint takes hundreds of ms.',
    ],
  },
  query: {
    code: `const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['users', total],
  queryFn: ({ pageParam }) => fetchUsersPage(pageParam, 200, total),
  initialPageParam: 0,
  getNextPageParam: (last) => last.nextCursor,
})
// an IntersectionObserver at the bottom calls fetchNextPage()`,
    watch: [
      'First paint is fast because only 200 rows are fetched and rendered.',
      'Keep scrolling: DOM nodes and heap climb with every page.',
      'Click latency grows too. TanStack Query fixed the fetching, not the rendering.',
    ],
  },
  virtual: {
    code: `const virtualizer = useVirtualizer({
  count: hasNextPage ? users.length + 1 : users.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 56,
  overscan: 8,
})

virtualizer.getVirtualItems().map((item) => (
  <UserRow style={{ transform: \`translateY(\${item.start}px)\` }} ... />
))`,
    watch: [
      'DOM node count stays flat (about 30 rows) no matter how far you scroll.',
      'FPS stays near 60 during auto-scroll, with little main-thread busy time.',
      'Click → paint stays in single-digit ms because only visible rows re-render.',
    ],
  },
}

export function CodeNotes({ mode }: { mode: Mode }) {
  const n = NOTES[mode]
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-300 ring-1 ring-slate-800">
        <code>{n.code}</code>
      </pre>
      <div className="rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-white">What to watch</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          {n.watch.map((w) => (
            <li key={w} className="flex gap-2">
              <span className="text-sky-400">→</span>
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchUsersPage } from '../../lib/mockApi'
import { measureInteraction } from '../../metrics/probe'
import { PAGE_SIZE, type ListProps } from './types'
import { Spinner, StatusLine, UserRow } from './UserRow'

/**
 * TanStack Query alone: data arrives in pages as you scroll, so the first
 * paint is fast. But every loaded row stays in the DOM, so the cost
 * creeps back the further you scroll.
 */
export function QueryList({ total, scrollRef, probe }: ListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ['users', total],
    queryFn: ({ pageParam }) => fetchUsersPage(pageParam, PAGE_SIZE, total),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  })

  const users = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data])
  probe.rowsLoaded = users.length

  // Load the next page when the sentinel at the bottom comes near the viewport.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { root: scrollRef.current, rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, scrollRef])

  const select = (id: number) => {
    measureInteraction(probe)
    setSelectedId(id)
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto" data-testid="list-scroll">
      {isPending ? (
        <StatusLine>
          <Spinner /> Fetching first page…
        </StatusLine>
      ) : (
        users.map((u) => <UserRow key={u.id} user={u} selected={u.id === selectedId} onSelect={select} />)
      )}
      <div ref={sentinelRef}>
        {isFetchingNextPage && (
          <StatusLine>
            <Spinner /> Loading more…
          </StatusLine>
        )}
        {!isPending && !hasNextPage && <StatusLine>All {total.toLocaleString()} rows loaded</StatusLine>}
      </div>
    </div>
  )
}

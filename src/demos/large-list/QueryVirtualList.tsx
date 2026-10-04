import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useState } from 'react'
import { fetchUsersPage } from '../../lib/mockApi'
import { measureInteraction } from '../../metrics/probe'
import { PAGE_SIZE, type ListProps } from './types'
import { ROW_HEIGHT, Spinner, StatusLine, UserRow } from './UserRow'

/**
 * TanStack Query + TanStack Virtual: pages are fetched on demand, and only
 * the rows inside the viewport (plus a small overscan) exist in the DOM.
 */
export function QueryVirtualList({ total, scrollRef, probe }: ListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ['users', total],
    queryFn: ({ pageParam }) => fetchUsersPage(pageParam, PAGE_SIZE, total),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  })

  const users = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data])
  probe.rowsLoaded = users.length

  const virtualizer = useVirtualizer({
    // One extra slot renders the "loading more" row at the end.
    count: hasNextPage ? users.length + 1 : users.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })
  const items = virtualizer.getVirtualItems()

  // Fetch the next page once the user scrolls within 20 rows of the loaded end.
  const lastIndex = items.at(-1)?.index ?? 0
  useEffect(() => {
    if (lastIndex >= users.length - 20 && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [lastIndex, users.length, hasNextPage, isFetchingNextPage, fetchNextPage])

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
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {items.map((item) => {
            const style = { position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` } as const
            const user = users[item.index]
            return user ? (
              <UserRow key={item.key} user={user} selected={user.id === selectedId} onSelect={select} style={style} />
            ) : (
              <div key={item.key} style={{ ...style, height: ROW_HEIGHT }}>
                <StatusLine>
                  <Spinner /> Loading more…
                </StatusLine>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

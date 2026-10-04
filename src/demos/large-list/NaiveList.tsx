import { useEffect, useState } from 'react'
import { fetchAllUsers, type User } from '../../lib/mockApi'
import { measureInteraction } from '../../metrics/probe'
import type { ListProps } from './types'
import { Spinner, StatusLine, UserRow } from './UserRow'

/** The common first attempt: fetch everything in useEffect, render every row. */
export function NaiveList({ total, scrollRef, probe }: ListProps) {
  const [users, setUsers] = useState<User[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetchAllUsers(total).then((rows) => {
      if (!alive) return
      probe.rowsLoaded = rows.length
      setUsers(rows)
    })
    return () => {
      alive = false
    }
  }, [total, probe])

  const select = (id: number) => {
    measureInteraction(probe)
    setSelectedId(id)
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto" data-testid="list-scroll">
      {users === null ? (
        <StatusLine>
          <Spinner /> Fetching all {total.toLocaleString()} rows…
        </StatusLine>
      ) : (
        users.map((u) => <UserRow key={u.id} user={u} selected={u.id === selectedId} onSelect={select} />)
      )}
    </div>
  )
}

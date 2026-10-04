import type { RefObject } from 'react'
import type { Probe } from '../../metrics/probe'

export interface ListProps {
  total: number
  scrollRef: RefObject<HTMLDivElement | null>
  probe: Probe
}

export const PAGE_SIZE = 200

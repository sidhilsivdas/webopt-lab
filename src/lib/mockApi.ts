// In-browser fake backend. No server: rows are generated deterministically
// from their index, and every call is wrapped in an artificial network delay.

export type UserStatus = 'active' | 'invited' | 'suspended'

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  company: string
  role: string
  city: string
  status: UserStatus
  score: number
  joinedAt: string
  tags: string[]
  address: { street: string; zip: string; country: string }
}

export interface UsersPage {
  rows: User[]
  nextCursor: number | undefined
  total: number
}

const FIRST = ['Ava', 'Liam', 'Maya', 'Noah', 'Zara', 'Arjun', 'Lena', 'Omar', 'Iris', 'Kenji', 'Sofia', 'Ravi', 'Elena', 'Theo', 'Nina', 'Diego']
const LAST = ['Patel', 'Nguyen', 'Garcia', 'Kim', 'Müller', 'Okafor', 'Rossi', 'Silva', 'Haddad', 'Novak', 'Tanaka', 'Menon', 'Dubois', 'Larsen']
const COMPANIES = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka', 'Cyberdyne', 'Tyrell']
const ROLES = ['Engineer', 'Designer', 'PM', 'Analyst', 'Support', 'Sales', 'Ops', 'Researcher']
const CITIES = ['Kochi', 'Berlin', 'Austin', 'Tokyo', 'Lagos', 'Lisbon', 'Toronto', 'Seoul', 'Nairobi', 'Oslo', 'Lima', 'Pune']
const COUNTRIES = ['IN', 'DE', 'US', 'JP', 'NG', 'PT', 'CA', 'KR', 'KE', 'NO', 'PE']
const TAGS = ['beta', 'vip', 'trial', 'enterprise', 'churn-risk', 'early', 'partner', 'edu']
const STATUSES: UserStatus[] = ['active', 'active', 'active', 'invited', 'suspended']

// Small seeded PRNG so row N is always the same row N.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeUser(id: number): User {
  const rand = mulberry32(id + 1)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const firstName = pick(FIRST)
  const lastName = pick(LAST)
  const company = pick(COMPANIES)
  return {
    id,
    firstName,
    lastName,
    email: `${firstName}.${lastName}${id}@${company}.com`.toLowerCase(),
    company,
    role: pick(ROLES),
    city: pick(CITIES),
    status: pick(STATUSES),
    score: Math.floor(rand() * 100),
    joinedAt: new Date(1_600_000_000_000 + Math.floor(rand() * 150_000_000_000)).toISOString(),
    tags: [pick(TAGS), pick(TAGS)],
    address: {
      street: `${1 + Math.floor(rand() * 999)} ${pick(LAST)} St`,
      zip: String(10000 + Math.floor(rand() * 89999)),
      country: pick(COUNTRIES),
    },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** "GET /users": the whole dataset in one response. */
export async function fetchAllUsers(total: number): Promise<User[]> {
  await sleep(400)
  return Array.from({ length: total }, (_, i) => makeUser(i))
}

/** "GET /users?cursor=X&limit=Y": one page at a time. */
export async function fetchUsersPage(cursor: number, limit: number, total: number): Promise<UsersPage> {
  await sleep(150)
  const end = Math.min(cursor + limit, total)
  const rows = Array.from({ length: end - cursor }, (_, k) => makeUser(cursor + k))
  return { rows, nextCursor: end < total ? end : undefined, total }
}

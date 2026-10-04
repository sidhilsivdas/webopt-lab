import { expect, type Page, type TestInfo } from '@playwright/test'

export type Mode = 'naive' | 'query' | 'virtual'

export const MODES: Mode[] = ['naive', 'query', 'virtual']

export const MODE_LABEL: Record<Mode, string> = {
  naive: 'Without TanStack Query',
  query: 'TanStack Query',
  virtual: 'TanStack Query + Virtual',
}

const TAB_NAME: Record<Mode, RegExp> = {
  naive: /^Without TanStack Query/,
  query: /^TanStack Query useInfiniteQuery/,
  virtual: /^TanStack Query \+ Virtual/,
}

export const tab = (page: Page, mode: Mode) => page.getByRole('tab', { name: TAB_NAME[mode] })
export const rows = (page: Page) => page.getByTestId('user-row')
export const listScroll = (page: Page) => page.getByTestId('list-scroll')
export const mountButton = (page: Page) => page.getByRole('button', { name: /^▶ Mount .* rows$/ })
export const autoScrollButton = (page: Page) => page.getByRole('button', { name: /auto-scroll/i })

/** Formats like the app does in the (en-US) test browser, regardless of this machine's locale. */
export const fmt = (n: number) => n.toLocaleString('en-US')

/** Reads a metric's raw number from the metrics panel (null when empty). */
export async function metric(page: Page, key: string): Promise<number | null> {
  const v = await page.locator(`[data-metric="${key}"]`).getAttribute('data-value')
  return v === null || v === '' ? null : Number(v)
}

/** Waits until the metrics panel reports `key` satisfying `ok`. */
export async function waitMetric(page: Page, key: string, ok: (v: number) => boolean, timeout = 15_000) {
  await expect
    .poll(async () => {
      const v = await metric(page, key)
      return v !== null && ok(v)
    }, { timeout })
    .toBe(true)
  return (await metric(page, key))!
}

export async function openDemo(page: Page, mode: Mode = 'naive', total?: number) {
  await page.goto('/')
  await page.locator('#demo').scrollIntoViewIfNeeded()
  if (total) await page.getByRole('combobox').selectOption(String(total))
  if (mode !== 'naive') await tab(page, mode).click()
}

/** Opens a tab and gets rows on screen (clicking the mount gate for the naive tab). */
export async function startList(page: Page, mode: Mode, total?: number) {
  await openDemo(page, mode, total)
  if (mode === 'naive') await mountButton(page).click()
  await expect(rows(page).first()).toBeVisible({ timeout: 120_000 })
}

/** Resolves once the main thread is free and a frame has been painted. */
export const nextPaint = (page: Page) =>
  page.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => setTimeout(() => r(performance.now())))))

/** Scrolls the list to its bottom once. */
export const scrollListToBottom = (page: Page) =>
  listScroll(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })

/** Keeps scrolling to the bottom until `done()` or the attempt budget runs out. */
export async function scrollUntil(page: Page, done: () => Promise<boolean>, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    if (await done()) return
    await scrollListToBottom(page)
    await page.waitForTimeout(120)
  }
  throw new Error('scrollUntil: condition never met')
}

/** Records rAF frame times in the page; call the returned stop() to get stats. */
export async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __rec: boolean }
    w.__frames = []
    w.__rec = true
    const tick = (t: number) => {
      if (!w.__rec) return
      w.__frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  return async () =>
    page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __rec: boolean }
      w.__rec = false
      const f = w.__frames
      const gaps = f.slice(1).map((t, i) => t - f[i])
      const span = f.length > 1 ? f[f.length - 1] - f[0] : 0
      return {
        avgFps: span ? Math.round(((f.length - 1) * 1000) / span) : 0,
        worstFrameMs: Math.round(Math.max(0, ...gaps)),
        jankyFramePct: gaps.length ? Math.round((gaps.filter((g) => g > 50).length / gaps.length) * 100) : 0,
      }
    })
}

/** Installs a buffered Long Task recorder before any page script runs. */
export async function installLongTaskRecorder(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lt: { start: number; dur: number }[] }
    w.__lt = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lt.push({ start: e.startTime, dur: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  })
}

/** Long-task stats for tasks that started at or after `since` (performance.now() time). */
export const longTasksSince = (page: Page, since: number) =>
  page.evaluate((since) => {
    const tasks = (window as unknown as { __lt: { start: number; dur: number }[] }).__lt.filter((t) => t.start >= since)
    return {
      longestTaskMs: Math.round(Math.max(0, ...tasks.map((t) => t.dur))),
      tbtMs: Math.round(tasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0)),
    }
  }, since)

export const heapMB = (page: Page) =>
  page.evaluate(() => {
    const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return m ? Math.round(m.usedJSHeapSize / 1048576) : null
  })

export const domNodesInList = (page: Page) =>
  page.getByTestId('list-area').evaluate((el) => el.getElementsByTagName('*').length)

/** Attaches data to the test result; scripts/test-report.mjs reads these. */
export function annotate(info: TestInfo, type: string, data: unknown) {
  info.annotations.push({ type, description: typeof data === 'string' ? data : JSON.stringify(data) })
}

import { expect, test } from '@playwright/test'
import {
  autoScrollButton,
  fmt,
  listScroll,
  metric,
  mountButton,
  openDemo,
  rows,
  startList,
  tab,
  waitMetric,
} from './helpers'

test.describe('Demo controls', () => {
  test('defaults: naive tab selected, 10,000 rows', async ({ page }) => {
    await openDemo(page)
    await expect(tab(page, 'naive')).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 'query')).toHaveAttribute('aria-selected', 'false')
    await expect(tab(page, 'virtual')).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByRole('combobox')).toHaveValue('10000')
  })

  test('row-count options are 10k, 25k, 50k, 100k', async ({ page }) => {
    await openDemo(page)
    const values = await page.getByRole('combobox').locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))
    expect(values).toEqual(['10000', '25000', '50000', '100000'])
  })

  test('naive tab does not mount anything until the button is clicked', async ({ page }) => {
    await openDemo(page)
    await expect(mountButton(page)).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(rows(page)).toHaveCount(0)
    expect(await metric(page, 'rows')).toBe(0)
  })

  const freezeText: [number, RegExp, boolean][] = [
    [10_000, /a couple of seconds/, false],
    [25_000, /several seconds/, false],
    [50_000, /15–20 seconds/, true],
    [100_000, /over a minute/, true],
  ]
  for (const [total, text, unresponsiveHint] of freezeText) {
    test(`mount gate warning for ${fmt(total)} rows`, async ({ page }) => {
      await openDemo(page, 'naive', total)
      await expect(mountButton(page)).toHaveText(`▶ Mount ${fmt(total)} rows`)
      await expect(page.getByText(text)).toBeVisible()
      await expect(page.getByText('Page unresponsive')).toBeVisible({ visible: unresponsiveHint })
    })
  }

  test('changing the row count re-arms the mount gate', async ({ page }) => {
    await startList(page, 'naive')
    await page.getByRole('combobox').selectOption('25000')
    await expect(mountButton(page)).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
  })

  test('restart run re-arms the naive gate and resets metrics', async ({ page }) => {
    await startList(page, 'naive')
    await waitMetric(page, 'commits', (v) => v > 0)
    await page.getByRole('button', { name: /Restart run/ }).click()
    await expect(mountButton(page)).toBeVisible()
    await expect.poll(() => metric(page, 'commits')).toBe(0)
    await expect.poll(() => metric(page, 'rows')).toBe(0)
  })

  test('restart run in TanStack Query tab refetches from a cold cache', async ({ page }) => {
    await startList(page, 'query')
    await waitMetric(page, 'rows', (v) => v === 200)
    await listScroll(page).evaluate((el) => (el.scrollTop = el.scrollHeight))
    await waitMetric(page, 'rows', (v) => v >= 400)
    await page.getByRole('button', { name: /Restart run/ }).click()
    await waitMetric(page, 'rows', (v) => v === 200)
    await expect(listScroll(page)).toHaveJSProperty('scrollTop', 0)
  })

  test('switching tabs unmounts the previous list', async ({ page }) => {
    await startList(page, 'naive')
    await expect(rows(page)).toHaveCount(10_000)
    await tab(page, 'virtual').click()
    await expect(tab(page, 'virtual')).toHaveAttribute('aria-selected', 'true')
    await expect(rows(page).first()).toBeVisible()
    expect(await rows(page).count()).toBeLessThan(100)
  })

  test('switching back to the naive tab requires mounting again', async ({ page }) => {
    await startList(page, 'naive')
    await tab(page, 'query').click()
    await tab(page, 'naive').click()
    await expect(mountButton(page)).toBeVisible()
  })

  const notes = [
    ['naive', /fetchAllUsers/, /re-renders every row/],
    ['query', /useInfiniteQuery/, /fixed the fetching, not the rendering/],
    ['virtual', /useVirtualizer/, /stays flat/],
  ] as const
  for (const [mode, code, watch] of notes) {
    test(`code notes match the ${mode} tab`, async ({ page }) => {
      await openDemo(page, mode)
      await expect(page.locator('#demo pre')).toContainText(code)
      await expect(page.locator('#demo ul')).toContainText(watch)
    })
  }

  test('auto-scroll button toggles to Stop and can be stopped manually', async ({ page }) => {
    await startList(page, 'virtual')
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/Stop auto-scroll/)
    await page.waitForTimeout(800)
    const scrolled = await listScroll(page).evaluate((el) => el.scrollTop)
    expect(scrolled).toBeGreaterThan(500)
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/)
    const at = await listScroll(page).evaluate((el) => el.scrollTop)
    await page.waitForTimeout(400)
    expect(await listScroll(page).evaluate((el) => el.scrollTop)).toBe(at)
  })

  test('auto-scroll stops by itself after ~8 seconds', async ({ page }) => {
    await startList(page, 'virtual', 100_000)
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/Stop auto-scroll/)
    await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/, { timeout: 12_000 })
  })

  test('auto-scroll stops by itself at the end of a short list', async ({ page }) => {
    await startList(page, 'naive')
    await listScroll(page).evaluate((el) => (el.scrollTop = el.scrollHeight - el.clientHeight - 2000))
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/, { timeout: 6_000 })
  })

  test('auto-scroll waits for the next page instead of stopping early (TanStack Query tab)', async ({ page }) => {
    await startList(page, 'query', 100_000)
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/, { timeout: 12_000 })
    // 8 s at 80 px/frame is ~38,000 px, or ~680 rows. Stopping at the first
    // page boundary used to leave this at 400.
    expect(await metric(page, 'rows')).toBeGreaterThanOrEqual(600)
  })

  test('auto-scroll is cancelled when switching tabs', async ({ page }) => {
    await startList(page, 'virtual', 100_000)
    await autoScrollButton(page).click()
    await expect(autoScrollButton(page)).toHaveText(/Stop auto-scroll/)
    await tab(page, 'query').click()
    await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/)
  })
})

test.describe('Metrics panel', () => {
  test('all metric tiles and stats are present', async ({ page }) => {
    await openDemo(page)
    for (const key of ['fps', 'busy', 'heap', 'dom', 'rows', 'commits', 'lastCommit', 'totalCommit', 'clickPaint', 'longestTask', 'tbt']) {
      await expect(page.locator(`[data-metric="${key}"]`)).toBeVisible()
    }
  })

  test('metrics start sampling and report ~60 fps when idle', async ({ page }) => {
    await openDemo(page)
    await waitMetric(page, 'fps', (v) => v >= 45)
    expect(await metric(page, 'heap')).toBeGreaterThan(0)
  })

  test('click → paint shows a placeholder until a row is clicked', async ({ page }) => {
    await openDemo(page)
    await expect(page.locator('[data-metric="clickPaint"]')).toContainText('click a row')
  })

  test('sparkline hover shows a tooltip with the sample value', async ({ page }) => {
    await openDemo(page)
    await page.waitForTimeout(2500)
    const svg = page.locator('[data-metric="fps"] svg')
    const box = (await svg.boundingBox())!
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2)
    await expect(page.locator('[data-metric="fps"]').getByText(/^\d+ fps$/)).toBeVisible()
  })

  test('no Chromium-only notice in Chrome', async ({ page }) => {
    await openDemo(page)
    await page.waitForTimeout(800)
    await expect(page.getByText('Some metrics need a Chromium browser')).toBeHidden()
  })
})

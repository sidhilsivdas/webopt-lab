import { expect, test, type Page } from '@playwright/test'
import {
  domNodesInList,
  fmt,
  listScroll,
  metric,
  MODES,
  mountButton,
  openDemo,
  recordFrames,
  rows,
  scrollListToBottom,
  scrollUntil,
  startList,
  waitMetric,
} from './helpers'

// Titles follow "<feature> [<mode>]" so scripts/test-report.mjs can build the
// feature × tab matrix. Every list here uses the default 10,000 rows.
const TOTAL = 10_000
const NODES_PER_ROW = 10

const loaded = (page: Page) => metric(page, 'rows').then((v) => v ?? 0)

test.describe('Feature matrix', () => {
  for (const mode of MODES) {
    test(`Shows a loading state before data arrives [${mode}]`, async ({ page }) => {
      // Freeze timers so the simulated network delay can't finish on its own.
      await page.clock.install()
      await openDemo(page, mode)
      if (mode === 'naive') await mountButton(page).click()
      const text = mode === 'naive' ? `Fetching all ${fmt(TOTAL)} rows…` : 'Fetching first page…'
      await expect(page.getByText(text)).toBeVisible()
      await expect(rows(page)).toHaveCount(0)
      await page.clock.runFor(1000)
      await expect(rows(page).first()).toBeVisible()
    })

    test(`Rows in memory after first load [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const expected = mode === 'naive' ? TOTAL : 200
      await waitMetric(page, 'rows', (v) => v === expected)
    })

    test(`Rows mounted in the DOM after first load [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const count = await rows(page).count()
      if (mode === 'naive') expect(count).toBe(TOTAL)
      if (mode === 'query') expect(count).toBe(200)
      if (mode === 'virtual') expect(count).toBeLessThan(40) // viewport (~10) + overscan
    })

    test(`Row shows id, name, email, status and score [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const row = rows(page).nth(3)
      await expect(row).toContainText('#3')
      await expect(row).toContainText(/@[a-z]+\.com/)
      await expect(row).toContainText(/active|invited|suspended/)
      await expect(row.locator('[title^="Score "]')).toBeAttached()
    })

    test(`Same data on every run (deterministic mock) [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const first = (await rows(page).nth(5).textContent())!
      await page.getByRole('button', { name: /Restart run/ }).click()
      if (mode === 'naive') await mountButton(page).click()
      await expect(rows(page).nth(5)).toHaveText(first)
    })

    test(`Fetches more rows when scrolled to the bottom [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const before = await waitMetric(page, 'rows', (v) => v > 0)
      await scrollListToBottom(page)
      if (mode === 'naive') {
        // Everything was fetched up front; scrolling must not change it.
        await page.waitForTimeout(800)
        expect(await loaded(page)).toBe(before)
      } else {
        await waitMetric(page, 'rows', (v) => v >= before + 200)
      }
    })

    test(`Loads every row when scrolled to the end [${mode}]`, async ({ page }) => {
      test.setTimeout(120_000)
      await startList(page, mode)
      await scrollUntil(page, async () => (await loaded(page)) >= TOTAL)
      await scrollListToBottom(page)
      await expect(page.locator(`[data-testid="user-row"][data-id="${TOTAL - 1}"]`)).toBeVisible()
      if (mode === 'query') await expect(page.getByText(`All ${fmt(TOTAL)} rows loaded`)).toBeVisible()
      await expect(page.getByText('Loading more…')).toHaveCount(0)
    })

    test(`DOM size after scrolling 2,000 rows deep [${mode}]`, async ({ page }, info) => {
      test.setTimeout(90_000)
      await startList(page, mode)
      await scrollUntil(page, async () => (await loaded(page)) >= 2000)
      await page.waitForTimeout(600)
      const nodes = await domNodesInList(page)
      info.annotations.push({ type: 'domNodes', description: String(nodes) })
      if (mode === 'naive') expect(nodes).toBe(TOTAL * NODES_PER_ROW + 1)
      if (mode === 'query') expect(nodes).toBeGreaterThanOrEqual(2000 * NODES_PER_ROW)
      if (mode === 'virtual') expect(nodes).toBeLessThan(600)
    })

    test(`Clicking a row selects it and deselects the previous [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      await rows(page).nth(2).click()
      await expect(rows(page).nth(2)).toHaveAttribute('data-selected', 'true')
      await rows(page).nth(4).click()
      await expect(rows(page).nth(4)).toHaveAttribute('data-selected', 'true')
      await expect(rows(page).nth(2)).not.toHaveAttribute('data-selected')
      await expect(page.locator('[data-testid="user-row"][data-selected]')).toHaveCount(1)
    })

    test(`Click → paint latency is measured [${mode}]`, async ({ page }, info) => {
      await startList(page, mode)
      await page.waitForTimeout(500)
      await rows(page).nth(3).click()
      const ms = await waitMetric(page, 'clickPaint', (v) => v > 0)
      info.annotations.push({ type: 'clickPaintMs', description: String(Math.round(ms)) })
      if (mode === 'virtual') expect(ms).toBeLessThan(200)
    })

    test(`Selection survives scrolling away and back [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      await rows(page).nth(1).click()
      await expect(page.locator('[data-testid="user-row"][data-id="1"]')).toHaveAttribute('data-selected', 'true')
      await listScroll(page).evaluate((el) => (el.scrollTop = 5000))
      await page.waitForTimeout(400)
      await listScroll(page).evaluate((el) => (el.scrollTop = 0))
      await expect(page.locator('[data-testid="user-row"][data-id="1"]')).toHaveAttribute('data-selected', 'true')
    })

    test(`Idle metric sampling does not re-render the list (bug #1) [${mode}]`, async ({ page }) => {
      await startList(page, mode)
      const commits = await waitMetric(page, 'commits', (v) => v > 0)
      await page.waitForTimeout(1000)
      const settled = (await metric(page, 'commits'))!
      await page.waitForTimeout(3000) // 6 sampling ticks
      expect(await metric(page, 'commits')).toBe(settled)
      expect(settled).toBeGreaterThanOrEqual(commits)
    })

    test(`Stays smooth while idle after mount (bug #2) [${mode}]`, async ({ page }, info) => {
      await startList(page, mode)
      await page.waitForTimeout(3000) // let post-mount GC and layout settle
      const stop = await recordFrames(page)
      await page.waitForTimeout(3000)
      const frames = await stop()
      info.annotations.push({ type: 'idleFps', description: String(frames.avgFps) })
      // Before the fix this sat at ~20 fps; 40 catches a regression without being flaky.
      expect(frames.avgFps).toBeGreaterThanOrEqual(40)
    })
  }
})

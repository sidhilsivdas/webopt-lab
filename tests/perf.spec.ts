import { expect, test } from '@playwright/test'
import {
  autoScrollButton,
  domNodesInList,
  installLongTaskRecorder,
  longTasksSince,
  MODES,
  mountButton,
  nextPaint,
  openDemo,
  recordFrames,
  rows,
  tab,
  waitMetric,
} from './helpers'

const TOTALS = [10_000, 25_000, 50_000, 100_000]
const NAIVE_MAX = 25_000

// --expose-gc lets us force a collection, so heap readings show retained memory.
test.use({ launchOptions: { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] } })

const gcHeapMB = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    ;(window as unknown as { gc?: () => void }).gc?.()
    const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    return m ? Math.round(m.usedJSHeapSize / 1048576) : null
  })

test.describe('Performance matrix @perf', () => {
  for (const mode of MODES) {
    for (const total of TOTALS) {
      // Naive 50k+ doesn't finish within minutes on an 8 GB laptop, so it isn't measured.
      if (mode === 'naive' && total > NAIVE_MAX) continue
      test(`Perf ${mode} ${total}`, async ({ page, browser }, info) => {
        test.setTimeout(300_000)
        info.annotations.push({ type: 'browser', description: `Chrome ${browser.version()}` })
        await installLongTaskRecorder(page)

        // Land on the naive tab's gate (nothing mounted), let the page settle.
        await openDemo(page, 'naive', total)
        await page.waitForTimeout(1000)
        const heapBefore = await gcHeapMB(page)

        // ---- Mount: click → first rows painted and main thread free again.
        const t0 = await page.evaluate(() => performance.now())
        if (mode === 'naive') await mountButton(page).click()
        else await tab(page, mode).click()
        await expect(rows(page).first()).toBeVisible({ timeout: 240_000 })
        const tReady = await nextPaint(page)
        const mount = await longTasksSince(page, t0)

        await page.waitForTimeout(1000)
        const heapAfterMount = await gcHeapMB(page)
        const domAfterMount = await domNodesInList(page)

        // ---- Click a row: time until the selection is painted.
        await rows(page).nth(3).click()
        const clickPaintMs = await waitMetric(page, 'clickPaint', (v) => v > 0, 120_000)
        await nextPaint(page)

        // ---- Auto-scroll for up to 8 s and record every frame.
        const tScroll = await page.evaluate(() => performance.now())
        const stop = await recordFrames(page)
        await autoScrollButton(page).click()
        await expect(autoScrollButton(page)).toHaveText(/▶ Auto-scroll/, { timeout: 120_000 })
        const frames = await stop()
        const scroll = await longTasksSince(page, tScroll)
        await page.waitForTimeout(800)
        const rowsAfterScroll = await waitMetric(page, 'rows', (v) => v > 0)
        const domAfterScroll = await domNodesInList(page)
        const heapAfterScroll = await gcHeapMB(page)

        const result = {
          mode,
          total,
          mountMs: Math.round(tReady - t0),
          mountLongestTaskMs: mount.longestTaskMs,
          mountTbtMs: mount.tbtMs,
          heapBeforeMB: heapBefore,
          heapAfterMountMB: heapAfterMount,
          heapAfterScrollMB: heapAfterScroll,
          domAfterMount,
          domAfterScroll,
          rowsAfterScroll,
          clickPaintMs: Math.round(clickPaintMs),
          scrollAvgFps: frames.avgFps,
          scrollWorstFrameMs: frames.worstFrameMs,
          scrollJankyFramePct: frames.jankyFramePct,
          scrollTbtMs: scroll.tbtMs,
        }
        info.annotations.push({ type: 'perf', description: JSON.stringify(result) })

        // Sanity checks on the claims the demo makes.
        if (mode === 'naive') expect(domAfterMount).toBe(total * 10 + 1)
        if (mode === 'virtual') {
          expect(domAfterScroll).toBeLessThan(600)
          expect(clickPaintMs).toBeLessThan(200)
        }
      })
    }
  }
})

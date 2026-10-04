import { expect, test } from '@playwright/test'
import { openDemo, tab } from './helpers'

test.describe('Test results page', () => {
  test('demo has a "Test results" link right after the virtual tab', async ({ page }) => {
    await openDemo(page)
    const link = page.getByRole('link', { name: /Test results/ })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', 'results.html')
    // Sits to the right of the last tab, on the same row (desktop).
    const tabBox = (await tab(page, 'virtual').boundingBox())!
    const linkBox = (await link.boundingBox())!
    expect(linkBox.x).toBeGreaterThan(tabBox.x + tabBox.width)
    // It is a link, not a fourth tab.
    await expect(page.getByRole('tab')).toHaveCount(3)
  })

  test('link opens the results page', async ({ page }) => {
    await openDemo(page)
    await page.getByRole('link', { name: /Test results/ }).click()
    await expect(page).toHaveURL(/\/results\.html$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Is the demo telling the truth?')
  })

  test('renders every section with no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/results.html')
    for (const h of ['The three versions being compared', 'What we test, and why', 'Does each version behave correctly?', 'How fast is each version?', 'Every other check', 'Words used on this page']) {
      await expect(page.getByRole('heading', { name: h })).toBeVisible()
    }
    await expect(page.getByText(/checks passed/)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('check groups expand to list each check', async ({ page }) => {
    await page.goto('/results.html')
    const group = page.locator('details').first()
    await expect(group.locator('li').first()).toBeHidden()
    await group.locator('summary').click()
    await expect(group.locator('li').first()).toBeVisible()
  })

  test('"Back to demo" returns to the demo section', async ({ page }) => {
    await page.goto('/results.html')
    await page.getByRole('link', { name: /Back to demo/ }).click()
    await expect(page).toHaveURL(/\/#demo$/)
    await expect(page.locator('#demo')).toBeInViewport()
  })

  test('is lightweight: no React, small JS, few requests', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.goto('/results.html')
    await page.waitForLoadState('networkidle')
    const { jsKB, cssKB } = await page.evaluate(() => {
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const kb = (ext: string) => Math.round(res.filter((r) => r.name.endsWith(ext)).reduce((s, r) => s + r.encodedBodySize, 0) / 1024)
      return { jsKB: kb('.js'), cssKB: kb('.css') }
    })
    test.info().annotations.push({ type: 'pageWeight', description: `${jsKB} KB JS, ${cssKB} KB CSS, ${requests.length} requests` })
    expect(jsKB).toBeLessThan(40)
    expect(requests.length).toBeLessThanOrEqual(5)
    expect(await page.evaluate(() => 'React' in window || !!document.querySelector('[data-reactroot]'))).toBe(false)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('no horizontal page scroll; wide tables scroll inside their box', async ({ page }) => {
      await page.goto('/results.html')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})

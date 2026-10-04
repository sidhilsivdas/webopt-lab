import { expect, test } from '@playwright/test'

test.describe('Home & header', () => {
  test('page loads with no console errors or page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Make React apps')
    await page.waitForTimeout(1500)
    expect(errors).toEqual([])
  })

  test('page title is set', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/WebOpt Lab/)
  })

  test('navbar FPS badge shows a live frame rate', async ({ page }) => {
    await page.goto('/')
    const badge = page.locator('nav').getByText(/\d+ fps/)
    await expect(badge).toBeVisible()
    await page.waitForTimeout(1200)
    const fps = Number((await badge.innerText()).replace(/\D/g, ''))
    expect(fps).toBeGreaterThan(20)
  })

  test('navbar gets a solid background after scrolling', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav')
    await expect(nav).toHaveClass(/bg-transparent/)
    await page.mouse.wheel(0, 400)
    await expect(nav).toHaveClass(/backdrop-blur/)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(nav).toHaveClass(/bg-transparent/)
  })

  for (const [link, target] of [
    ['Tricks', '#tricks'],
    ['Live demo', '#demo'],
  ] as const) {
    test(`navbar "${link}" link scrolls to ${target}`, async ({ page }) => {
      await page.goto('/')
      await page.locator('nav').getByRole('link', { name: link }).click()
      await expect(page).toHaveURL(new RegExp(`${target}$`))
      await expect(page.locator(target)).toBeInViewport()
    })
  }

  for (const [cta, target] of [
    ['Start the demo', '#demo'],
    ['Browse tricks', '#tricks'],
  ] as const) {
    test(`hero "${cta}" button scrolls to ${target}`, async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: cta }).click()
      await expect(page).toHaveURL(new RegExp(`${target}$`))
      await expect(page.locator(target)).toBeInViewport()
    })
  }

  test('logo link returns to the top', async ({ page }) => {
    await page.goto('/#demo')
    await page.locator('nav').getByRole('link', { name: /WebOpt Lab/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  })

  test('six trick cards: one live, five coming soon', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('#tricks > a')
    await expect(cards).toHaveCount(6)
    await expect(cards.filter({ hasText: 'Live demo' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Coming soon' })).toHaveCount(5)
  })

  test('live trick card links to the demo', async ({ page }) => {
    await page.goto('/')
    await page.locator('#tricks > a', { hasText: 'Huge lists' }).click()
    await expect(page).toHaveURL(/#demo$/)
    await expect(page.locator('#demo')).toBeInViewport()
  })

  test('coming-soon cards are disabled and go nowhere', async ({ page }) => {
    await page.goto('/')
    const soon = page.locator('#tricks > a', { hasText: 'Coming soon' })
    for (let i = 0; i < 5; i++) {
      await expect(soon.nth(i)).toHaveAttribute('aria-disabled', 'true')
      await expect(soon.nth(i)).not.toHaveAttribute('href')
    }
  })

  test('trick card spotlight follows the pointer', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('#tricks > a').first()
    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + 40, box.y + 30)
    const x = await card.evaluate((el) => el.style.getPropertyValue('--x'))
    expect(x).toBe('40px')
  })

  test('footer states that no server is involved', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer')).toContainText('No server involved')
  })
})

test.describe('Responsive (mobile 390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('no horizontal page scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('navbar text links hide, FPS badge stays', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav').getByRole('link', { name: 'Tricks' })).toBeHidden()
    await expect(page.locator('nav').getByText(/fps/)).toBeVisible()
  })

  test('demo tabs, list and metrics are all usable', async ({ page }) => {
    await page.goto('/#demo')
    await page.getByRole('tab', { name: /^TanStack Query \+ Virtual/ }).click()
    await expect(page.getByTestId('user-row').first()).toBeVisible()
    await expect(page.locator('[data-metric="fps"]')).toBeVisible()
  })
})

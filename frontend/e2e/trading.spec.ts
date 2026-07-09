import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

test.describe('Trading', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test('dashboard shows live watchlist with prices', async ({ page }) => {
    await page.goto('/')
    // Watchlist table should have EURUSD row
    await expect(page.getByText('EURUSD')).toBeVisible()
    // Wait for a price to appear (up to 5s for WS tick)
    await expect(page.locator('table').getByText(/1\.\d{5}/).first()).toBeVisible({ timeout: 5_000 })
  })

  test('clicking a watchlist row navigates to trading page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('row', { name: /EURUSD/i }).click()
    await expect(page).toHaveURL('/trading/EURUSD')
    await expect(page.getByText('EURUSD')).toBeVisible()
  })

  test('trading page shows chart and order panel', async ({ page }) => {
    await page.goto('/trading/EURUSD')
    await expect(page.getByText('EURUSD')).toBeVisible()
    // Order panel buy button
    await expect(page.getByRole('button', { name: /buy/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sell/i })).toBeVisible()
  })

  test('place a market buy order', async ({ page }) => {
    await page.goto('/trading/EURUSD')

    // Wait for price to load (WS tick)
    await expect(page.getByText(/1\.\d{5}/).first()).toBeVisible({ timeout: 5_000 })

    // Fill quantity and submit buy
    await page.getByPlaceholder(/quantity/i).fill('1000')
    await page.getByRole('button', { name: /buy/i }).click()

    // Success toast
    await expect(page.getByText(/order placed/i)).toBeVisible({ timeout: 5_000 })

    // Position appears in the table below
    await expect(page.getByText('EURUSD').nth(1)).toBeVisible({ timeout: 5_000 })
  })

  test('portfolio page shows summary and positions', async ({ page }) => {
    // Place an order first
    await page.goto('/trading/EURUSD')
    await expect(page.getByText(/1\.\d{5}/).first()).toBeVisible({ timeout: 5_000 })
    await page.getByPlaceholder(/quantity/i).fill('1000')
    await page.getByRole('button', { name: /buy/i }).click()
    await expect(page.getByText(/order placed/i)).toBeVisible({ timeout: 5_000 })

    await page.goto('/portfolio')
    // Balance should show $100,000
    await expect(page.getByText(/100,000/)).toBeVisible({ timeout: 5_000 })
    // Open positions section
    await expect(page.getByText('Open Positions')).toBeVisible()
    await expect(page.getByText('EURUSD')).toBeVisible()
  })

  test('journal page lists filled orders', async ({ page }) => {
    // Place an order first
    await page.goto('/trading/EURUSD')
    await expect(page.getByText(/1\.\d{5}/).first()).toBeVisible({ timeout: 5_000 })
    await page.getByPlaceholder(/quantity/i).fill('1000')
    await page.getByRole('button', { name: /buy/i }).click()
    await expect(page.getByText(/order placed/i)).toBeVisible({ timeout: 5_000 })

    await page.goto('/journal')
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible()
    await expect(page.getByText('EURUSD')).toBeVisible()
    await expect(page.getByText('BUY')).toBeVisible()
  })
})

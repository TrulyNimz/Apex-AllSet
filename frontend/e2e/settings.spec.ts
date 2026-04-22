import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page)
  })

  test('profile tab shows user data and allows name update', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Settings')).toBeVisible()

    // Profile tab is default
    await expect(page.getByLabel('First Name')).toHaveValue('E2E')
    await expect(page.getByLabel('Last Name')).toHaveValue('User')

    // Update name
    await page.getByLabel('First Name').fill('Updated')
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/profile updated/i)).toBeVisible({ timeout: 5_000 })
  })

  test('security tab shows 2FA section', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /security/i }).click()
    await expect(page.getByText('Two-Factor Authentication')).toBeVisible()
    await expect(page.getByRole('button', { name: /enable 2fa/i })).toBeVisible()
  })
})

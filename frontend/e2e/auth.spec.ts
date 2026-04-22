import { test, expect } from '@playwright/test'
import { uniqueEmail, registerAndLogin, login } from './helpers'

test.describe('Auth', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('register → auto-login → dashboard', async ({ page }) => {
    const email = await registerAndLogin(page)
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
  })

  test('login with existing credentials', async ({ page }) => {
    const email = uniqueEmail()
    await registerAndLogin(page, email)

    // Log out
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)

    // Log back in
    await login(page, email)
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@apex.io')
    await page.getByLabel('Password').fill('WrongPassword1!')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Toast or inline error
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 5_000 })
  })

  test('sign out clears session', async ({ page }) => {
    await registerAndLogin(page)
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    // Navigating to / should redirect back to login
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})

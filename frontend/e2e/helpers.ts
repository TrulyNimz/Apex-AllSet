import { type Page } from '@playwright/test'

/** Unique email per test run to avoid conflicts across runs */
export function uniqueEmail() {
  return `e2e-${Date.now()}@apex.io`
}

/** Register and log in via the UI; returns the email used */
export async function registerAndLogin(page: Page, email = uniqueEmail()) {
  await page.goto('/register')
  await page.getByLabel('First Name').fill('E2E')
  await page.getByLabel('Last Name').fill('User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('TestPass123!')
  await page.getByRole('button', { name: /create account/i }).click()
  // After successful register the app redirects to /
  await page.waitForURL('/')
  return email
}

export async function login(page: Page, email: string, password = 'TestPass123!') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/')
}

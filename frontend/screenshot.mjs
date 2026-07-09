import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const email = `demo-${Date.now()}@apex.io`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`saved ${name}.png`)
}

// Login screen
await page.goto('http://localhost:5173/login')
await page.waitForTimeout(600)
await shot('01-login')

// Register
await page.goto('http://localhost:5173/register')
await page.getByLabel('First Name').fill('Nimrod')
await page.getByLabel('Last Name').fill('Trader')
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password').fill('TestPass123!')
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForURL('http://localhost:5173/')

// Dashboard — wait for live prices to tick in
await page.waitForTimeout(2500)
await shot('02-dashboard')

// Trading page + place an order so positions show
await page.goto('http://localhost:5173/trading/EURUSD')
await page.waitForTimeout(2500)
await shot('03-trading')
await page.getByPlaceholder(/quantity/i).fill('10000')
await page.getByRole('button', { name: /buy/i }).click()
await page.waitForTimeout(1500)
await page.goto('http://localhost:5173/trading/BTCUSD')
await page.waitForTimeout(2500)
await shot('04-trading-btc')

// Portfolio
await page.goto('http://localhost:5173/portfolio')
await page.waitForTimeout(1500)
await shot('05-portfolio')

// Journal
await page.goto('http://localhost:5173/journal')
await page.waitForTimeout(1000)
await shot('06-journal')

// Settings
await page.goto('http://localhost:5173/settings')
await page.waitForTimeout(800)
await shot('07-settings')

await browser.close()
console.log('done:', email)

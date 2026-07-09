// Number/price formatting helpers shared across the trading UI.

/** Decimal places per instrument, matching FX / metal / crypto conventions. */
export function priceDecimals(symbol: string): number {
  if (symbol.endsWith('JPY')) return 3
  if (symbol === 'XAUUSD' || symbol === 'BTCUSD') return 2
  return 5
}

export function formatPrice(symbol: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(priceDecimals(symbol))
}

export function formatUSD(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Currency with an explicit +/- sign — used for PnL. */
export function formatSignedUSD(value: number): string {
  const body = formatUSD(Math.abs(value))
  return value < 0 ? `-${body}` : `+${body}`
}

export function formatSignedPct(value: number): string {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatQty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

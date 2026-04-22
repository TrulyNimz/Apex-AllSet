import { useMemo } from 'react'
import { useOrderHistory } from '@hooks/usePortfolio'
import { usePositions } from '@hooks/usePortfolio'
import type { Order } from '@/types'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-panel border border-border rounded-xl px-5 py-4">
      <p className="text-xs text-muted uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-mono font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function pnlColor(v: number) {
  return v > 0 ? 'text-teal' : v < 0 ? 'text-danger' : 'text-muted'
}

export function JournalPage() {
  const { data: orders }    = useOrderHistory()
  const { data: positions } = usePositions()

  const filled = useMemo<Order[]>(
    () => (orders ?? []).filter((o) => o.status === 'filled'),
    [orders],
  )

  // Realized PnL by symbol from closed positions (quantity = 0 excluded from ListPositions,
  // but we can show open position realized_pnl as a best-effort proxy)
  const pnlBySymbol = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of positions ?? []) {
      map[p.symbol] = (map[p.symbol] ?? 0) + p.realized_pnl
    }
    return map
  }, [positions])

  const totalTrades  = filled.length
  const buys         = filled.filter((o) => o.side === 'buy').length
  const sells        = filled.filter((o) => o.side === 'sell').length
  const symbols      = [...new Set(filled.map((o) => o.symbol))]
  const totalRealized = Object.values(pnlBySymbol).reduce((s, v) => s + v, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-white">Journal</h1>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Trades"   value={String(totalTrades)} />
        <StatCard label="Buy Orders"     value={String(buys)} />
        <StatCard label="Sell Orders"    value={String(sells)} />
        <StatCard label="Symbols Traded" value={String(symbols.length)} />
      </div>

      {/* Realized PnL by symbol */}
      {Object.keys(pnlBySymbol).length > 0 && (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-white">Realized P&L by Symbol</h2>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(pnlBySymbol).map(([sym, pnl]) => (
              <div key={sym} className="flex items-center justify-between px-5 py-3">
                <span className="font-mono text-sm font-semibold text-white">{sym}</span>
                <span className={`font-mono text-sm font-bold ${pnlColor(pnl)}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-surface/30">
              <span className="text-sm font-semibold text-white">Total</span>
              <span className={`font-mono text-sm font-bold ${pnlColor(totalRealized)}`}>
                {totalRealized >= 0 ? '+' : ''}{totalRealized.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trade log */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Trade Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Symbol', 'Side', 'Type', 'Qty', 'Fill Price', 'Status', 'Time'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filled.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No trades yet — place your first order on the Trading page
                  </td>
                </tr>
              ) : (
                filled.map((o) => (
                  <tr key={o.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-white">{o.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${o.side === 'buy' ? 'text-teal' : 'text-danger'}`}>
                        {o.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted capitalize">{o.type}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted text-right">
                      {Number(o.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-white text-right">
                      {o.fill_price != null ? Number(o.fill_price).toFixed(5) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-teal capitalize">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

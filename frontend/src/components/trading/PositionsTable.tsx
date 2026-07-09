import { usePositions } from '@hooks/useMarketData'
import { useMarketStore } from '@store/market.store'
import { formatPrice, formatQty, formatSignedUSD } from '@/lib/format'
import { Badge } from '@components/ui/Badge'

export function PositionsTable() {
  const { data: positions, isLoading } = usePositions()
  const ticks = useMarketStore((s) => s.ticks)

  if (isLoading) return <p className="p-4 text-sm text-muted">Loading positions…</p>
  if (!positions || positions.length === 0) {
    return <p className="p-4 text-sm text-muted">No open positions.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted">
          <th className="px-3 py-2 font-medium">Symbol</th>
          <th className="px-3 py-2 font-medium">Side</th>
          <th className="px-3 py-2 text-right font-medium">Qty</th>
          <th className="px-3 py-2 text-right font-medium">Avg Price</th>
          <th className="px-3 py-2 text-right font-medium">Market</th>
          <th className="px-3 py-2 text-right font-medium">Unrealized P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const live = ticks[p.symbol]?.mid ?? p.current_price
          const pnl = (live - p.avg_price) * p.quantity
          const long = p.quantity >= 0
          return (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-2.5 font-medium text-white">{p.symbol}</td>
              <td className="px-3 py-2.5">
                <Badge tone={long ? 'teal' : 'danger'}>{long ? 'LONG' : 'SHORT'}</Badge>
              </td>
              <td className="px-3 py-2.5 text-right tnum">{formatQty(Math.abs(p.quantity))}</td>
              <td className="px-3 py-2.5 text-right tnum">{formatPrice(p.symbol, p.avg_price)}</td>
              <td className="px-3 py-2.5 text-right tnum">{formatPrice(p.symbol, live)}</td>
              <td className={`px-3 py-2.5 text-right tnum ${pnl >= 0 ? 'text-teal' : 'text-danger'}`}>
                {formatSignedUSD(pnl)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

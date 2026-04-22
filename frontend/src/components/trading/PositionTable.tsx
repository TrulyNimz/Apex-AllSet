import { useTick } from '@hooks/useTick'
import { usePlaceOrder } from '@hooks/useOrders'
import { usePositions } from '@hooks/usePortfolio'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import type { Position } from '@/types'

function PositionRow({ position }: { position: Position }) {
  const { tick }   = useTick(position.symbol)
  const placeOrder = usePlaceOrder()

  const currentPrice   = tick?.mid ?? position.current_price
  const unrealizedPnL  = (currentPrice - position.avg_price) * position.quantity
  const cost           = position.avg_price * Math.abs(position.quantity)
  const pnlPct         = cost > 0 ? (unrealizedPnL / cost) * 100 : 0
  const isLong         = position.quantity > 0
  const isProfit       = unrealizedPnL >= 0

  const closePosition = () => {
    placeOrder.mutate({
      symbol:   position.symbol,
      side:     isLong ? 'sell' : 'buy',
      type:     'market',
      quantity: Math.abs(position.quantity),
    })
  }

  const fmt = (n: number, d = 5) => n.toFixed(d)

  return (
    <tr className="border-b border-border hover:bg-surface/50 transition-colors">
      <td className="px-4 py-3 font-mono text-sm text-white">{position.symbol}</td>
      <td className="px-4 py-3">
        <Badge variant={isLong ? 'success' : 'danger'}>{isLong ? 'Long' : 'Short'}</Badge>
      </td>
      <td className="px-4 py-3 font-mono text-sm text-right text-muted">
        {Math.abs(position.quantity).toLocaleString()}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-right text-muted">{fmt(position.avg_price)}</td>
      <td className="px-4 py-3 font-mono text-sm text-right text-white">{fmt(currentPrice)}</td>
      <td className={`px-4 py-3 font-mono text-sm text-right font-semibold ${isProfit ? 'text-teal' : 'text-danger'}`}>
        {isProfit ? '+' : ''}{unrealizedPnL.toFixed(2)}
      </td>
      <td className={`px-4 py-3 font-mono text-xs text-right ${isProfit ? 'text-teal' : 'text-danger'}`}>
        {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="danger" size="sm" onClick={closePosition} loading={placeOrder.isPending}>
          Close
        </Button>
      </td>
    </tr>
  )
}

export function PositionTable() {
  const { data: positions, isLoading } = usePositions()

  if (isLoading) {
    return <div className="px-4 py-6 text-sm text-muted">Loading positions…</div>
  }
  if (!positions?.length) {
    return <div className="px-4 py-8 text-center text-sm text-muted">No open positions</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {['Symbol', 'Side', 'Qty', 'Avg Entry', 'Current', 'P&L', 'P&L %', ''].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => <PositionRow key={p.id} position={p} />)}
        </tbody>
      </table>
    </div>
  )
}

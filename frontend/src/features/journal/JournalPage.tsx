import { useOrders } from '@hooks/useMarketData'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import { formatPrice, formatQty } from '@/lib/format'

export default function JournalPage() {
  const { data: orders, isLoading } = useOrders()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-white">Journal</h1>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Order History</h2>
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : !orders || orders.length === 0 ? (
          <p className="p-4 text-sm text-muted">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Fill</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2.5 text-muted">
                    {new Date(o.created_at).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-white">{o.symbol}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={o.side === 'buy' ? 'teal' : 'danger'}>{o.side.toUpperCase()}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{o.type}</td>
                  <td className="px-3 py-2.5 text-right tnum">{formatQty(o.quantity)}</td>
                  <td className="px-3 py-2.5 text-right tnum">
                    {o.fill_price != null ? formatPrice(o.symbol, o.fill_price) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={o.status === 'filled' ? 'gold' : 'muted'}>{o.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

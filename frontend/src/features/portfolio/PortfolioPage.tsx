import { PortfolioSummary } from '@components/portfolio/PortfolioSummary'
import { PositionTable } from '@components/trading/PositionTable'
import { EquityCurveChart } from '@components/charts/EquityCurveChart'
import { useOrderHistory } from '@hooks/usePortfolio'
import type { Order } from '@/types'

function OrderRow({ order }: { order: Order }) {
  const statusColor =
    order.status === 'filled'    ? 'text-teal' :
    order.status === 'cancelled' ? 'text-danger' : 'text-warning'

  return (
    <tr className="border-b border-border hover:bg-surface/50 transition-colors">
      <td className="px-4 py-3 font-mono text-sm text-white">{order.symbol}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-bold ${order.side === 'buy' ? 'text-teal' : 'text-danger'}`}>
          {order.side.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted capitalize">{order.type}</td>
      <td className="px-4 py-3 font-mono text-sm text-muted text-right">
        {Number(order.quantity).toLocaleString()}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-white text-right">
        {order.fill_price != null ? Number(order.fill_price).toFixed(5) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium capitalize ${statusColor}`}>{order.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(order.created_at).toLocaleString()}
      </td>
    </tr>
  )
}

export function PortfolioPage() {
  const { data: orders } = useOrderHistory()

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-white">Portfolio</h1>

      <PortfolioSummary />

      <EquityCurveChart />

      {/* Open positions */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Open Positions</h2>
        </div>
        <PositionTable />
      </div>

      {/* Order history */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Order History</h2>
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
              {orders?.map((o) => <OrderRow key={o.id} order={o} />) ?? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

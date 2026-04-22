import { useNavigate } from 'react-router-dom'
import { PortfolioSummary } from '@components/portfolio/PortfolioSummary'
import { useTick } from '@hooks/useTick'

const WATCHLIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'AUDUSD', 'USDCHF']

function WatchlistRow({ symbol }: { symbol: string }) {
  const navigate = useNavigate()
  const { tick, prevTick } = useTick(symbol)

  const dir = tick && prevTick
    ? (tick.mid > prevTick.mid ? 1 : tick.mid < prevTick.mid ? -1 : 0)
    : 0

  const priceColor = dir > 0 ? 'text-teal' : dir < 0 ? 'text-danger' : 'text-white'

  return (
    <tr
      onClick={() => navigate(`/trading/${symbol}`)}
      className="border-b border-border hover:bg-surface cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 font-mono text-sm font-semibold text-white">{symbol}</td>
      <td className={`px-4 py-3 font-mono text-sm text-right ${priceColor}`}>
        {tick?.bid.toFixed(5) ?? '—'}
      </td>
      <td className={`px-4 py-3 font-mono text-sm text-right ${priceColor}`}>
        {tick?.ask.toFixed(5) ?? '—'}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-right text-muted">
        {tick ? (tick.ask - tick.bid).toFixed(5) : '—'}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {dir > 0 && <span className="text-teal">▲</span>}
        {dir < 0 && <span className="text-danger">▼</span>}
      </td>
    </tr>
  )
}

export function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>

      <PortfolioSummary />

      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Watchlist</h2>
          <span className="text-xs text-muted">Click a row to trade</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Symbol', 'Bid', 'Ask', 'Spread', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide last:text-right"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WATCHLIST.map((s) => <WatchlistRow key={s} symbol={s} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

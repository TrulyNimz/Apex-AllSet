import { usePortfolio } from '@hooks/useMarketData'
import { Card } from '@components/ui/Card'
import { Stat } from '@components/ui/Stat'
import { Watchlist } from '@components/trading/Watchlist'
import { formatSignedUSD, formatUSD } from '@/lib/format'

export default function DashboardPage() {
  const { data: pf } = usePortfolio()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-white">Dashboard</h1>
        <p className="text-sm text-muted">Live markets and account overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Equity" value={pf ? formatUSD(pf.equity) : '—'} />
        <Stat label="Balance" value={pf ? formatUSD(pf.balance) : '—'} />
        <Stat
          label="Unrealized P&L"
          value={pf ? formatSignedUSD(pf.unrealized_pnl) : '—'}
          tone={pf && pf.unrealized_pnl < 0 ? 'danger' : 'teal'}
        />
        <Stat label="Open Positions" value={pf ? String(pf.open_positions) : '—'} />
      </div>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Watchlist</h2>
        </div>
        <Watchlist />
      </Card>
    </div>
  )
}

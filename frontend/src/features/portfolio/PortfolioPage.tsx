import { usePortfolio } from '@hooks/useMarketData'
import { Card } from '@components/ui/Card'
import { Stat } from '@components/ui/Stat'
import { PositionsTable } from '@components/trading/PositionsTable'
import { formatSignedUSD, formatUSD } from '@/lib/format'

export default function PortfolioPage() {
  const { data: pf } = usePortfolio()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl text-white">Portfolio</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Equity" value={pf ? formatUSD(pf.equity) : '—'} />
        <Stat label="Balance" value={pf ? formatUSD(pf.balance) : '—'} />
        <Stat
          label="Unrealized P&L"
          value={pf ? formatSignedUSD(pf.unrealized_pnl) : '—'}
          tone={pf && pf.unrealized_pnl < 0 ? 'danger' : 'teal'}
        />
        <Stat
          label="Realized P&L"
          value={pf ? formatSignedUSD(pf.realized_pnl) : '—'}
          tone={pf && pf.realized_pnl < 0 ? 'danger' : 'teal'}
        />
      </div>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Open Positions</h2>
        </div>
        <PositionsTable />
      </Card>
    </div>
  )
}

import { usePortfolioSummary } from '@hooks/usePortfolio'

export function PortfolioSummary() {
  const { data: p, isLoading } = usePortfolioSummary()

  if (isLoading || !p) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-panel border border-border rounded-xl p-4 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  const fmt = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const stats = [
    {
      label: 'Balance',
      value: fmt(p.balance),
      color: 'text-white',
    },
    {
      label: 'Equity',
      value: fmt(p.equity),
      color: 'text-white',
    },
    {
      label: 'Unrealized P&L',
      value: (p.unrealized_pnl >= 0 ? '+' : '') + fmt(p.unrealized_pnl),
      color: p.unrealized_pnl >= 0 ? 'text-teal' : 'text-danger',
    },
    {
      label: 'Realized P&L',
      value: (p.realized_pnl >= 0 ? '+' : '') + fmt(p.realized_pnl),
      color: p.realized_pnl >= 0 ? 'text-teal' : 'text-danger',
    },
    {
      label: 'Open Positions',
      value: String(p.open_positions),
      color: 'text-white',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="bg-panel border border-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-base font-mono font-semibold truncate ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

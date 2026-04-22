import { useParams } from 'react-router-dom'
import { PriceChart } from '@components/charts/PriceChart'
import { OrderPanel } from '@components/trading/OrderPanel'
import { PositionTable } from '@components/trading/PositionTable'
import { useTick } from '@hooks/useTick'

export function TradingPage() {
  const { symbol = 'EURUSD' } = useParams<{ symbol: string }>()
  const { tick } = useTick(symbol)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Symbol header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border shrink-0">
        <h1 className="font-mono font-bold text-white text-lg">{symbol}</h1>
        {tick ? (
          <>
            <span className="font-mono text-xl font-bold text-gold">{tick.mid.toFixed(5)}</span>
            <span className="font-mono text-xs text-muted hidden sm:block">
              {tick.bid.toFixed(5)} / {tick.ask.toFixed(5)}
            </span>
            <span className="font-mono text-xs text-muted hidden md:block">
              Spread {(tick.ask - tick.bid).toFixed(5)}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted animate-pulse">Connecting…</span>
        )}
      </div>

      {/* Chart + Order panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-4 min-w-0">
          <PriceChart symbol={symbol} />
        </div>
        <div className="w-72 p-4 border-l border-border shrink-0 overflow-y-auto">
          <OrderPanel symbol={symbol} />
        </div>
      </div>

      {/* Positions panel */}
      <div className="border-t border-border shrink-0">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Open Positions</h2>
        </div>
        <PositionTable />
      </div>
    </div>
  )
}

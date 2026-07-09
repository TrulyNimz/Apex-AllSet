import { useParams } from 'react-router-dom'
import { useCandles } from '@hooks/useMarketData'
import { useTick } from '@hooks/useTick'
import { Card } from '@components/ui/Card'
import { PriceChart } from '@components/charts/PriceChart'
import { OrderPanel } from '@components/trading/OrderPanel'
import { PositionsTable } from '@components/trading/PositionsTable'
import { formatPrice } from '@/lib/format'

export default function TradingPage() {
  const { symbol = 'EURUSD' } = useParams()
  const { data: candles } = useCandles(symbol)
  const { tick } = useTick(symbol)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-2xl text-white">{symbol}</h1>
        <span className="tnum text-lg text-gold">{formatPrice(symbol, tick?.mid)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="h-[440px] overflow-hidden">
          <PriceChart candles={candles ?? []} tick={tick} />
        </Card>
        <Card>
          <OrderPanel symbol={symbol} />
        </Card>
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

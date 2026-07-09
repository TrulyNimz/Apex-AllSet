import { useTick } from '@hooks/useTick'
import { formatPrice } from '@/lib/format'

interface Props {
  symbol: string
  field?: 'mid' | 'bid' | 'ask'
}

export function PriceCell({ symbol, field = 'mid' }: Props) {
  const { tick, prev } = useTick(symbol)
  const value = tick?.[field]
  const isUp = tick && prev ? tick.mid > prev.mid : false
  const isDown = tick && prev ? tick.mid < prev.mid : false

  return (
    <span className={`tnum ${isUp ? 'text-teal' : isDown ? 'text-danger' : 'text-white'}`}>
      {formatPrice(symbol, value)}
    </span>
  )
}

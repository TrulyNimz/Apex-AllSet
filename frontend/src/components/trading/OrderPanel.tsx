import { useState } from 'react'
import toast from 'react-hot-toast'
import { usePlaceOrder } from '@hooks/useMarketData'
import { useTick } from '@hooks/useTick'
import { apiError } from '@/lib/api-client'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { formatPrice } from '@/lib/format'
import type { OrderSide } from '@/types'

export function OrderPanel({ symbol }: { symbol: string }) {
  const [quantity, setQuantity] = useState('1000')
  const { tick } = useTick(symbol)
  const place = usePlaceOrder()

  async function submit(side: OrderSide) {
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    try {
      await place.mutateAsync({ symbol, side, type: 'market', quantity: qty })
      toast.success(`Order placed — ${side.toUpperCase()} ${qty} ${symbol}`)
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Bid</div>
          <div className="tnum text-lg text-danger">{formatPrice(symbol, tick?.bid)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Ask</div>
          <div className="tnum text-lg text-teal">{formatPrice(symbol, tick?.ask)}</div>
        </div>
      </div>

      <Input
        label="Quantity"
        placeholder="Quantity"
        inputMode="decimal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="buy" loading={place.isPending} onClick={() => submit('buy')}>
          Buy
        </Button>
        <Button variant="sell" loading={place.isPending} onClick={() => submit('sell')}>
          Sell
        </Button>
      </div>
      <p className="text-center text-xs text-muted">Market order · paper trading</p>
    </div>
  )
}

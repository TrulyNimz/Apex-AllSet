import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useTick } from '@hooks/useTick'
import { usePlaceOrder } from '@hooks/useOrders'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'

const schema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Enter a number' })
    .positive('Must be positive'),
})

type FormValues = z.infer<typeof schema>

interface OrderPanelProps {
  symbol: string
}

export function OrderPanel({ symbol }: OrderPanelProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const { tick }   = useTick(symbol)
  const placeOrder = usePlaceOrder()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1000 },
  })

  const onSubmit = async ({ quantity }: FormValues) => {
    await placeOrder.mutateAsync({ symbol, side, type: 'market', quantity })
    toast.success(`${side.toUpperCase()} ${quantity.toLocaleString()} ${symbol} — filled`)
    reset()
  }

  const displayPrice = side === 'buy' ? tick?.ask : tick?.bid

  return (
    <div className="bg-panel border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white">Place Order</h3>

      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide('buy')}
          className={`py-2 rounded-lg text-sm font-bold transition-colors
            ${side === 'buy'
              ? 'bg-teal text-black'
              : 'bg-surface text-muted border border-border hover:text-white'
            }`}
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => setSide('sell')}
          className={`py-2 rounded-lg text-sm font-bold transition-colors
            ${side === 'sell'
              ? 'bg-danger text-white'
              : 'bg-surface text-muted border border-border hover:text-white'
            }`}
        >
          SELL
        </button>
      </div>

      {/* Price display */}
      <div className="bg-surface rounded-lg px-4 py-3 text-center">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">
          {side === 'buy' ? 'Ask' : 'Bid'}
        </p>
        <p className={`text-2xl font-mono font-bold ${side === 'buy' ? 'text-teal' : 'text-danger'}`}>
          {displayPrice?.toFixed(5) ?? '—'}
        </p>
        {tick && (
          <p className="text-xs text-muted mt-1 font-mono">
            Spread {(tick.ask - tick.bid).toFixed(5)}
          </p>
        )}
      </div>

      {/* Order type */}
      <div className="flex items-center gap-2">
        <Badge variant="gold">Market</Badge>
        <span className="text-xs text-muted">Instant fill at current price</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Quantity (units)"
          type="number"
          step="100"
          min="0"
          placeholder="1000"
          error={errors.quantity?.message}
          {...register('quantity', { valueAsNumber: true })}
        />

        <Button
          type="submit"
          variant={side === 'buy' ? 'primary' : 'danger'}
          className="w-full"
          loading={placeOrder.isPending}
        >
          {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
        </Button>
      </form>
    </div>
  )
}

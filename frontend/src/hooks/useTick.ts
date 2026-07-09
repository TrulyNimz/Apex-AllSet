import { useEffect } from 'react'
import { wsClient } from '@/lib/ws-client'
import { useMarketStore } from '@store/market.store'

/** Subscribes to live ticks for a symbol and returns the latest + previous tick. */
export function useTick(symbol: string | undefined) {
  const setTick = useMarketStore((s) => s.setTick)
  const tick = useMarketStore((s) => (symbol ? s.ticks[symbol] : undefined))
  const prev = useMarketStore((s) => (symbol ? s.prev[symbol] : undefined))

  useEffect(() => {
    if (!symbol) return
    return wsClient.subscribe(symbol, setTick)
  }, [symbol, setTick])

  return { tick, prev }
}

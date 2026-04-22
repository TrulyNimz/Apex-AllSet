import { useEffect } from 'react'
import { wsClient } from '@/lib/ws-client'
import { useMarketStore } from '@store/market.store'
import type { Tick } from '@/types'

export function useTick(symbol: string) {
  const setTick  = useMarketStore((s) => s.setTick)
  const tick     = useMarketStore((s) => s.ticks[symbol])
  const prevTick = useMarketStore((s) => s.prevTicks[symbol])

  useEffect(() => {
    const unsubscribe = wsClient.subscribe(symbol, (data: Tick) => {
      setTick(symbol, data)
    })
    return unsubscribe
  }, [symbol, setTick])

  return { tick, prevTick }
}

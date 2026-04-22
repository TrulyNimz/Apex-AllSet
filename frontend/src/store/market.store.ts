import { create } from 'zustand'
import type { Tick } from '@/types'

interface MarketState {
  ticks:     Record<string, Tick>
  prevTicks: Record<string, Tick>
  setTick:   (symbol: string, tick: Tick) => void
}

export const useMarketStore = create<MarketState>()((set) => ({
  ticks:     {},
  prevTicks: {},

  setTick: (symbol, tick) =>
    set((state) => ({
      prevTicks: { ...state.prevTicks, [symbol]: state.ticks[symbol] ?? tick },
      ticks:     { ...state.ticks,     [symbol]: tick },
    })),
}))

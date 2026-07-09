import { create } from 'zustand'
import type { Tick } from '@/types'

interface MarketState {
  ticks: Record<string, Tick>
  prev: Record<string, Tick>
  setTick: (tick: Tick) => void
}

/**
 * In-memory live price state fed by the WebSocket. Keeps the previous tick per
 * symbol so cells can flash green/red on direction changes.
 */
export const useMarketStore = create<MarketState>((set, get) => ({
  ticks: {},
  prev: {},
  setTick: (tick) => {
    const current = get().ticks[tick.symbol]
    set((state) => ({
      ticks: { ...state.ticks, [tick.symbol]: tick },
      prev: current ? { ...state.prev, [tick.symbol]: current } : state.prev,
    }))
  },
}))

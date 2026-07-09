import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle, Tick } from '@/types'

interface Props {
  candles: Candle[]
  tick?: Tick
}

/** Bucket a millisecond timestamp into the 1-minute bar it belongs to (UTC seconds). */
function minuteBucket(ms: number): UTCTimestamp {
  return (Math.floor(ms / 1000 / 60) * 60) as UTCTimestamp
}

export function PriceChart({ candles, tick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<CandlestickData | null>(null)

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#8a94a6',
        fontFamily: 'DM Mono, monospace',
      },
      grid: {
        vertLines: { color: '#1e2530' },
        horzLines: { color: '#1e2530' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e2530' },
      timeScale: { borderColor: '#1e2530', timeVisible: true, secondsVisible: false },
    })
    const series = chart.addCandlestickSeries({
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderVisible: false,
      wickUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
    })
    chartRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Load historical candles.
  useEffect(() => {
    if (!seriesRef.current) return
    const data: CandlestickData[] = candles.map((c) => ({
      time: minuteBucket(new Date(c.open_time).getTime()),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    seriesRef.current.setData(data)
    lastBarRef.current = data.at(-1) ?? null
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  // Fold live ticks into the forming bar (or start a new one on minute rollover).
  useEffect(() => {
    if (!seriesRef.current || !tick) return
    const time = minuteBucket(tick.timestamp)
    const last = lastBarRef.current

    let bar: CandlestickData
    if (last && (last.time as number) === (time as number)) {
      bar = {
        time,
        open: last.open,
        high: Math.max(last.high, tick.mid),
        low: Math.min(last.low, tick.mid),
        close: tick.mid,
      }
    } else if (!last || (time as number) > (last.time as number)) {
      bar = { time, open: tick.mid, high: tick.mid, low: tick.mid, close: tick.mid }
    } else {
      return
    }
    seriesRef.current.update(bar)
    lastBarRef.current = bar
  }, [tick])

  return <div ref={containerRef} className="h-full w-full" />
}

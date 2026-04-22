import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useTick } from '@hooks/useTick'
import { marketService } from '@services/market.service'

interface PriceChartProps {
  symbol: string
}

export function PriceChart({ symbol }: PriceChartProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const chartRef        = useRef<IChartApi | null>(null)
  const seriesRef       = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const currentRef      = useRef<CandlestickData<UTCTimestamp> | null>(null)
  const historyLoadedRef = useRef<string>('')

  const { tick } = useTick(symbol)

  // Fetch OHLCV history
  const { data: candleRes } = useQuery({
    queryKey:  ['candles', symbol],
    queryFn:   () => marketService.getCandles(symbol, '1m', 500),
    staleTime: 0,
  })

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0f1117' },
        textColor:  '#6b7280',
      },
      grid: {
        vertLines: { color: '#1e2330' },
        horzLines: { color: '#1e2330' },
      },
      crosshair:       { mode: 1 },
      rightPriceScale: { borderColor: '#1e2330' },
      timeScale: {
        borderColor:    '#1e2330',
        timeVisible:    true,
        secondsVisible: false,
      },
      width:  containerRef.current.clientWidth,
      height: 380,
    })

    const series = chart.addCandlestickSeries({
      upColor:          '#00d4aa',
      downColor:        '#ff4757',
      borderUpColor:    '#00d4aa',
      borderDownColor:  '#ff4757',
      wickUpColor:      '#00d4aa',
      wickDownColor:    '#ff4757',
    })

    chartRef.current  = chart
    seriesRef.current = series

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [])

  // Load historical candles when data arrives or symbol changes
  useEffect(() => {
    if (!seriesRef.current || !candleRes?.data) return
    if (historyLoadedRef.current === symbol) return

    const candles: CandlestickData<UTCTimestamp>[] = candleRes.data.map((c) => ({
      time:  (new Date(c.open_time).getTime() / 1000) as UTCTimestamp,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }))

    if (candles.length > 0) {
      seriesRef.current.setData(candles)
      chartRef.current?.timeScale().scrollToRealTime()
      historyLoadedRef.current = symbol
      // Seed currentRef from last candle so live ticks know the current minute
      currentRef.current = candles[candles.length - 1]
    }
  }, [candleRes, symbol])

  // Reset on symbol change
  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData([])
    currentRef.current       = null
    historyLoadedRef.current = ''
  }, [symbol])

  // Merge live ticks into the current candle
  useEffect(() => {
    if (!tick || !seriesRef.current) return

    const candleTime = (Math.floor(tick.timestamp / 60_000) * 60) as UTCTimestamp
    const prev = currentRef.current

    if (!prev || prev.time !== candleTime) {
      // New minute — start a fresh candle
      const newCandle: CandlestickData<UTCTimestamp> = {
        time:  candleTime,
        open:  tick.mid,
        high:  tick.mid,
        low:   tick.mid,
        close: tick.mid,
      }
      currentRef.current = newCandle
    } else {
      // Update existing candle
      currentRef.current = {
        ...prev,
        high:  Math.max(prev.high,  tick.mid),
        low:   Math.min(prev.low,   tick.mid),
        close: tick.mid,
      }
    }

    seriesRef.current.update(currentRef.current)
  }, [tick])

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-white">{symbol}</span>
        {tick && (
          <>
            <span className="font-mono text-sm text-gold">{tick.mid.toFixed(5)}</span>
            <span className="text-xs text-muted font-mono">1m</span>
          </>
        )}
      </div>
      <div ref={containerRef} />
    </div>
  )
}

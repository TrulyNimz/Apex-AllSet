import { useNavigate } from 'react-router-dom'
import { useInstruments } from '@hooks/useMarketData'
import { PriceCell } from './PriceCell'
import { Spinner } from '@components/ui/Spinner'

export function Watchlist() {
  const navigate = useNavigate()
  const { data: instruments, isLoading } = useInstruments()

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted">
          <th className="px-3 py-2 font-medium">Symbol</th>
          <th className="px-3 py-2 text-right font-medium">Bid</th>
          <th className="px-3 py-2 text-right font-medium">Ask</th>
          <th className="px-3 py-2 text-right font-medium">Mid</th>
        </tr>
      </thead>
      <tbody>
        {instruments?.map((ins) => (
          <tr
            key={ins.symbol}
            onClick={() => navigate(`/trading/${ins.symbol}`)}
            className="cursor-pointer border-t border-border hover:bg-panel"
          >
            <td className="px-3 py-2.5 font-medium text-white">{ins.symbol}</td>
            <td className="px-3 py-2.5 text-right">
              <PriceCell symbol={ins.symbol} field="bid" />
            </td>
            <td className="px-3 py-2.5 text-right">
              <PriceCell symbol={ins.symbol} field="ask" />
            </td>
            <td className="px-3 py-2.5 text-right">
              <PriceCell symbol={ins.symbol} field="mid" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

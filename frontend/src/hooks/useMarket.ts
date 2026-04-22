import { useQuery } from '@tanstack/react-query'
import { marketService } from '@services/market.service'

export function useInstruments() {
  return useQuery({
    queryKey: ['instruments'],
    queryFn:  () => marketService.getInstruments().then((r) => r.data),
    staleTime: 60 * 60 * 1000, // instruments rarely change
  })
}

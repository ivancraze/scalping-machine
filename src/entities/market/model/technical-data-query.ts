import { useQuery } from '@tanstack/react-query';
import { getCandles, getOpenInterest } from '../api/binance';
import { natrFromCandles } from '../lib/natr';
import { marketQueryKeys } from './query-keys';

const NATR_INTERVAL = '5m';
const NATR_PERIOD = 14;
const NATR_CANDLE_LIMIT = 100;

export function useNatrQuery(symbol: string) {
  return useQuery({
    queryKey: marketQueryKeys.natr(symbol, NATR_INTERVAL, NATR_PERIOD),
    queryFn: ({ signal }) =>
      getCandles(symbol, NATR_INTERVAL, { limit: NATR_CANDLE_LIMIT, signal }).then((candles) =>
        natrFromCandles(candles, NATR_PERIOD),
      ),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
  });
}

export function useOpenInterestQuery(symbol: string) {
  return useQuery({
    queryKey: marketQueryKeys.openInterest(symbol),
    queryFn: ({ signal }) => getOpenInterest(symbol, signal),
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

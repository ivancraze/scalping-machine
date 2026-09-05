import { useEffect } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAggregateTrades, getCandles } from '../api/binance';
import { subscribeAggregateTrades, subscribeKline } from '../api/binance-streams';
import { aggregateSecondTrades, updateSecondCandle } from '../lib/second-candles';
import type { Candle } from './candle';
import { marketQueryKeys } from './query-keys';

const CANDLE_PAGE_SIZE = 1000;
const CANDLE_MAX_PAGES = 10;

type CandlePageParam =
  | { direction: 'initial' }
  | { direction: 'older'; endTime: number }
  | { direction: 'newer'; startTime: number };

export type CandlePage = {
  candles: Candle[];
  reachesOlderEnd: boolean;
  reachesNewerEnd: boolean;
};

async function getCandlePage(
  symbol: string,
  interval: string,
  pageParam: CandlePageParam,
  signal: AbortSignal,
): Promise<CandlePage> {
  const candles = await getCandles(symbol, interval, {
    limit: CANDLE_PAGE_SIZE,
    endTime: pageParam.direction === 'older' ? pageParam.endTime : undefined,
    startTime: pageParam.direction === 'newer' ? pageParam.startTime : undefined,
    signal,
  });
  return {
    candles,
    reachesOlderEnd: pageParam.direction !== 'newer' && candles.length < CANDLE_PAGE_SIZE,
    reachesNewerEnd:
      pageParam.direction === 'initial' ||
      (pageParam.direction === 'newer' && candles.length < CANDLE_PAGE_SIZE),
  };
}

export function useCandleHistoryQuery(symbol: string, interval: string) {
  return useInfiniteQuery({
    queryKey: marketQueryKeys.candleHistory(symbol, interval),
    queryFn: ({ pageParam, signal }) => getCandlePage(symbol, interval, pageParam, signal),
    initialPageParam: { direction: 'initial' } as CandlePageParam,
    getNextPageParam: (lastPage): CandlePageParam | undefined => {
      const firstCandle = lastPage.candles[0];
      if (lastPage.reachesOlderEnd || !firstCandle) return undefined;
      return { direction: 'older', endTime: firstCandle[0] - 1 };
    },
    getPreviousPageParam: (firstPage): CandlePageParam | undefined => {
      const lastCandle = firstPage.candles.at(-1);
      if (firstPage.reachesNewerEnd || !lastCandle) return undefined;
      return { direction: 'newer', startTime: lastCandle[0] + 1 };
    },
    maxPages: CANDLE_MAX_PAGES,
    staleTime: Infinity,
  });
}

export function useLatestCandlesQuery(symbol: string, interval: string, enabled = true) {
  return useQuery({
    queryKey: marketQueryKeys.latestCandles(symbol, interval),
    queryFn: ({ signal }) => getCandles(symbol, interval, { limit: 2, signal }),
    staleTime: Infinity,
    enabled,
  });
}

export function mergeLatestCandle(candles: Candle[] | undefined, candle: Candle): Candle[] {
  if (!candles || candles.length === 0) return [candle];
  const previous = candles.at(-1);
  if (!previous || candle[0] < previous[0]) return candles;
  if (candle[0] === previous[0]) return [...candles.slice(0, -1), candle];
  return [...candles, candle].slice(-2);
}

export function useLiveCandleSubscription(symbol: string, interval: string, enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const queryKey = marketQueryKeys.latestCandles(symbol, interval);
    const resync = () => {
      void queryClient
        .fetchQuery({ queryKey, queryFn: ({ signal }) => getCandles(symbol, interval, { limit: 2, signal }) })
        .catch(() => undefined);
    };
    return subscribeKline(
      symbol,
      interval,
      (candle) =>
        queryClient.setQueryData<Candle[]>(queryKey, (previous) => mergeLatestCandle(previous, candle)),
      resync,
    );
  }, [enabled, interval, queryClient, symbol]);
}

export function useSecondCandlesQuery(symbol: string, secondsPerCandle: number | null) {
  const queryClient = useQueryClient();
  const enabled = secondsPerCandle !== null;
  const query = useQuery({
    queryKey: marketQueryKeys.secondCandles(symbol, secondsPerCandle ?? 1),
    queryFn: async ({ signal }) =>
      aggregateSecondTrades(await getAggregateTrades(symbol, signal), secondsPerCandle ?? 1),
    staleTime: Infinity,
    enabled,
  });
  useEffect(() => {
    if (!secondsPerCandle) return;
    const queryKey = marketQueryKeys.secondCandles(symbol, secondsPerCandle);
    const resync = () => {
      void queryClient
        .fetchQuery({
          queryKey,
          queryFn: ({ signal }) =>
            getAggregateTrades(symbol, signal).then((trades) =>
              aggregateSecondTrades(trades, secondsPerCandle),
            ),
        })
        .catch(() => undefined);
    };
    return subscribeAggregateTrades(
      symbol,
      (trade) =>
        queryClient.setQueryData<Candle[]>(queryKey, (previous) =>
          updateSecondCandle(previous ?? [], trade, secondsPerCandle),
        ),
      resync,
    );
  }, [queryClient, secondsPerCandle, symbol]);
  return query;
}

export function mergeCandlePages(pages: CandlePage[] | undefined): Candle[] {
  if (!pages) return [];
  const candlesByTime = new Map<number, Candle>();
  for (const page of pages) {
    for (const candle of page.candles) candlesByTime.set(candle[0], candle);
  }
  return [...candlesByTime.values()].sort((left, right) => left[0] - right[0]);
}

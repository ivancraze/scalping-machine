import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAggregateTrades, getCandles } from '../api/binance';
import { subscribeAggregateTrades, subscribeKline } from '../api/binance-streams';
import { runGridRequest } from '../api/grid-request-pool';
import { aggregateSecondTrades, updateSecondCandle } from '../lib/second-candles';
import type { Candle } from './candle';
import { marketQueryKeys } from './query-keys';

const CANDLE_PAGE_SIZE = 1000;
const CANDLE_MAX_PAGES = 10;
const GRID_CANDLE_LIMIT = 300;

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

export function useCandleHistoryQuery(symbol: string, interval: string, enabled = true) {
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
    enabled,
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

export function useGridCandlesQuery(symbol: string, interval: string, enabled = true) {
  return useQuery({
    queryKey: marketQueryKeys.gridCandles(symbol, interval),
    queryFn: ({ signal }) =>
      runGridRequest(signal, () => getCandles(symbol, interval, { limit: GRID_CANDLE_LIMIT, signal })),
    staleTime: 0,
    enabled,
  });
}

export function mergeGridCandles(...windows: Array<Candle[] | undefined>): Candle[] {
  const candlesByTime = new Map<number, Candle>();
  for (const window of windows) {
    for (const candle of window ?? []) candlesByTime.set(candle[0], candle);
  }
  return [...candlesByTime.values()].sort((left, right) => left[0] - right[0]).slice(-GRID_CANDLE_LIMIT);
}

export function updateGridCandleWindow(candles: Candle[] | undefined, candle: Candle): Candle[] {
  if (!candles?.length) return [candle];
  const previous = candles.at(-1);
  if (!previous || candle[0] < previous[0]) return candles;
  if (candle[0] === previous[0]) return [...candles.slice(0, -1), candle];
  return [...candles, candle].slice(-GRID_CANDLE_LIMIT);
}

export function useGridCandleSubscription(symbol: string, interval: string, enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const queryKey = marketQueryKeys.gridCandles(symbol, interval);
    let resyncCandles: Candle[] = [];
    let isResyncing = false;
    const resync = () => {
      const cachedBeforeResync = queryClient.getQueryData<Candle[]>(queryKey);
      isResyncing = true;
      resyncCandles = [];
      void queryClient
        .fetchQuery({
          queryKey,
          queryFn: ({ signal }) =>
            runGridRequest(signal, () => getCandles(symbol, interval, { limit: GRID_CANDLE_LIMIT, signal })),
          staleTime: 0,
        })
        .then((fetched) => {
          queryClient.setQueryData<Candle[]>(queryKey, (current) =>
            mergeGridCandles(cachedBeforeResync, fetched, current, resyncCandles),
          );
        })
        .catch(() => undefined)
        .finally(() => {
          isResyncing = false;
          resyncCandles = [];
        });
    };
    return subscribeKline(
      symbol,
      interval,
      (candle) => {
        if (isResyncing) resyncCandles = updateGridCandleWindow(resyncCandles, candle);
        queryClient.setQueryData<Candle[]>(queryKey, (current) => updateGridCandleWindow(current, candle));
      },
      resync,
    );
  }, [enabled, interval, queryClient, symbol]);
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
        .fetchQuery({
          queryKey,
          queryFn: ({ signal }) => getCandles(symbol, interval, { limit: 2, signal }),
          staleTime: 0,
        })
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

export type ClosedCandleWindow = {
  candles: Candle[];
  current: Candle | null;
};

async function getClosedCandleWindow(
  symbol: string,
  interval: string,
  historySize: number,
  signal: AbortSignal,
): Promise<ClosedCandleWindow> {
  const limit = Math.min(historySize + 1, 1500);
  const candles = await getCandles(symbol, interval, { limit, signal });
  const firstCandle = candles[0];
  const olderCandles =
    historySize >= 1500 && candles.length === 1500 && firstCandle
      ? await getCandles(symbol, interval, { limit: 1, endTime: firstCandle[0] - 1, signal })
      : [];
  return {
    candles: [...olderCandles, ...candles.slice(0, -1)].slice(-historySize),
    current: candles.at(-1) ?? null,
  };
}

export function useClosedCandleWindowQuery(
  symbol: string,
  interval: string,
  historySize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: marketQueryKeys.closedCandleWindow(symbol, interval, historySize),
    queryFn: ({ signal }) => getClosedCandleWindow(symbol, interval, historySize, signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled,
  });
}

function appendClosedCandle(candles: Candle[], candle: Candle, historySize: number) {
  const previous = candles.at(-1);
  if (!previous || candle[0] > previous[0]) return [...candles, candle].slice(-historySize);
  if (candle[0] === previous[0]) return [...candles.slice(0, -1), candle];
  return candles;
}

export function synchronizeClosedCandleWindow(
  fetched: ClosedCandleWindow,
  cached: ClosedCandleWindow | undefined,
  streamCandles: Candle[],
  historySize: number,
): ClosedCandleWindow {
  let current = fetched.current;
  if (cached?.current && (!current || cached.current[0] > current[0])) current = cached.current;
  for (const candle of streamCandles) {
    if (!current || candle[0] >= current[0]) current = candle;
  }
  const candlesByTime = new Map<number, Candle>();
  const addWindow = (window: ClosedCandleWindow | undefined) => {
    for (const candle of window?.candles ?? []) candlesByTime.set(candle[0], candle);
    if (window?.current && current && window.current[0] < current[0])
      candlesByTime.set(window.current[0], window.current);
  };
  addWindow(cached);
  addWindow(fetched);
  for (const candle of streamCandles) {
    if (current && candle[0] < current[0]) candlesByTime.set(candle[0], candle);
  }
  return {
    candles: [...candlesByTime.values()]
      .filter((candle) => !current || candle[0] < current[0])
      .sort((left, right) => left[0] - right[0])
      .slice(-historySize),
    current,
  };
}

export function useClosedCandleWindowSubscription(
  symbol: string,
  interval: string,
  historySize: number,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const currentCandleRef = useRef<Candle | null>(null);
  useEffect(() => {
    if (!enabled) {
      currentCandleRef.current = null;
      return;
    }
    const queryKey = marketQueryKeys.closedCandleWindow(symbol, interval, historySize);
    currentCandleRef.current = queryClient.getQueryData<ClosedCandleWindow>(queryKey)?.current ?? null;
    let resyncController: AbortController | null = null;
    let resyncGeneration = 0;
    let isResyncing = false;
    let resyncStreamCandles = new Map<number, Candle>();
    const resync = () => {
      resyncController?.abort();
      resyncController = new AbortController();
      resyncGeneration += 1;
      const generation = resyncGeneration;
      isResyncing = true;
      resyncStreamCandles = new Map();
      void getClosedCandleWindow(symbol, interval, historySize, resyncController.signal)
        .then((window) => {
          if (generation !== resyncGeneration) return;
          const synchronized = synchronizeClosedCandleWindow(
            window,
            queryClient.getQueryData<ClosedCandleWindow>(queryKey),
            [...resyncStreamCandles.values()],
            historySize,
          );
          queryClient.setQueryData<ClosedCandleWindow>(queryKey, synchronized);
          if (
            !currentCandleRef.current ||
            (synchronized.current && synchronized.current[0] >= currentCandleRef.current[0])
          )
            currentCandleRef.current = synchronized.current;
        })
        .catch(() => undefined)
        .finally(() => {
          if (generation === resyncGeneration) isResyncing = false;
        });
    };
    const unsubscribe = subscribeKline(
      symbol,
      interval,
      (candle) => {
        if (isResyncing) resyncStreamCandles.set(candle[0], candle);
        const previousCurrent =
          currentCandleRef.current ?? queryClient.getQueryData<ClosedCandleWindow>(queryKey)?.current;
        if (!previousCurrent || candle[0] === previousCurrent[0]) {
          currentCandleRef.current = candle;
          return;
        }
        if (candle[0] < previousCurrent[0]) return;
        currentCandleRef.current = candle;
        queryClient.setQueryData<ClosedCandleWindow>(queryKey, (previous) => ({
          candles: appendClosedCandle(previous?.candles ?? [], previousCurrent, historySize),
          current: candle,
        }));
      },
      resync,
    );
    return () => {
      resyncController?.abort();
      unsubscribe();
    };
  }, [enabled, historySize, interval, queryClient, symbol]);
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

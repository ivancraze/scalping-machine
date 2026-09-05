import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCandles, getOpenInterest } from '../api/binance';
import { natrFromCandles } from '../lib/natr';
import { marketQueryKeys } from './query-keys';

const NATR_INTERVAL = '5m';
const NATR_PERIOD = 14;
const NATR_CANDLE_LIMIT = 100;
const NATR_CONCURRENCY = 5;
const NATR_STALE_TIME = 5 * 60_000;

export function useNatrQuery(symbol: string) {
  return useQuery({ ...natrQueryOptions(symbol), enabled: Boolean(symbol) });
}

export function useNatrsQuery(symbols: string[], enabled: boolean) {
  const queryClient = useQueryClient();
  const querySymbols = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: marketQueryKeys.natrs(querySymbols, NATR_INTERVAL, NATR_PERIOD),
    queryFn: async ({ signal }): Promise<Record<string, number>> => {
      const items = await mapWithConcurrency(
        querySymbols,
        NATR_CONCURRENCY,
        async (symbol, requestSignal) => {
          const cached = getCachedNatr(queryClient, symbol);
          if (cached.found) return [symbol, cached.value] as const;
          const natr = await getNatr(symbol, requestSignal);
          queryClient.setQueryData(marketQueryKeys.natr(symbol, NATR_INTERVAL, NATR_PERIOD), natr);
          return [symbol, natr] as const;
        },
        signal,
      );
      return Object.fromEntries(items.filter((item): item is [string, number] => item[1] !== null));
    },
    enabled,
    staleTime: NATR_STALE_TIME,
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

function natrQueryOptions(symbol: string) {
  return {
    queryKey: marketQueryKeys.natr(symbol, NATR_INTERVAL, NATR_PERIOD),
    queryFn: ({ signal }: { signal: AbortSignal }) => getNatr(symbol, signal),
    staleTime: NATR_STALE_TIME,
  };
}

function getNatr(symbol: string, signal: AbortSignal) {
  return getCandles(symbol, NATR_INTERVAL, { limit: NATR_CANDLE_LIMIT, signal }).then((candles) =>
    natrFromCandles(candles, NATR_PERIOD),
  );
}

function getCachedNatr(queryClient: ReturnType<typeof useQueryClient>, symbol: string) {
  const state = queryClient.getQueryState<number | null>(
    marketQueryKeys.natr(symbol, NATR_INTERVAL, NATR_PERIOD),
  );
  if (
    state?.data === undefined ||
    Date.now() - state.dataUpdatedAt >= NATR_STALE_TIME ||
    (!Number.isFinite(state.data) && state.data !== null)
  )
    return { found: false as const };
  return { found: true as const, value: state.data };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, signal: AbortSignal) => Promise<R>,
  signal: AbortSignal,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const controller = new AbortController();
  const requestSignal = AbortSignal.any([signal, controller.signal]);
  const worker = async () => {
    while (nextIndex < items.length) {
      requestSignal.throwIfAborted();
      const index = nextIndex++;
      try {
        results[index] = await mapper(items[index], requestSignal);
      } catch (error) {
        controller.abort();
        throw error;
      }
    }
  };
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getInstruments, getMarket } from '../api/binance';
import { subscribeMarketTickers } from '../api/binance-streams';
import type { MarketRow, MarketTickerUpdate } from './market';
import { marketQueryKeys } from './query-keys';

const EMPTY_MARKET: MarketRow[] = [];

const instrumentsQueryOptions = () => ({
  queryKey: marketQueryKeys.instruments(),
  queryFn: ({ signal }: { signal: AbortSignal }) => getInstruments(signal),
  staleTime: 5 * 60_000,
  retry: false,
});

const marketQueryOptions = (queryClient: QueryClient) => ({
  queryKey: marketQueryKeys.ticker(),
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const instruments = await queryClient.fetchQuery(instrumentsQueryOptions());
    return getMarket(instruments, signal);
  },
  refetchInterval: 30_000,
  staleTime: 30_000,
});

function mergeMarketTickerUpdates(
  previous: MarketRow[] | undefined,
  updates: Map<string, MarketTickerUpdate>,
) {
  return (previous ?? EMPTY_MARKET).map((row) => {
    const update = updates.get(row.symbol);
    return update ? { ...row, ...update } : row;
  });
}

function useLiveMarketSubscription() {
  const queryClient = useQueryClient();
  const updatesRef = useRef(new Map<string, MarketTickerUpdate>());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const flush = () => {
      frameRef.current = null;
      const updates = updatesRef.current;
      updatesRef.current = new Map();
      if (updates.size === 0) return;
      queryClient.setQueryData<MarketRow[]>(marketQueryKeys.ticker(), (previous) =>
        mergeMarketTickerUpdates(previous, updates),
      );
    };
    const unsubscribe = subscribeMarketTickers(
      (updates) => {
        for (const update of updates) updatesRef.current.set(update.symbol, update);
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: marketQueryKeys.ticker() });
      },
    );
    return () => {
      unsubscribe();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      updatesRef.current.clear();
    };
  }, [queryClient]);
}

export function useMarketQuery() {
  const queryClient = useQueryClient();
  useLiveMarketSubscription();
  return useQuery(marketQueryOptions(queryClient));
}

export { mergeMarketTickerUpdates };

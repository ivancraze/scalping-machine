import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getCandles } from '../api/binance';
import { correlationFromCandles } from '../lib/correlation';
import { marketQueryKeys } from './query-keys';

const CORRELATION_HOURS = 24;
const CORRELATION_CANDLE_LIMIT = CORRELATION_HOURS + 1;
const CORRELATION_CONCURRENCY = 5;
const CORRELATION_STALE_TIME = 5 * 60_000;

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function useCorrelationsQuery(symbols: string[], enabled: boolean) {
  const queryClient = useQueryClient();
  const comparedSymbols = [...new Set(symbols)].filter((symbol) => symbol !== 'BTCUSDT');
  const querySymbols = ['BTCUSDT', ...comparedSymbols].sort();
  return useQuery({
    queryKey: marketQueryKeys.correlations(querySymbols),
    queryFn: async (): Promise<Record<string, number>> => {
      const items = await mapWithConcurrency(comparedSymbols, CORRELATION_CONCURRENCY, async (symbol) => {
        const correlation = await queryClient.fetchQuery(correlationToBtcQueryOptions(symbol, queryClient));
        return [symbol, correlation] as const;
      });
      return {
        BTCUSDT: 1,
        ...Object.fromEntries(items.filter((item): item is [string, number] => item[1] !== null)),
      };
    },
    enabled,
    staleTime: CORRELATION_STALE_TIME,
  });
}

export function useCorrelationToBtcQuery(symbol: string, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({ ...correlationToBtcQueryOptions(symbol, queryClient), enabled });
}

function correlationToBtcQueryOptions(symbol: string, queryClient: QueryClient) {
  return {
    queryKey: marketQueryKeys.correlation(symbol),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (symbol === 'BTCUSDT') return 1;
      const endTime = Math.floor(Date.now() / 3_600_000) * 3_600_000 - 1;
      const bitcoin = await queryClient.fetchQuery({
        queryKey: marketQueryKeys.correlationCandles('BTCUSDT', endTime),
        queryFn: ({ signal: bitcoinSignal }: { signal: AbortSignal }) =>
          getCandles('BTCUSDT', '1h', {
            limit: CORRELATION_CANDLE_LIMIT,
            endTime,
            signal: bitcoinSignal,
          }),
        staleTime: CORRELATION_STALE_TIME,
      });
      const history = await getCandles(symbol, '1h', { limit: CORRELATION_CANDLE_LIMIT, endTime, signal });
      return correlationFromCandles(history, bitcoin);
    },
    staleTime: CORRELATION_STALE_TIME,
  };
}

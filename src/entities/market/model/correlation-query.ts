import { useQuery } from '@tanstack/react-query';
import { getCandles } from '../api/binance';
import { correlationFromCandles } from '../lib/correlation';
import { marketQueryKeys } from './query-keys';

const CORRELATION_HOURS = 24;
const CORRELATION_CANDLE_LIMIT = CORRELATION_HOURS + 1;
const CORRELATION_CONCURRENCY = 5;

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
  const comparedSymbols = [...new Set(symbols)].filter((symbol) => symbol !== 'BTCUSDT');
  const querySymbols = ['BTCUSDT', ...comparedSymbols].sort();
  return useQuery({
    queryKey: marketQueryKeys.correlations(querySymbols),
    queryFn: async ({ signal }): Promise<Record<string, number>> => {
      const endTime = Math.floor(Date.now() / 3_600_000) * 3_600_000 - 1;
      const bitcoin = await getCandles('BTCUSDT', '1h', { limit: CORRELATION_CANDLE_LIMIT, endTime, signal });
      const items = await mapWithConcurrency(comparedSymbols, CORRELATION_CONCURRENCY, async (symbol) => {
        const history = await getCandles(symbol, '1h', { limit: CORRELATION_CANDLE_LIMIT, endTime, signal });
        return [symbol, correlationFromCandles(history, bitcoin)] as const;
      });
      return {
        BTCUSDT: 1,
        ...Object.fromEntries(items.filter((item): item is [string, number] => item[1] !== null)),
      };
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

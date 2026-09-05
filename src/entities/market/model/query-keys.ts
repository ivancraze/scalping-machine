export const marketQueryKeys = {
  all: ['market'] as const,
  instruments: () => [...marketQueryKeys.all, 'instruments'] as const,
  ticker: () => [...marketQueryKeys.all, 'ticker'] as const,
  candleHistory: (symbol: string, interval: string) =>
    [...marketQueryKeys.all, 'candles', 'history', symbol, interval] as const,
  latestCandles: (symbol: string, interval: string) =>
    [...marketQueryKeys.all, 'candles', 'latest', symbol, interval] as const,
  secondCandles: (symbol: string, secondsPerCandle: number) =>
    [...marketQueryKeys.all, 'candles', 'seconds', symbol, secondsPerCandle] as const,
  correlations: (symbols: string[]) => [...marketQueryKeys.all, 'correlations', '1h', symbols] as const,
};

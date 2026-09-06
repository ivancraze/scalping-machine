export const marketQueryKeys = {
  all: ['market'] as const,
  instruments: () => [...marketQueryKeys.all, 'instruments'] as const,
  ticker: () => [...marketQueryKeys.all, 'ticker'] as const,
  candleHistory: (symbol: string, interval: string) =>
    [...marketQueryKeys.all, 'candles', 'history', symbol, interval] as const,
  latestCandles: (symbol: string, interval: string) =>
    [...marketQueryKeys.all, 'candles', 'latest', symbol, interval] as const,
  closedCandleWindow: (symbol: string, interval: string, historySize: number) =>
    [...marketQueryKeys.all, 'candles', 'closed-window', symbol, interval, historySize] as const,
  secondCandles: (symbol: string, secondsPerCandle: number) =>
    [...marketQueryKeys.all, 'candles', 'seconds', symbol, secondsPerCandle] as const,
  correlations: (symbols: string[]) => [...marketQueryKeys.all, 'correlations', '1h', symbols] as const,
  correlation: (symbol: string) => [...marketQueryKeys.all, 'correlation', '1h', symbol] as const,
  correlationCandles: (symbol: string, endTime: number) =>
    [...marketQueryKeys.all, 'correlation-candles', '1h', symbol, endTime] as const,
  natr: (symbol: string, interval: string, period: number) =>
    [...marketQueryKeys.all, 'natr', symbol, interval, period] as const,
  natrs: (symbols: string[], interval: string, period: number) =>
    [...marketQueryKeys.all, 'natrs', interval, period, symbols] as const,
  openInterest: (symbol: string) => [...marketQueryKeys.all, 'open-interest', symbol] as const,
  openInterestHistory: (symbol: string, period: string) =>
    [...marketQueryKeys.all, 'open-interest-history', symbol, period] as const,
};

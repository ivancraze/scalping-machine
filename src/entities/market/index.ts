export type { AlertRule, Candle, DepthLevel, MarketRow } from './model/types';
export {
  depthQueryOptions,
  marketQueryKeys,
  mergeCandlePages,
  useCandleHistoryQuery,
  useLiveCandleSubscription,
  useLatestCandlesQuery,
  useCorrelationsQuery,
  useMarketQuery,
  useSecondCandlesQuery,
} from './api/queries';
export { isBinanceTickerUpdate, type BinanceTickerUpdate } from './api/binance-streams';
export { correlationFromCandles, pearson, returnsFrom } from './lib/correlation';

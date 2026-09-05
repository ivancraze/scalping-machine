export type SortKey = 'change' | 'losers' | 'trades' | 'natr' | 'volume';
export type Candle = [number, string, string, string, string, string];
export type MarketRow = {
  symbol: string;
  priceTickSize: string;
  price: number;
  change: number;
  range: number;
  natr: number;
  trades: number;
  volume: number;
};
export type AlertRule = {
  id: string;
  symbol: string;
  condition: string;
  value: string;
  delivery: string;
  enabled: boolean;
};
export type DepthLevel = { price: number; quantity: number; notional: number; side: 'bid' | 'ask' };

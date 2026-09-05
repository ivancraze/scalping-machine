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

export type MarketTrade = { timestamp: number; price: string; quantity: string };

export type MarketTickerUpdate = Omit<MarketRow, 'symbol' | 'priceTickSize'> & { symbol: string };

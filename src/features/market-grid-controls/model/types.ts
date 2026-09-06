export type MarketGridMode = 'scroll' | 'pages';
export type MarketGridColumns = 2 | 3 | 4;
export type MarketGridTimeframe = '1м' | '5м' | '15м' | '1ч' | '4ч' | '1д';
export type MarketGridView = 'all' | 'favorites' | 'gainers' | 'losers' | 'active';

export type MarketGridFilters = {
  minVolume: number | null;
  minTrades: number | null;
  minChange: number | null;
  maxChange: number | null;
};

export type MarketGridSettings = {
  columns: MarketGridColumns;
  mode: MarketGridMode;
  timeframe: MarketGridTimeframe;
  view: MarketGridView;
  volumeVisible: boolean;
  openInterestVisible: boolean;
  filters: MarketGridFilters;
  symbolTimeframes: Record<string, MarketGridTimeframe>;
};

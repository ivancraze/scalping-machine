export type MarketGridMode = 'scroll' | 'pages';
export type MarketGridColumns = 2 | 3 | 4;
export type MarketGridTimeframe = '1м' | '3м' | '5м' | '15м' | '30м' | '1ч' | '4ч' | '1д';
export type MarketGridView = 'all' | 'favorites' | 'gainers' | 'losers' | 'active';
export type MarketGridSortField = 'volume' | 'change' | 'absoluteChange' | 'range' | 'trades' | 'natr';
export type MarketGridSortDirection = 'asc' | 'desc';
export type MarketGridTechnicalDataMode = 'compact' | 'detailed';

export type MarketGridFilters = {
  minVolume: number | null;
  maxVolume: number | null;
  minTrades: number | null;
  maxTrades: number | null;
  minChange: number | null;
  maxChange: number | null;
  minRange: number | null;
  maxRange: number | null;
  minNatr: number | null;
  maxNatr: number | null;
};

export type MarketGridPreset = {
  id: string;
  name: string;
  view: MarketGridView;
  filters: MarketGridFilters;
  sortField: MarketGridSortField;
  sortDirection: MarketGridSortDirection;
  limit: number;
  timeframe: MarketGridTimeframe;
  blacklist: string[];
};

export type MarketGridSettings = {
  columns: MarketGridColumns;
  mode: MarketGridMode;
  timeframe: MarketGridTimeframe;
  view: MarketGridView;
  volumeVisible: boolean;
  openInterestVisible: boolean;
  scaleLabelsVisible: boolean;
  technicalDataMode: MarketGridTechnicalDataMode;
  filters: MarketGridFilters;
  sortField: MarketGridSortField;
  sortDirection: MarketGridSortDirection;
  limit: number;
  blacklist: string[];
  presets: MarketGridPreset[];
  activePresetId: string | null;
  symbolTimeframes: Record<string, MarketGridTimeframe>;
};

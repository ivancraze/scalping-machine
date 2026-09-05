import type { MarketRow } from '../../../entities/market';

export type MarketListSortKey =
  'favorite' | 'symbol' | 'change' | 'volume' | 'trades' | 'natr' | 'natr5m14' | 'correlation';
export type MarketListSortState = { sorting: MarketListSortKey | null; sortDirection: 'asc' | 'desc' };
export type MarketListFilters = {
  volume: { min: number | null; max: number | null };
  change: { min: number | null; max: number | null };
  trades: { min: number | null; max: number | null };
  correlation: { min: number | null; max: number | null };
  natr: { min: number | null; max: number | null };
};
export type MarketListColumnKey = 'volume' | 'change' | 'trades' | 'correlation' | 'natr' | 'natr5m14';

export function createMarketListFilters(): MarketListFilters {
  return {
    volume: { min: null, max: null },
    change: { min: null, max: null },
    trades: { min: null, max: null },
    correlation: { min: null, max: null },
    natr: { min: null, max: null },
  };
}

export function createMarketListColumns(): MarketListColumnKey[] {
  return ['volume', 'change', 'natr', 'natr5m14', 'correlation'];
}

export function nextMarketListSortState(
  { sorting, sortDirection }: MarketListSortState,
  key: MarketListSortKey,
): MarketListSortState {
  const initialDirection = key === 'symbol' ? 'asc' : 'desc';
  if (sorting !== key) return { sorting: key, sortDirection: initialDirection };
  if (sortDirection === initialDirection)
    return { sorting: key, sortDirection: initialDirection === 'asc' ? 'desc' : 'asc' };
  return { sorting: null, sortDirection };
}

export function selectCorrelationSymbols(market: MarketRow[], minVolume: number) {
  return market
    .filter((row) => row.volume >= minVolume)
    .map((row) => row.symbol)
    .sort();
}

export function selectMarketRows(
  market: MarketRow[],
  query: string,
  sorting: MarketListSortKey | null,
  sortDirection: 'asc' | 'desc',
  correlations: Record<string, number>,
  natrs: Record<string, number> = {},
  favoriteSymbols: Set<string> = new Set(),
  filters: MarketListFilters = createMarketListFilters(),
) {
  const filteredRows = market.filter(
    (row) =>
      row.symbol.includes(query.toUpperCase()) &&
      isInRange(row.volume, filters.volume) &&
      isInRange(row.change, filters.change) &&
      isInRange(row.trades, filters.trades) &&
      isInRange(row.natr, filters.natr) &&
      isInRange(
        correlations[row.symbol] === undefined ? undefined : correlations[row.symbol] * 100,
        filters.correlation,
      ),
  );
  if (sorting === null) return filteredRows;
  return filteredRows.sort((left, right) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sorting === 'favorite')
      return (
        modifier * (Number(favoriteSymbols.has(left.symbol)) - Number(favoriteSymbols.has(right.symbol)))
      );
    if (sorting === 'symbol') return modifier * left.symbol.localeCompare(right.symbol);
    if (sorting === 'correlation') {
      const leftCorrelation = correlations[left.symbol];
      const rightCorrelation = correlations[right.symbol];
      if (leftCorrelation === undefined) return rightCorrelation === undefined ? 0 : 1;
      if (rightCorrelation === undefined) return -1;
      return modifier * (leftCorrelation - rightCorrelation);
    }
    if (sorting === 'natr5m14') {
      const leftNatr = natrs[left.symbol];
      const rightNatr = natrs[right.symbol];
      if (leftNatr === undefined) return rightNatr === undefined ? 0 : 1;
      if (rightNatr === undefined) return -1;
      return modifier * (leftNatr - rightNatr);
    }
    return modifier * (left[sorting] - right[sorting]);
  });
}

export const marketListSortMark = (
  key: MarketListSortKey,
  sorting: MarketListSortKey | null,
  sortDirection: 'asc' | 'desc',
) => (sorting === key ? (sortDirection === 'asc' ? '↑' : '↓') : '');

function isInRange(value: number | undefined, range: { min: number | null; max: number | null }) {
  if (range.min === null && range.max === null) return true;
  return (
    value !== undefined &&
    (range.min === null || value >= range.min) &&
    (range.max === null || value <= range.max)
  );
}

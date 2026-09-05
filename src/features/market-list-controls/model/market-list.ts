import type { MarketRow } from '../../../entities/market';

export type MarketListSortKey =
  'favorite' | 'symbol' | 'change' | 'volume' | 'natr' | 'natr5m14' | 'correlation';
export type MarketListSortState = { sorting: MarketListSortKey | null; sortDirection: 'asc' | 'desc' };

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
) {
  const filteredRows = market.filter((row) => row.symbol.includes(query.toUpperCase()));
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

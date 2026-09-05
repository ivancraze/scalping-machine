import type { MarketRow } from '../../../entities/market';
export type SortKey = 'symbol' | 'change' | 'volume' | 'natr' | 'correlation';
export function selectMarketRows(
  market: MarketRow[],
  query: string,
  sorting: SortKey,
  sortDirection: 'asc' | 'desc',
  correlations: Record<string, number>,
) {
  return market
    .filter((x) => x.symbol.includes(query.toUpperCase()))
    .sort((left, right) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      if (sorting === 'symbol') return modifier * left.symbol.localeCompare(right.symbol);
      if (sorting === 'correlation') {
        const leftCorrelation = correlations[left.symbol];
        const rightCorrelation = correlations[right.symbol];
        if (leftCorrelation === undefined) return rightCorrelation === undefined ? 0 : 1;
        if (rightCorrelation === undefined) return -1;
        return modifier * (leftCorrelation - rightCorrelation);
      }
      return modifier * (left[sorting] - right[sorting]);
    });
}
export const sortMark = (key: SortKey, sorting: SortKey, sortDirection: 'asc' | 'desc') =>
  sorting === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

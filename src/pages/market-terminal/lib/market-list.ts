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
      const leftValue =
        sorting === 'correlation' ? (correlations[left.symbol] ?? Number.NEGATIVE_INFINITY) : left[sorting];
      const rightValue =
        sorting === 'correlation' ? (correlations[right.symbol] ?? Number.NEGATIVE_INFINITY) : right[sorting];
      return modifier * (leftValue - rightValue);
    });
}
export const sortMark = (key: SortKey, sorting: SortKey, sortDirection: 'asc' | 'desc') =>
  sorting === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

import type { MarketRow } from '../../../entities/market';
import type { MarketGridFilters, MarketGridView } from './types';

export function selectGridMarkets(
  market: MarketRow[],
  query: string,
  view: MarketGridView,
  filters: MarketGridFilters,
  favorites: Set<string>,
  limit = 40,
) {
  const normalizedQuery = query.trim().toUpperCase();
  const selected = market.filter(
    (row) =>
      row.symbol.includes(normalizedQuery) &&
      (view !== 'favorites' || favorites.has(row.symbol)) &&
      (filters.minVolume === null || row.volume >= filters.minVolume) &&
      (filters.minTrades === null || row.trades >= filters.minTrades) &&
      (filters.minChange === null || row.change >= filters.minChange) &&
      (filters.maxChange === null || row.change <= filters.maxChange),
  );
  const compare =
    view === 'losers'
      ? (left: MarketRow, right: MarketRow) => left.change - right.change
      : view === 'active'
        ? (left: MarketRow, right: MarketRow) => right.trades - left.trades
        : view === 'all' || view === 'favorites'
          ? (left: MarketRow, right: MarketRow) => right.volume - left.volume
          : (left: MarketRow, right: MarketRow) => right.change - left.change;
  return [...selected].sort(compare).slice(0, limit);
}

import type { MarketRow } from '../../../entities/market';
import type {
  MarketGridFilters,
  MarketGridSortDirection,
  MarketGridSortField,
  MarketGridView,
} from './types';

type MarketGridSelectionOptions = {
  sortField?: MarketGridSortField;
  sortDirection?: MarketGridSortDirection;
  limit?: number;
  blacklist?: string[];
  natrs?: Record<string, number>;
};

export function selectGridMarkets(
  market: MarketRow[],
  query: string,
  view: MarketGridView,
  filters: MarketGridFilters,
  favorites: Set<string>,
  options: MarketGridSelectionOptions = {},
) {
  const normalizedQuery = query.trim().toUpperCase();
  const blacklist = new Set(options.blacklist ?? []);
  const selected = market.filter((row) => {
    const natr = options.natrs?.[row.symbol];
    return (
      row.symbol.includes(normalizedQuery) &&
      !blacklist.has(row.symbol) &&
      (view !== 'favorites' || favorites.has(row.symbol)) &&
      inRange(row.volume, filters.minVolume, filters.maxVolume) &&
      inRange(row.trades, filters.minTrades, filters.maxTrades) &&
      inRange(row.change, filters.minChange, filters.maxChange) &&
      inRange(row.range, filters.minRange, filters.maxRange) &&
      inOptionalRange(natr, filters.minNatr, filters.maxNatr)
    );
  });
  const sortField = options.sortField ?? defaultSortField(view);
  const sortDirection = options.sortDirection ?? defaultSortDirection(view);
  const direction = sortDirection === 'asc' ? 1 : -1;
  return [...selected]
    .sort((left, right) => {
      const leftValue = sortValue(left, sortField, options.natrs);
      const rightValue = sortValue(right, sortField, options.natrs);
      if (leftValue === undefined) return rightValue === undefined ? 0 : 1;
      if (rightValue === undefined) return -1;
      return (leftValue - rightValue) * direction;
    })
    .slice(0, options.limit ?? 40);
}

function sortValue(row: MarketRow, field: MarketGridSortField, natrs: Record<string, number> | undefined) {
  if (field === 'absoluteChange') return Math.abs(row.change);
  if (field === 'natr') return natrs?.[row.symbol];
  return row[field];
}

function defaultSortField(view: MarketGridView): MarketGridSortField {
  if (view === 'active') return 'trades';
  if (view === 'gainers' || view === 'losers') return 'change';
  return 'volume';
}

function defaultSortDirection(view: MarketGridView): MarketGridSortDirection {
  return view === 'losers' ? 'asc' : 'desc';
}

function inRange(value: number, min: number | null, max: number | null) {
  return (min === null || value >= min) && (max === null || value <= max);
}

function inOptionalRange(value: number | undefined, min: number | null, max: number | null) {
  if (min === null && max === null) return true;
  return value !== undefined && inRange(value, min, max);
}

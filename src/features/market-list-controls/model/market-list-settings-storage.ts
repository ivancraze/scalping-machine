import {
  createMarketListColumns,
  createMarketListFilters,
  type MarketListColumnKey,
  type MarketListFilters,
} from './market-list';

const SETTINGS_STORAGE_KEY = 'pulse-terminal:market-list-settings';
const COLUMN_KEYS: MarketListColumnKey[] = ['volume', 'change', 'trades', 'correlation', 'natr', 'natr5m14'];
type MarketListSettings = { filters: MarketListFilters; columns: MarketListColumnKey[] };

export function loadMarketListSettings(): MarketListSettings {
  const defaults = { filters: createMarketListFilters(), columns: createMarketListColumns() };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    const value = stored as Partial<MarketListSettings>;
    return {
      filters: isFilters(value.filters) ? value.filters : defaults.filters,
      columns: Array.isArray(value.columns)
        ? value.columns.filter((column): column is MarketListColumnKey => COLUMN_KEYS.includes(column))
        : defaults.columns,
    };
  } catch {
    return defaults;
  }
}

export function saveMarketListSettings(settings: MarketListSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Настройки работают до закрытия страницы, если хранилище недоступно.
  }
}

function isFilters(value: unknown): value is MarketListFilters {
  if (!value || typeof value !== 'object') return false;
  return ['volume', 'change', 'trades', 'correlation', 'natr'].every((key) => {
    const range = (value as Record<string, unknown>)[key];
    return (
      !!range &&
      typeof range === 'object' &&
      isLimit((range as Record<string, unknown>).min) &&
      isLimit((range as Record<string, unknown>).max)
    );
  });
}

function isLimit(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

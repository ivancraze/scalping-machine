import type {
  MarketGridFilters,
  MarketGridPreset,
  MarketGridSettings,
  MarketGridSortDirection,
  MarketGridSortField,
  MarketGridTechnicalDataMode,
  MarketGridTimeframe,
  MarketGridView,
} from './types';

const STORAGE_KEY = 'pulse-terminal:market-grid-settings';
const STORAGE_VERSION = 2;
const TIMEFRAMES: MarketGridTimeframe[] = ['1м', '3м', '5м', '15м', '30м', '1ч', '4ч', '1д'];
const VIEWS: MarketGridView[] = ['all', 'favorites', 'gainers', 'losers', 'active'];
const SORT_FIELDS: MarketGridSortField[] = ['volume', 'change', 'absoluteChange', 'range', 'trades', 'natr'];

export const defaultMarketGridFilters = (): MarketGridFilters => ({
  minVolume: 50_000_000,
  maxVolume: null,
  minTrades: null,
  maxTrades: null,
  minChange: null,
  maxChange: null,
  minRange: null,
  maxRange: null,
  minNatr: null,
  maxNatr: null,
});

export const defaultMarketGridSettings = (): MarketGridSettings => ({
  columns: 3,
  mode: 'scroll',
  timeframe: '5м',
  view: 'active',
  volumeVisible: true,
  openInterestVisible: true,
  scaleLabelsVisible: true,
  technicalDataMode: 'detailed',
  filters: defaultMarketGridFilters(),
  sortField: 'trades',
  sortDirection: 'desc',
  limit: 40,
  blacklist: [],
  presets: [],
  activePresetId: null,
  symbolTimeframes: {},
});

export function loadMarketGridSettings(): MarketGridSettings {
  const fallback = defaultMarketGridSettings();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    const record = stored as Record<string, unknown>;
    if ((record.version !== 1 && record.version !== STORAGE_VERSION) || !isRecord(record.settings))
      return fallback;
    const settings = record.settings;
    const presets = Array.isArray(settings.presets)
      ? settings.presets.flatMap((value) => parsePreset(value)).slice(0, 20)
      : [];
    const activePresetId =
      typeof settings.activePresetId === 'string' && presets.some(({ id }) => id === settings.activePresetId)
        ? settings.activePresetId
        : null;
    const view = parseView(settings.view, fallback.view);
    return {
      columns:
        settings.columns === 2 || settings.columns === 3 || settings.columns === 4 ? settings.columns : 3,
      mode: settings.mode === 'pages' ? 'pages' : 'scroll',
      timeframe: parseTimeframe(settings.timeframe, fallback.timeframe),
      view,
      volumeVisible: settings.volumeVisible !== false,
      openInterestVisible: settings.openInterestVisible !== false,
      scaleLabelsVisible: settings.scaleLabelsVisible !== false,
      technicalDataMode: parseTechnicalDataMode(settings.technicalDataMode),
      filters: parseFilters(settings.filters),
      sortField: parseSortField(
        settings.sortField,
        record.version === 1 ? defaultSortField(view) : fallback.sortField,
      ),
      sortDirection:
        record.version === 1 && settings.sortDirection === undefined
          ? defaultSortDirection(view)
          : parseSortDirection(settings.sortDirection),
      limit: parseLimit(settings.limit),
      blacklist: parseSymbols(settings.blacklist),
      presets,
      activePresetId,
      symbolTimeframes: parseSymbolTimeframes(settings.symbolTimeframes),
    };
  } catch {
    return fallback;
  }
}

export function saveMarketGridSettings(settings: MarketGridSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, settings }));
  } catch {
    // Settings remain available until the page is closed.
  }
}

function parsePreset(value: unknown): MarketGridPreset[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return [];
  const name = value.name.trim().slice(0, 40);
  if (!name) return [];
  return [
    {
      id: value.id,
      name,
      view: parseView(value.view, 'all'),
      filters: parseFilters(value.filters),
      sortField: parseSortField(value.sortField, 'volume'),
      sortDirection: parseSortDirection(value.sortDirection),
      limit: parseLimit(value.limit),
      timeframe: parseTimeframe(value.timeframe, '5м'),
      blacklist: parseSymbols(value.blacklist),
    },
  ];
}

function parseFilters(value: unknown): MarketGridFilters {
  const filters = isRecord(value) ? value : {};
  return {
    minVolume: numberOrNull(filters.minVolume),
    maxVolume: numberOrNull(filters.maxVolume),
    minTrades: numberOrNull(filters.minTrades),
    maxTrades: numberOrNull(filters.maxTrades),
    minChange: numberOrNull(filters.minChange),
    maxChange: numberOrNull(filters.maxChange),
    minRange: numberOrNull(filters.minRange),
    maxRange: numberOrNull(filters.maxRange),
    minNatr: numberOrNull(filters.minNatr),
    maxNatr: numberOrNull(filters.maxNatr),
  };
}

function parseSymbolTimeframes(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, MarketGridTimeframe] =>
      TIMEFRAMES.includes(entry[1] as MarketGridTimeframe),
    ),
  );
}

function parseSymbols(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^[A-Z0-9]{2,20}(USDT)?$/.test(item))
        .map((item) => (item.endsWith('USDT') ? item : `${item}USDT`)),
    ),
  ].slice(0, 200);
}

function parseTimeframe(value: unknown, fallback: MarketGridTimeframe) {
  return TIMEFRAMES.includes(value as MarketGridTimeframe) ? (value as MarketGridTimeframe) : fallback;
}

function parseView(value: unknown, fallback: MarketGridView) {
  return VIEWS.includes(value as MarketGridView) ? (value as MarketGridView) : fallback;
}

function parseSortField(value: unknown, fallback: MarketGridSortField) {
  return SORT_FIELDS.includes(value as MarketGridSortField) ? (value as MarketGridSortField) : fallback;
}

function parseSortDirection(value: unknown): MarketGridSortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function defaultSortField(view: MarketGridView): MarketGridSortField {
  if (view === 'active') return 'trades';
  if (view === 'gainers' || view === 'losers') return 'change';
  return 'volume';
}

function defaultSortDirection(view: MarketGridView): MarketGridSortDirection {
  return view === 'losers' ? 'asc' : 'desc';
}

function parseTechnicalDataMode(value: unknown): MarketGridTechnicalDataMode {
  return value === 'compact' ? 'compact' : 'detailed';
}

function parseLimit(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100 ? value : 40;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

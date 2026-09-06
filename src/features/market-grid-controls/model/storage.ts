import type { MarketGridSettings, MarketGridTimeframe, MarketGridView } from './types';

const STORAGE_KEY = 'pulse-terminal:market-grid-settings';
const STORAGE_VERSION = 1;
const TIMEFRAMES: MarketGridTimeframe[] = ['1м', '5м', '15м', '1ч', '4ч', '1д'];
const VIEWS: MarketGridView[] = ['all', 'favorites', 'gainers', 'losers', 'active'];

export const defaultMarketGridSettings = (): MarketGridSettings => ({
  columns: 3,
  mode: 'scroll',
  timeframe: '5м',
  view: 'active',
  volumeVisible: true,
  openInterestVisible: true,
  filters: { minVolume: 50_000_000, minTrades: null, minChange: null, maxChange: null },
  symbolTimeframes: {},
});

export function loadMarketGridSettings(): MarketGridSettings {
  const fallback = defaultMarketGridSettings();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    const record = stored as Record<string, unknown>;
    if (record.version !== STORAGE_VERSION || !record.settings || typeof record.settings !== 'object')
      return fallback;
    const settings = record.settings as Record<string, unknown>;
    const filters = settings.filters as Record<string, unknown> | undefined;
    const numberOrNull = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    const symbolTimeframes = Object.fromEntries(
      Object.entries(
        settings.symbolTimeframes && typeof settings.symbolTimeframes === 'object'
          ? (settings.symbolTimeframes as Record<string, unknown>)
          : {},
      ).filter((entry): entry is [string, MarketGridTimeframe] =>
        TIMEFRAMES.includes(entry[1] as MarketGridTimeframe),
      ),
    );
    return {
      columns:
        settings.columns === 2 || settings.columns === 3 || settings.columns === 4 ? settings.columns : 3,
      mode: settings.mode === 'pages' ? 'pages' : 'scroll',
      timeframe: TIMEFRAMES.includes(settings.timeframe as MarketGridTimeframe)
        ? (settings.timeframe as MarketGridTimeframe)
        : fallback.timeframe,
      view: VIEWS.includes(settings.view as MarketGridView)
        ? (settings.view as MarketGridView)
        : fallback.view,
      volumeVisible: settings.volumeVisible !== false,
      openInterestVisible: settings.openInterestVisible !== false,
      filters: {
        minVolume: numberOrNull(filters?.minVolume),
        minTrades: numberOrNull(filters?.minTrades),
        minChange: numberOrNull(filters?.minChange),
        maxChange: numberOrNull(filters?.maxChange),
      },
      symbolTimeframes,
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

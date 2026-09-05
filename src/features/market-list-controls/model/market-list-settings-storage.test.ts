import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMarketListColumns, createMarketListFilters } from './market-list';
import { loadMarketListSettings, saveMarketListSettings } from './market-list-settings-storage';

afterEach(() => vi.unstubAllGlobals());

describe('market list settings storage', () => {
  it('restores saved filters and discards the removed price column from saved settings', () => {
    const filters = createMarketListFilters();
    filters.volume = { min: 100, max: 500 };
    filters.correlation = { min: -25, max: 75 };
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ filters, columns: ['price', 'trades', 'volume'] }),
    });

    expect(loadMarketListSettings()).toEqual({ filters, columns: ['trades', 'volume'] });
  });

  it('falls back to defaults when stored settings are malformed', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{invalid json' });

    expect(loadMarketListSettings()).toEqual({
      filters: createMarketListFilters(),
      columns: createMarketListColumns(),
    });
  });

  it('persists filters and visible columns', () => {
    const setItem = vi.fn();
    const filters = createMarketListFilters();
    filters.change = { min: 5, max: null };
    vi.stubGlobal('localStorage', { setItem });

    saveMarketListSettings({ filters, columns: ['volume', 'natr5m14'] });

    expect(setItem).toHaveBeenCalledWith(
      'pulse-terminal:market-list-settings',
      JSON.stringify({ filters, columns: ['volume', 'natr5m14'] }),
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketGridSettings } from './types';
import { defaultMarketGridSettings, loadMarketGridSettings, saveMarketGridSettings } from './storage';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
});

afterEach(() => storage.clear());

describe('market grid settings storage', () => {
  it('round-trips versioned settings including symbol timeframe overrides', () => {
    const settings: MarketGridSettings = {
      ...defaultMarketGridSettings(),
      columns: 4,
      mode: 'pages',
      timeframe: '15м',
      view: 'favorites',
      volumeVisible: false,
      filters: { minVolume: 10_000, minTrades: 500, minChange: -2, maxChange: 8 },
      symbolTimeframes: { BTCUSDT: '1ч', ETHUSDT: '1д' },
    };

    saveMarketGridSettings(settings);

    expect(JSON.parse(storage.get('pulse-terminal:market-grid-settings') ?? '')).toEqual({
      version: 1,
      settings,
    });
    expect(loadMarketGridSettings()).toEqual(settings);
  });

  it('falls back safely for malformed JSON and unsupported storage versions', () => {
    storage.set('pulse-terminal:market-grid-settings', '{invalid');
    expect(loadMarketGridSettings()).toEqual(defaultMarketGridSettings());

    storage.set(
      'pulse-terminal:market-grid-settings',
      JSON.stringify({ version: 2, settings: { columns: 4 } }),
    );
    expect(loadMarketGridSettings()).toEqual(defaultMarketGridSettings());
  });

  it('sanitizes invalid enum, numeric, and per-symbol timeframe values', () => {
    storage.set(
      'pulse-terminal:market-grid-settings',
      JSON.stringify({
        version: 1,
        settings: {
          columns: 8,
          mode: 'unknown',
          timeframe: '1s',
          view: 'unknown',
          volumeVisible: 'yes',
          openInterestVisible: 0,
          filters: {
            minVolume: Number.POSITIVE_INFINITY,
            minTrades: '100',
            minChange: -5,
            maxChange: 10,
          },
          symbolTimeframes: { BTCUSDT: '1ч', ETHUSDT: '1s' },
        },
      }),
    );

    expect(loadMarketGridSettings()).toEqual({
      ...defaultMarketGridSettings(),
      filters: { minVolume: null, minTrades: null, minChange: -5, maxChange: 10 },
      symbolTimeframes: { BTCUSDT: '1ч' },
    });
  });
});

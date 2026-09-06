import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUTO_LEVEL_SETTINGS } from '../../../entities/auto-level';
import { loadAutoLevelSettings, saveAutoLevelSettings } from './auto-level-settings-storage';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
});

afterEach(() => storage.clear());

describe('auto level settings storage', () => {
  it('starts disabled with the researched defaults', () => {
    expect(loadAutoLevelSettings()).toEqual(DEFAULT_AUTO_LEVEL_SETTINGS);
    expect(DEFAULT_AUTO_LEVEL_SETTINGS).toMatchObject({
      enabled: false,
      nearPriceOnly: true,
      maxDistancePercent: 1,
      enabledDetectors: { breakout: true, extremum: false },
      extremumHistorySize: 1500,
      extremumMinTouches: 1,
      enabledTypes: { support: true, resistance: true, trend: false },
    });
  });

  it('round-trips valid settings', () => {
    const settings = {
      ...DEFAULT_AUTO_LEVEL_SETTINGS,
      enabled: true,
      interval: '1h' as const,
      minTouches: 4,
      enabledTypes: { ...DEFAULT_AUTO_LEVEL_SETTINGS.enabledTypes, trend: false },
      colors: { ...DEFAULT_AUTO_LEVEL_SETTINGS.colors },
    };

    saveAutoLevelSettings(settings);

    expect(loadAutoLevelSettings()).toEqual(settings);
  });

  it('falls back safely when stored settings are malformed', () => {
    storage.set('pulse-terminal:auto-levels:settings:v4', '{"enabled":true}');

    expect(loadAutoLevelSettings()).toEqual(DEFAULT_AUTO_LEVEL_SETTINGS);
  });
});

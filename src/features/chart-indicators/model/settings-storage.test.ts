import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChartIndicatorSettings, saveChartIndicatorSettings } from './settings-storage';
import { DEFAULT_CHART_INDICATOR_SETTINGS } from './types';

const getItem = vi.fn<(key: string) => string | null>();
const setItem = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getItem.mockReturnValue(null);
  vi.stubGlobal('localStorage', { getItem, setItem });
});

describe('chart indicator settings storage', () => {
  it('loads valid preset-ready settings', () => {
    const settings = {
      volume: { visible: false, upColor: '#112233', downColor: '#445566', height: 180 },
      openInterest: { visible: true, color: '#778899', height: 140 },
    };
    getItem.mockReturnValue(JSON.stringify(settings));

    expect(loadChartIndicatorSettings()).toEqual(settings);
  });

  it('falls back to independent defaults for invalid data', () => {
    getItem.mockReturnValue('{invalid json');
    const first = loadChartIndicatorSettings();
    first.volume.visible = false;

    expect(loadChartIndicatorSettings()).toEqual(DEFAULT_CHART_INDICATOR_SETTINGS);
  });

  it('persists serializable settings under the versioned global key', () => {
    const settings = {
      volume: { visible: false, upColor: '#112233', downColor: '#445566', height: 180 },
      openInterest: { visible: true, color: '#778899', height: 140 },
    };

    saveChartIndicatorSettings(settings);

    expect(setItem).toHaveBeenCalledWith(
      'pulse-terminal:chart-indicators:settings:v2',
      JSON.stringify(settings),
    );
  });

  it('migrates v1 settings and supplies default pane heights', () => {
    const legacy = {
      volume: { visible: false, upColor: '#112233', downColor: '#445566' },
      openInterest: { visible: true, color: '#778899' },
    };
    getItem.mockImplementation((key) =>
      key === 'pulse-terminal:chart-indicators:settings:v1' ? JSON.stringify(legacy) : null,
    );

    expect(loadChartIndicatorSettings()).toEqual({
      volume: { ...legacy.volume, height: DEFAULT_CHART_INDICATOR_SETTINGS.volume.height },
      openInterest: {
        ...legacy.openInterest,
        height: DEFAULT_CHART_INDICATOR_SETTINGS.openInterest.height,
      },
    });
  });

  it('keeps session settings when localStorage is unavailable', () => {
    setItem.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveChartIndicatorSettings(DEFAULT_CHART_INDICATOR_SETTINGS)).not.toThrow();
  });
});

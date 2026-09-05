import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadChartTimeframe, saveChartTimeframe } from './timeframe-storage';

afterEach(() => vi.unstubAllGlobals());

describe('chart timeframe storage', () => {
  it('restores a supported timeframe and falls back to one minute for invalid data', () => {
    const getItem = vi.fn(() => '15м');
    vi.stubGlobal('localStorage', { getItem });
    expect(loadChartTimeframe()).toBe('15м');

    getItem.mockReturnValue('not-a-timeframe');
    expect(loadChartTimeframe()).toBe('1м');
  });

  it('stores the selected timeframe and tolerates unavailable storage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveChartTimeframe('4ч');
    expect(setItem).toHaveBeenCalledWith('pulse-terminal:chart-timeframe', '4ч');

    vi.stubGlobal('localStorage', { setItem: () => throwStorageError() });
    expect(() => saveChartTimeframe('1м')).not.toThrow();
  });
});

function throwStorageError(): never {
  throw new Error('Storage unavailable');
}

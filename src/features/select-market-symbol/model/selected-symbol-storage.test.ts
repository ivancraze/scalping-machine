import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSelectedMarketSymbol, saveSelectedMarketSymbol } from './selected-symbol-storage';

afterEach(() => vi.unstubAllGlobals());

describe('selected market symbol storage', () => {
  it('uses BTCUSDT until a persisted selection is available', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    expect(loadSelectedMarketSymbol()).toBe('BTCUSDT');
    saveSelectedMarketSymbol('ETHUSDT');
    expect(loadSelectedMarketSymbol()).toBe('ETHUSDT');
  });
});

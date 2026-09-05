import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSelectedSymbol, saveSelectedSymbol } from './selected-symbol-storage';

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
});

afterEach(() => storage.clear());

describe('selected symbol storage', () => {
  it('restores the last saved USDT pair', () => {
    saveSelectedSymbol('SOLUSDT');

    expect(loadSelectedSymbol()).toBe('SOLUSDT');
  });

  it('falls back to BTCUSDT for unavailable or invalid stored data', () => {
    expect(loadSelectedSymbol()).toBe('BTCUSDT');
    storage.set('pulse-terminal:market-terminal:selected-symbol', 'not-a-symbol');

    expect(loadSelectedSymbol()).toBe('BTCUSDT');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFavoriteSymbols, saveFavoriteSymbols } from './favorite-symbol-storage';

afterEach(() => vi.unstubAllGlobals());

describe('favorite symbol storage', () => {
  it('restores stored symbols', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(['ETHUSDT', 'BTCUSDT']) });
    expect(loadFavoriteSymbols()).toEqual(new Set(['ETHUSDT', 'BTCUSDT']));
  });

  it('keeps in-memory behaviour when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { setItem: blocked });
    expect(() => saveFavoriteSymbols(new Set(['BTCUSDT']))).not.toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTheme, saveTheme } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('theme preference', () => {
  it('starts dark when there is no saved preference or it is invalid', () => {
    const getItem = vi.fn().mockReturnValue(null);
    vi.stubGlobal('localStorage', { getItem });
    expect(loadTheme()).toBe('dark');
    getItem.mockReturnValue('invalid');
    expect(loadTheme()).toBe('dark');
  });

  it('restores both manual choices after saving', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    saveTheme('light');
    expect(loadTheme()).toBe('light');
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('keeps working when browser storage throws', () => {
    const blocked = () => {
      throw new Error('Storage is blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(loadTheme()).toBe('dark');
    expect(() => saveTheme('light')).not.toThrow();
  });
});

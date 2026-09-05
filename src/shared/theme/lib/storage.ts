import type { ThemeMode } from '../model/types';

const STORAGE_KEY = 'pulse-terminal:theme';

export function loadTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}

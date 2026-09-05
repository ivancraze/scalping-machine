const FAVORITES_STORAGE_KEY = 'pulse-terminal:favorite-symbols';

export function loadFavoriteSymbols(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(stored) ? stored.filter((symbol): symbol is string => typeof symbol === 'string') : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function saveFavoriteSymbols(symbols: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...symbols].sort()));
  } catch {
    // Закладки работают до закрытия страницы, если хранилище недоступно.
  }
}

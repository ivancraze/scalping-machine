const SELECTED_SYMBOL_STORAGE_KEY = 'pulse-terminal:selected-symbol';
const DEFAULT_SYMBOL = 'BTCUSDT';

export function loadSelectedMarketSymbol(): string {
  try {
    return localStorage.getItem(SELECTED_SYMBOL_STORAGE_KEY) || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

export function saveSelectedMarketSymbol(symbol: string) {
  try {
    localStorage.setItem(SELECTED_SYMBOL_STORAGE_KEY, symbol);
  } catch {
    // Выбор действует до закрытия страницы, если хранилище недоступно.
  }
}

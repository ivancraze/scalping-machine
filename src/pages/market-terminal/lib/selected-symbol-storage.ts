const SELECTED_SYMBOL_STORAGE_KEY = 'pulse-terminal:market-terminal:selected-symbol';
const DEFAULT_SYMBOL = 'BTCUSDT';

export function loadSelectedSymbol() {
  try {
    const symbol = localStorage.getItem(SELECTED_SYMBOL_STORAGE_KEY);
    return symbol && /^[A-Z0-9]+USDT$/.test(symbol) ? symbol : DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

export function saveSelectedSymbol(symbol: string) {
  try {
    localStorage.setItem(SELECTED_SYMBOL_STORAGE_KEY, symbol);
  } catch {
    // The selected pair remains available for the current session.
  }
}

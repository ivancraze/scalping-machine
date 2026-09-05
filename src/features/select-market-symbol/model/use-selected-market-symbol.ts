import { useEffect, useState } from 'react';
import { loadSelectedMarketSymbol, saveSelectedMarketSymbol } from './selected-symbol-storage';

export function useSelectedMarketSymbol() {
  const [symbol, setSymbol] = useState(loadSelectedMarketSymbol);

  useEffect(() => {
    saveSelectedMarketSymbol(symbol);
  }, [symbol]);

  return { symbol, setSymbol };
}

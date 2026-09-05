import { useCallback, useState } from 'react';
import { loadFavoriteSymbols, saveFavoriteSymbols } from './favorite-symbol-storage';
import type { MarketListSortKey } from './market-list';

export function useMarketListControls() {
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<MarketListSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'futures' | 'favorites'>('futures');
  const [favoriteSymbols, setFavoriteSymbols] = useState(loadFavoriteSymbols);

  const toggleFavorite = useCallback((symbol: string) => {
    setFavoriteSymbols((current) => {
      const next = new Set(current);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      saveFavoriteSymbols(next);
      return next;
    });
  }, []);

  return {
    query,
    setQuery,
    sorting,
    setSorting,
    sortDirection,
    setSortDirection,
    activeTab,
    setActiveTab,
    favoriteSymbols,
    toggleFavorite,
  };
}

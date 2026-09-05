import { useCallback, useMemo, useState } from 'react';
import { loadFavoriteSymbols, saveFavoriteSymbols } from './favorite-symbol-storage';
import { loadMarketListSettings, saveMarketListSettings } from './market-list-settings-storage';
import type { MarketListColumnKey, MarketListFilters, MarketListSortKey } from './market-list';

export function useMarketListControls() {
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<MarketListSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'futures' | 'favorites'>('futures');
  const [favoriteSymbols, setFavoriteSymbols] = useState(loadFavoriteSymbols);
  const [settings, setSettings] = useState(loadMarketListSettings);
  const visibleColumns = useMemo(() => new Set(settings.columns), [settings.columns]);

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
    filters: settings.filters,
    visibleColumns,
    setFilters: (filters: MarketListFilters) => {
      setSettings((current) => {
        const next = { ...current, filters };
        saveMarketListSettings(next);
        return next;
      });
    },
    setVisibleColumns: (columns: MarketListColumnKey[]) => {
      setSettings((current) => {
        const next = { ...current, columns };
        saveMarketListSettings(next);
        return next;
      });
    },
    applySettings: (filters: MarketListFilters, columns: MarketListColumnKey[]) => {
      setSettings(() => {
        const next = { filters, columns };
        saveMarketListSettings(next);
        return next;
      });
    },
  };
}

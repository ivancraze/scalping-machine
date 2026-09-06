import { useEffect, useState } from 'react';
import { loadMarketGridSettings, saveMarketGridSettings } from './storage';
import type { MarketGridSettings, MarketGridTimeframe } from './types';

export function useMarketGridControls() {
  const [settings, setSettings] = useState(loadMarketGridSettings);

  useEffect(() => saveMarketGridSettings(settings), [settings]);

  const updateSettings = (patch: Partial<MarketGridSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  const setSymbolTimeframe = (symbol: string, timeframe: MarketGridTimeframe) =>
    setSettings((current) => ({
      ...current,
      symbolTimeframes: {
        ...current.symbolTimeframes,
        [symbol]: timeframe,
      },
    }));

  return { settings, updateSettings, setSymbolTimeframe };
}

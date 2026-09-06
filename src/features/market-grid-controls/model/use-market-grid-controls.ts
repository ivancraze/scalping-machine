import { useEffect, useState } from 'react';
import { loadMarketGridSettings, saveMarketGridSettings } from './storage';
import type { MarketGridPreset, MarketGridSettings, MarketGridTimeframe } from './types';

export type MarketGridPresetDraft = Omit<MarketGridPreset, 'id'>;

export function useMarketGridControls() {
  const [settings, setSettings] = useState(loadMarketGridSettings);

  useEffect(() => saveMarketGridSettings(settings), [settings]);

  const updateSettings = (patch: Partial<MarketGridSettings>) =>
    setSettings((current) => ({
      ...current,
      ...patch,
      activePresetId: detachesPreset(patch) ? null : (patch.activePresetId ?? current.activePresetId),
    }));
  const setSymbolTimeframe = (symbol: string, timeframe: MarketGridTimeframe) =>
    setSettings((current) => ({
      ...current,
      symbolTimeframes: {
        ...current.symbolTimeframes,
        [symbol]: timeframe,
      },
    }));

  const selectPreset = (id: string) =>
    setSettings((current) => {
      const preset = current.presets.find((item) => item.id === id);
      if (!preset) return current;
      return {
        ...current,
        activePresetId: preset.id,
        view: preset.view,
        filters: preset.filters,
        sortField: preset.sortField,
        sortDirection: preset.sortDirection,
        limit: preset.limit,
        timeframe: preset.timeframe,
        blacklist: preset.blacklist,
        symbolTimeframes: {},
      };
    });

  const savePreset = (draft: MarketGridPresetDraft) =>
    setSettings((current) => {
      const id = current.activePresetId ?? createPresetId();
      const preset = { ...draft, id };
      const exists = current.presets.some((item) => item.id === id);
      return {
        ...current,
        ...draft,
        activePresetId: id,
        presets: exists
          ? current.presets.map((item) => (item.id === id ? preset : item))
          : [...current.presets, preset],
        symbolTimeframes: {},
      };
    });

  const deleteActivePreset = () =>
    setSettings((current) => ({
      ...current,
      presets: current.presets.filter(({ id }) => id !== current.activePresetId),
      activePresetId: null,
    }));

  return {
    settings,
    updateSettings,
    setSymbolTimeframe,
    selectPreset,
    savePreset,
    deleteActivePreset,
  };
}

function createPresetId() {
  return globalThis.crypto?.randomUUID?.() ?? `preset-${Date.now()}`;
}

function detachesPreset(patch: Partial<MarketGridSettings>) {
  return ['view', 'filters', 'sortField', 'sortDirection', 'limit', 'timeframe', 'blacklist'].some(
    (key) => key in patch,
  );
}

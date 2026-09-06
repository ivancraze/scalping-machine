import { useCallback, useState } from 'react';
import { loadChartIndicatorSettings, saveChartIndicatorSettings } from './settings-storage';
import {
  defaultChartIndicatorSettings,
  type ChartIndicatorHeights,
  type ChartIndicatorSettings,
} from './types';

export function useChartIndicators() {
  const [settings, setSettings] = useState(loadChartIndicatorSettings);

  const updateSettings = useCallback((next: ChartIndicatorSettings) => {
    setSettings(next);
    saveChartIndicatorSettings(next);
  }, []);

  const resetSettings = useCallback(() => {
    const next = defaultChartIndicatorSettings();
    setSettings(next);
    saveChartIndicatorSettings(next);
  }, []);

  const updateHeights = useCallback((heights: ChartIndicatorHeights) => {
    setSettings((current) => {
      if (current.volume.height === heights.volume && current.openInterest.height === heights.openInterest)
        return current;
      const next = {
        volume: { ...current.volume, height: heights.volume },
        openInterest: { ...current.openInterest, height: heights.openInterest },
      };
      saveChartIndicatorSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings, updateHeights, resetSettings };
}

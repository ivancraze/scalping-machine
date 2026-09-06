import { defaultChartIndicatorSettings, type ChartIndicatorSettings } from './types';

const CHART_INDICATOR_SETTINGS_KEY = 'pulse-terminal:chart-indicators:settings:v2';
const LEGACY_CHART_INDICATOR_SETTINGS_KEY = 'pulse-terminal:chart-indicators:settings:v1';
const isColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const isPaneHeight = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 2000;

function isChartIndicatorSettings(value: unknown): value is ChartIndicatorSettings {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  const volume = settings.volume;
  const openInterest = settings.openInterest;
  return (
    typeof volume === 'object' &&
    volume !== null &&
    typeof (volume as Record<string, unknown>).visible === 'boolean' &&
    isColor((volume as Record<string, unknown>).upColor) &&
    isColor((volume as Record<string, unknown>).downColor) &&
    isPaneHeight((volume as Record<string, unknown>).height) &&
    typeof openInterest === 'object' &&
    openInterest !== null &&
    typeof (openInterest as Record<string, unknown>).visible === 'boolean' &&
    isColor((openInterest as Record<string, unknown>).color) &&
    isPaneHeight((openInterest as Record<string, unknown>).height)
  );
}

function loadLegacySettings(): ChartIndicatorSettings | null {
  const value: unknown = JSON.parse(localStorage.getItem(LEGACY_CHART_INDICATOR_SETTINGS_KEY) ?? 'null');
  if (typeof value !== 'object' || value === null) return null;
  const settings = value as Record<string, unknown>;
  const volume = settings.volume as Record<string, unknown> | null;
  const openInterest = settings.openInterest as Record<string, unknown> | null;
  if (
    !volume ||
    typeof volume.visible !== 'boolean' ||
    !isColor(volume.upColor) ||
    !isColor(volume.downColor) ||
    !openInterest ||
    typeof openInterest.visible !== 'boolean' ||
    !isColor(openInterest.color)
  )
    return null;
  const defaults = defaultChartIndicatorSettings();
  return {
    volume: {
      visible: volume.visible,
      upColor: volume.upColor,
      downColor: volume.downColor,
      height: defaults.volume.height,
    },
    openInterest: {
      visible: openInterest.visible,
      color: openInterest.color,
      height: defaults.openInterest.height,
    },
  };
}

export function loadChartIndicatorSettings(): ChartIndicatorSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHART_INDICATOR_SETTINGS_KEY) ?? 'null');
    if (isChartIndicatorSettings(value)) return value;
    return loadLegacySettings() ?? defaultChartIndicatorSettings();
  } catch {
    return defaultChartIndicatorSettings();
  }
}

export function saveChartIndicatorSettings(settings: ChartIndicatorSettings) {
  try {
    localStorage.setItem(CHART_INDICATOR_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings remain active for the current session when storage is unavailable.
  }
}

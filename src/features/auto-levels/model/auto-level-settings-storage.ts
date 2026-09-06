import {
  DEFAULT_AUTO_LEVEL_SETTINGS,
  autoLevelIntervals,
  type AutoLevelSettings,
} from '../../../entities/auto-level';

const AUTO_LEVEL_SETTINGS_KEY = 'pulse-terminal:auto-levels:settings:v4';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);

function isAutoLevelSettings(value: unknown): value is AutoLevelSettings {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  const enabledDetectors = settings.enabledDetectors;
  const enabledTypes = settings.enabledTypes;
  const colors = settings.colors;
  return (
    isBoolean(settings.enabled) &&
    typeof settings.interval === 'string' &&
    autoLevelIntervals.includes(settings.interval as AutoLevelSettings['interval']) &&
    (settings.historySize === 300 || settings.historySize === 600 || settings.historySize === 1000) &&
    typeof settings.minTouches === 'number' &&
    Number.isInteger(settings.minTouches) &&
    settings.minTouches >= 2 &&
    settings.minTouches <= 6 &&
    typeof settings.deviationPercent === 'number' &&
    settings.deviationPercent >= 0.05 &&
    settings.deviationPercent <= 2 &&
    isBoolean(settings.nearPriceOnly) &&
    typeof settings.maxDistancePercent === 'number' &&
    settings.maxDistancePercent >= 0.1 &&
    settings.maxDistancePercent <= 5 &&
    typeof enabledDetectors === 'object' &&
    enabledDetectors !== null &&
    isBoolean((enabledDetectors as Record<string, unknown>).breakout) &&
    isBoolean((enabledDetectors as Record<string, unknown>).extremum) &&
    (settings.extremumHistorySize === 200 ||
      settings.extremumHistorySize === 500 ||
      settings.extremumHistorySize === 1500) &&
    (settings.extremumMinTouches === 1 ||
      settings.extremumMinTouches === 2 ||
      settings.extremumMinTouches === 3) &&
    (settings.extremumStrength === 'weak' ||
      settings.extremumStrength === 'medium' ||
      settings.extremumStrength === 'strong') &&
    (settings.extremumLimit === 3 ||
      settings.extremumLimit === 5 ||
      settings.extremumLimit === 7 ||
      settings.extremumLimit === 10) &&
    isBoolean(settings.showBrokenExtremums) &&
    isColor(settings.extremumColor) &&
    typeof enabledTypes === 'object' &&
    enabledTypes !== null &&
    isBoolean((enabledTypes as Record<string, unknown>).support) &&
    isBoolean((enabledTypes as Record<string, unknown>).resistance) &&
    isBoolean((enabledTypes as Record<string, unknown>).trend) &&
    typeof colors === 'object' &&
    colors !== null &&
    isColor((colors as Record<string, unknown>).support) &&
    isColor((colors as Record<string, unknown>).resistance) &&
    (settings.lineWidth === 1 ||
      settings.lineWidth === 2 ||
      settings.lineWidth === 3 ||
      settings.lineWidth === 4) &&
    isBoolean(settings.showLabels) &&
    isBoolean(settings.hideWeak)
  );
}

const defaultSettings = (): AutoLevelSettings => ({
  ...DEFAULT_AUTO_LEVEL_SETTINGS,
  enabledDetectors: { ...DEFAULT_AUTO_LEVEL_SETTINGS.enabledDetectors },
  enabledTypes: { ...DEFAULT_AUTO_LEVEL_SETTINGS.enabledTypes },
  colors: { ...DEFAULT_AUTO_LEVEL_SETTINGS.colors },
});

export function loadAutoLevelSettings(): AutoLevelSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(AUTO_LEVEL_SETTINGS_KEY) ?? 'null');
    return isAutoLevelSettings(value) ? value : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveAutoLevelSettings(settings: AutoLevelSettings) {
  try {
    localStorage.setItem(AUTO_LEVEL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings remain active for the current session when storage is unavailable.
  }
}

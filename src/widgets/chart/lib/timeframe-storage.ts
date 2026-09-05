import { timeframes } from './timeframes';

const STORAGE_KEY = 'pulse-terminal:chart-timeframe';
const DEFAULT_TIMEFRAME = '1м';

export function loadChartTimeframe() {
  try {
    const timeframe = localStorage.getItem(STORAGE_KEY);
    return timeframe && timeframes.includes(timeframe) ? timeframe : DEFAULT_TIMEFRAME;
  } catch {
    return DEFAULT_TIMEFRAME;
  }
}

export function saveChartTimeframe(timeframe: string) {
  try {
    localStorage.setItem(STORAGE_KEY, timeframe);
  } catch {
    // The current selection remains active when browser storage is unavailable.
  }
}

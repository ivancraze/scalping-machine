import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  removeSavedLineTools,
  restoreLineTools,
  saveLineTools,
  type LineToolsStorageScope,
} from './line-tools-storage';

const btcMinute: LineToolsStorageScope = {
  exchange: 'binance-usdm',
  symbol: 'BTCUSDT',
  interval: '1m',
};
const btcHour: LineToolsStorageScope = { ...btcMinute, interval: '1h' };

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

afterEach(() => storage.clear());

describe('line tools storage', () => {
  it('restores only the saved exchange, symbol, and interval layout', () => {
    const lineTools = [{ id: 'line-1', toolType: 'HorizontalLine', points: [], options: {} }];
    const importer = { importLineTools: vi.fn() };

    saveLineTools({ exportLineTools: () => JSON.stringify(lineTools) }, btcMinute);
    restoreLineTools(importer, btcHour);
    restoreLineTools(importer, btcMinute);

    expect(importer.importLineTools).toHaveBeenCalledTimes(1);
    expect(importer.importLineTools).toHaveBeenCalledWith(JSON.stringify(lineTools));
  });

  it('removes only the current chart layout', () => {
    const lineTools = '[{"id":"line-1","toolType":"HorizontalLine","points":[],"options":{}}]';
    const minuteImporter = { importLineTools: vi.fn() };
    const hourImporter = { importLineTools: vi.fn() };

    saveLineTools({ exportLineTools: () => lineTools }, btcMinute);
    saveLineTools({ exportLineTools: () => lineTools }, btcHour);
    removeSavedLineTools(btcMinute);
    restoreLineTools(minuteImporter, btcMinute);
    restoreLineTools(hourImporter, btcHour);

    expect(minuteImporter.importLineTools).not.toHaveBeenCalled();
    expect(hourImporter.importLineTools).toHaveBeenCalledWith(lineTools);
  });
});

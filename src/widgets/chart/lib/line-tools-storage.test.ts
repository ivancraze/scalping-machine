import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  removeSavedLineTools,
  restoreLineTools,
  saveLineTools,
  subscribeToLineTools,
  type LineToolsStorageScope,
} from './line-tools-storage';

const btc: LineToolsStorageScope = { exchange: 'binance-usdm', symbol: 'BTCUSDT' };
const eth: LineToolsStorageScope = { exchange: 'binance-usdm', symbol: 'ETHUSDT' };
const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  get length() {
    return storage.size;
  },
  key: (index: number) => [...storage.keys()][index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

afterEach(() => storage.clear());

describe('line tools storage', () => {
  it('restores one shared layout for every timeframe of a pair', () => {
    const lineTools = [{ id: 'line-1', toolType: 'HorizontalLine', points: [], options: {} }];
    const importer = { importLineTools: vi.fn() };

    saveLineTools({ exportLineTools: () => JSON.stringify(lineTools) }, btc, '15m-chart');
    restoreLineTools(importer, btc, '1m');
    restoreLineTools(importer, eth, '1m');

    expect(importer.importLineTools).toHaveBeenCalledTimes(1);
    expect(importer.importLineTools).toHaveBeenCalledWith(JSON.stringify(lineTools));
  });

  it('migrates legacy timeframe layouts, prioritizing the current timeframe', () => {
    const minuteLine = { id: 'shared', toolType: 'HorizontalLine', points: [], options: { color: 'blue' } };
    const fifteenMinuteLine = { ...minuteLine, options: { color: 'purple' } };
    const uniqueLine = { id: 'unique', toolType: 'TrendLine', points: [], options: {} };
    const importer = { importLineTools: vi.fn() };
    storage.set(
      'pulse-terminal:line-tools:v1:binance-usdm:BTCUSDT:1m',
      JSON.stringify({ ...btc, version: 1, interval: '1m', lineTools: [minuteLine] }),
    );
    storage.set(
      'pulse-terminal:line-tools:v1:binance-usdm:BTCUSDT:15m',
      JSON.stringify({ ...btc, version: 1, interval: '15m', lineTools: [fifteenMinuteLine, uniqueLine] }),
    );

    restoreLineTools(importer, btc, '15m');

    expect(importer.importLineTools).toHaveBeenCalledWith(JSON.stringify([fifteenMinuteLine, uniqueLine]));
    expect(storage.has('pulse-terminal:line-tools:v1:binance-usdm:BTCUSDT:1m')).toBe(false);
    expect(storage.has('pulse-terminal:line-tools:v1:binance-usdm:BTCUSDT:15m')).toBe(false);
  });

  it('publishes saves and resets only to charts of the same pair', () => {
    const btcListener = vi.fn();
    const ethListener = vi.fn();
    const stopBtc = subscribeToLineTools(btc, btcListener);
    const stopEth = subscribeToLineTools(eth, ethListener);
    const lineTools = [{ id: 'line-1', toolType: 'HorizontalLine', points: [], options: {} }];

    saveLineTools({ exportLineTools: () => JSON.stringify(lineTools) }, btc, '15m-chart');
    removeSavedLineTools(btc, '1m-chart');
    stopBtc();
    stopEth();

    expect(btcListener).toHaveBeenNthCalledWith(1, { sourceId: '15m-chart', lineTools });
    expect(btcListener).toHaveBeenNthCalledWith(2, { sourceId: '1m-chart', lineTools: null });
    expect(ethListener).not.toHaveBeenCalled();
  });
});

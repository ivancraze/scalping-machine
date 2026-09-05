// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from '../../../entities/market';
import { restoreLineTools, saveLineTools } from '../lib/line-tools-storage';
import { ChartCanvas } from './ChartCanvas';

const mocks = vi.hoisted(() => {
  const scale = {
    applyOptions: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn(),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
    getVisibleLogicalRange: vi.fn(() => ({ from: 1, to: 3 })),
    setVisibleLogicalRange: vi.fn(),
    scrollToRealTime: vi.fn(),
  };
  const series = () => ({
    setData: vi.fn(),
    update: vi.fn(),
    applyOptions: vi.fn(),
    priceScale: () => scale,
    barsInLogicalRange: vi.fn(() => ({ barsBefore: 1000, barsAfter: 1 })),
  });
  const candle = series();
  const volume = series();
  const chart = {
    addSeries: vi.fn(),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => scale,
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  };
  const lineTools = {
    setMagnetThreshold: vi.fn(),
    subscribeLineToolsAfterEdit: vi.fn(),
    removeSelectedLineTools: vi.fn(),
    removeAllLineTools: vi.fn(),
    importLineTools: vi.fn(),
    exportLineTools: vi.fn(() => '[]'),
    addLineTool: vi.fn(),
    destroy: vi.fn(),
  };
  return { scale, candle, volume, chart, lineTools, createChart: vi.fn(() => chart) };
});

vi.mock('lightweight-charts', () => ({
  createChart: mocks.createChart,
  CandlestickSeries: {},
  HistogramSeries: {},
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
}));
vi.mock('lightweight-charts-line-tools-core', () => ({ createLineToolsPlugin: () => mocks.lineTools }));
vi.mock('../lib/register-tools', () => ({ registerTools: vi.fn() }));

const btc = { exchange: 'binance-usdm', symbol: 'BTCUSDT', interval: '1m' };
const eth = { ...btc, symbol: 'ETHUSDT' };
const candles: Candle[] = [
  [1_757_030_400_000, '100', '110', '90', '105', '50'],
  [1_757_030_460_000, '105', '115', '95', '110', '60'],
];
const noop = () => {};
const props: ComponentProps<typeof ChartCanvas> = {
  palette: {
    background: '#111111',
    text: '#eeeeee',
    grid: '#222222',
    border: '#333333',
    crosshair: '#aaaaaa',
  },
  candles,
  latestCandles: [],
  dataKey: 'BTCUSDT:1m',
  priceTickSize: '0.01',
  onCandleChange: noop,
  drawingRequest: 0,
  isDrawingMenuOpen: false,
  onDrawingComplete: noop,
  canLoadNewer: false,
  canLoadOlder: false,
  isLoadingNewer: false,
  isLoadingOlder: false,
  onLoadNewer: noop,
  onLoadOlder: noop,
  tool: null,
  lineToolsStorageScope: btc,
  resetRequest: 0,
};

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.chart.addSeries.mockReturnValueOnce(mocks.candle).mockReturnValueOnce(mocks.volume);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('chart UI migration regressions', () => {
  it('switches theme without recreating the chart, replacing data, resetting range or drawings', async () => {
    await act(() => root.render(<ChartCanvas {...props} />));
    const dataCalls = mocks.candle.setData.mock.calls.length;
    const volumeDataCalls = mocks.volume.setData.mock.calls.length;
    const clearCalls = mocks.lineTools.removeAllLineTools.mock.calls.length;
    const rangeCalls = mocks.scale.setVisibleLogicalRange.mock.calls.length;
    const subscriptions = mocks.chart.subscribeCrosshairMove.mock.calls.length;

    const light = { ...props.palette, background: '#ffffff', text: '#111111' };
    await act(() => root.render(<ChartCanvas {...props} palette={light} />));

    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(mocks.chart.remove).not.toHaveBeenCalled();
    expect(mocks.candle.setData).toHaveBeenCalledTimes(dataCalls);
    expect(mocks.volume.setData).toHaveBeenCalledTimes(volumeDataCalls);
    expect(mocks.lineTools.removeAllLineTools).toHaveBeenCalledTimes(clearCalls);
    expect(mocks.scale.setVisibleLogicalRange).toHaveBeenCalledTimes(rangeCalls);
    expect(mocks.chart.subscribeCrosshairMove).toHaveBeenCalledTimes(subscriptions);
    expect(mocks.chart.applyOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#111111' },
      }),
    );

    const live: Candle = [1_757_030_520_000, '110', '120', '100', '115', '70'];
    await act(() => root.render(<ChartCanvas {...props} palette={light} latestCandles={[live]} />));
    expect(mocks.candle.update).toHaveBeenCalledWith(expect.objectContaining({ close: 115 }));
    expect(mocks.candle.setData).toHaveBeenCalledTimes(dataCalls);
  });

  it('consumes a reset once and preserves another chart’s saved drawings after switching symbols', async () => {
    const drawing = '[{"id":"saved-line","toolType":"HorizontalLine","points":[],"options":{}}]';
    saveLineTools({ exportLineTools: () => drawing }, btc);
    saveLineTools({ exportLineTools: () => drawing }, eth);
    await act(() => root.render(<ChartCanvas {...props} />));
    await act(() => root.render(<ChartCanvas {...props} resetRequest={1} />));
    const btcImporter = { importLineTools: vi.fn() };
    restoreLineTools(btcImporter, btc);
    expect(btcImporter.importLineTools).not.toHaveBeenCalled();

    const clearCalls = mocks.lineTools.removeAllLineTools.mock.calls.length;
    mocks.lineTools.importLineTools.mockClear();
    await act(() =>
      root.render(
        <ChartCanvas {...props} resetRequest={1} dataKey="ETHUSDT:1m" lineToolsStorageScope={eth} />,
      ),
    );
    // Switching charts clears the previous visible layout once, then restores the new one.
    expect(mocks.lineTools.removeAllLineTools).toHaveBeenCalledTimes(clearCalls + 1);
    expect(mocks.lineTools.importLineTools).toHaveBeenCalledWith(drawing);
    const ethImporter = { importLineTools: vi.fn() };
    restoreLineTools(ethImporter, eth);
    expect(ethImporter.importLineTools).toHaveBeenCalledWith(drawing);
  });
});

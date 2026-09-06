// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from '../../../entities/market';
import { GridChartCanvas } from './GridChartCanvas';

const mocks = vi.hoisted(() => {
  const series = () => ({
    setData: vi.fn(),
    update: vi.fn(),
    applyOptions: vi.fn(),
    moveToPane: vi.fn(),
  });
  const candle = series();
  const openInterest = series();
  const volume = series();
  const panes = [{ setStretchFactor: vi.fn() }, { setStretchFactor: vi.fn() }, { setStretchFactor: vi.fn() }];
  const chart = {
    addSeries: vi.fn(),
    removeSeries: vi.fn(),
    panes: () => panes,
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => scale,
  };
  const scale = { fitContent: vi.fn() };
  const disconnect = vi.fn();
  return { candle, openInterest, volume, chart, scale, disconnect, createChart: vi.fn(() => chart) };
});

vi.mock('lightweight-charts', () => ({
  createChart: mocks.createChart,
  CandlestickSeries: {},
  HistogramSeries: {},
  LineSeries: {},
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3 },
}));

const candles: Candle[] = [
  [1_757_030_400_000, '100', '110', '90', '105', '50'],
  [1_757_030_460_000, '105', '115', '95', '110', '60'],
];
const props: ComponentProps<typeof GridChartCanvas> = {
  palette: {
    background: '#111111',
    text: '#eeeeee',
    grid: '#222222',
    border: '#333333',
    crosshair: '#aaaaaa',
  },
  candles,
  openInterest: [{ timestamp: 1_757_030_400_000, valueUsd: 500_000_000 }],
  dataKey: 'BTCUSDT:1m',
  volumeVisible: true,
  openInterestVisible: true,
  openInterestPeriod: '5м',
  openInterestPeriodMs: 5 * 60_000,
  priceTickSize: '0.001',
  currentPrice: 110,
};

let root: Root;
let container: HTMLDivElement;
let mounted: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.chart.addSeries
    .mockReturnValueOnce(mocks.candle)
    .mockReturnValueOnce(mocks.openInterest)
    .mockReturnValueOnce(mocks.volume);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {
        mocks.disconnect();
      }
    },
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('grid chart canvas lifecycle', () => {
  it('adapts price precision without recreating the chart', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));

    expect(mocks.candle.applyOptions).toHaveBeenLastCalledWith({
      priceFormat: { type: 'price', minMove: 0.01, precision: 2 },
    });

    await act(() =>
      root.render(<GridChartCanvas {...props} priceTickSize="0.00000001" currentPrice={0.00001234} />),
    );

    expect(mocks.createChart).toHaveBeenCalledOnce();
    expect(mocks.candle.applyOptions).toHaveBeenLastCalledWith({
      priceFormat: { type: 'price', minMove: 0.00000001, precision: 8 },
    });
  });

  it('updates live candles incrementally without recreating the chart', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));
    const live: Candle = [1_757_030_460_000, '105', '120', '95', '115', '70'];

    await act(() => root.render(<GridChartCanvas {...props} candles={[candles[0], live]} />));

    expect(mocks.createChart).toHaveBeenCalledOnce();
    expect(mocks.candle.setData).toHaveBeenCalledOnce();
    expect(mocks.candle.update).toHaveBeenCalledWith(expect.objectContaining({ close: 115 }));
    expect(mocks.volume.update).toHaveBeenCalled();
  });

  it('replaces data for a new timeframe without recreating the chart instance', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));
    const fiveMinuteCandles: Candle[] = [
      [1_757_030_400_000, '100', '120', '90', '115', '100'],
      [1_757_030_700_000, '115', '125', '110', '120', '80'],
    ];

    await act(() =>
      root.render(<GridChartCanvas {...props} dataKey="BTCUSDT:5m" candles={fiveMinuteCandles} />),
    );

    expect(mocks.createChart).toHaveBeenCalledOnce();
    expect(mocks.chart.remove).not.toHaveBeenCalled();
    expect(mocks.candle.setData).toHaveBeenCalledTimes(2);
    expect(mocks.candle.setData).toHaveBeenLastCalledWith([
      expect.objectContaining({ time: 1_757_030_400, close: 115 }),
      expect.objectContaining({ time: 1_757_030_700, close: 120 }),
    ]);
    expect(mocks.scale.fitContent).toHaveBeenCalledTimes(2);
  });

  it('backfills candle volumes when the volume pane is enabled again', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));
    await act(() => root.render(<GridChartCanvas {...props} volumeVisible={false} />));
    mocks.chart.addSeries.mockReturnValueOnce(mocks.volume);
    mocks.volume.setData.mockClear();

    await act(() => root.render(<GridChartCanvas {...props} volumeVisible />));

    expect(mocks.createChart).toHaveBeenCalledOnce();
    expect(mocks.volume.setData).toHaveBeenCalledOnce();
    expect(mocks.volume.setData).toHaveBeenCalledWith([
      expect.objectContaining({ time: 1_757_030_400, value: 50 }),
      expect.objectContaining({ time: 1_757_030_460, value: 60 }),
    ]);
  });

  it('replaces series data and recalculates OI when history is structurally backfilled', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));
    const older: Candle = [1_757_030_340_000, '95', '102', '90', '100', '40'];
    mocks.candle.setData.mockClear();
    mocks.openInterest.setData.mockClear();

    await act(() => root.render(<GridChartCanvas {...props} candles={[older, ...candles]} />));

    expect(mocks.candle.setData).toHaveBeenCalledOnce();
    expect(mocks.candle.setData).toHaveBeenCalledWith([
      expect.objectContaining({ time: 1_757_030_340, close: 100 }),
      expect.objectContaining({ time: 1_757_030_400, close: 105 }),
      expect.objectContaining({ time: 1_757_030_460, close: 110 }),
    ]);
    expect(mocks.openInterest.setData).toHaveBeenCalledOnce();
  });

  it('removes chart and disconnects resize observation on unmount', async () => {
    await act(() => root.render(<GridChartCanvas {...props} />));

    await act(() => root.unmount());
    mounted = false;

    expect(mocks.chart.remove).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
});

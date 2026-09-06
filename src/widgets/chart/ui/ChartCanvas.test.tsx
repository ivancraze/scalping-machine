// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from '../../../entities/market';
import { DEFAULT_AUTO_LEVEL_SETTINGS, type DetectedAutoLevel } from '../../../entities/auto-level';
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
    moveToPane: vi.fn(),
  });
  const candle = series();
  const volume = series();
  const openInterest = series();
  const panes = [
    { setHeight: vi.fn(), setStretchFactor: vi.fn(), getHeight: vi.fn(() => 400) },
    { setHeight: vi.fn(), setStretchFactor: vi.fn(), getHeight: vi.fn(() => 72) },
    { setHeight: vi.fn(), setStretchFactor: vi.fn(), getHeight: vi.fn(() => 112) },
  ];
  const chart = {
    addSeries: vi.fn(),
    removeSeries: vi.fn(),
    panes: () => panes,
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => scale,
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  };
  const lineTools = {
    setMagnetThreshold: vi.fn(),
    subscribeLineToolsAfterEdit: vi.fn(),
    unsubscribeLineToolsAfterEdit: vi.fn(),
    subscribeLineToolsSingleClick: vi.fn(),
    unsubscribeLineToolsSingleClick: vi.fn(),
    removeSelectedLineTools: vi.fn(),
    removeAllLineTools: vi.fn(),
    removeLineToolsById: vi.fn(),
    importLineTools: vi.fn(),
    exportLineTools: vi.fn(() => '[]'),
    getSelectedLineTools: vi.fn(() => '[]'),
    getLineToolsByIdRegex: vi.fn(() => '[]'),
    addLineTool: vi.fn(),
    createOrUpdateLineTool: vi.fn(),
    destroy: vi.fn(),
  };
  return { scale, candle, volume, openInterest, panes, chart, lineTools, createChart: vi.fn(() => chart) };
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
  indicatorSettings: {
    volume: { visible: true, upColor: '#09825f', downColor: '#a7294a', height: 112 },
    openInterest: { visible: true, color: '#0f8bfd', height: 72 },
  },
  openInterest: [],
  latestOpenInterest: null,
  openInterestPeriod: '5м',
  openInterestPeriodMs: 5 * 60_000,
  onIndicatorHeightsChange: noop,
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
  autoLevels: [],
  autoLevelSettings: DEFAULT_AUTO_LEVEL_SETTINGS,
  onAutoLevelSelected: noop,
  onAutoLevelEdited: noop,
  onAutoLevelDeleted: noop,
};

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.panes[0].getHeight.mockReturnValue(400);
  mocks.panes[1].getHeight.mockReturnValue(72);
  mocks.panes[2].getHeight.mockReturnValue(112);
  mocks.chart.addSeries
    .mockReturnValueOnce(mocks.candle)
    .mockReturnValueOnce(mocks.openInterest)
    .mockReturnValueOnce(mocks.volume);
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

  it('toggles native indicator panes without recreating the chart or changing the visible range', async () => {
    await act(() => root.render(<ChartCanvas {...props} />));
    const rangeCalls = mocks.scale.setVisibleLogicalRange.mock.calls.length;
    const withoutOpenInterest = {
      ...props.indicatorSettings,
      openInterest: { ...props.indicatorSettings.openInterest, visible: false },
    };

    await act(() => root.render(<ChartCanvas {...props} indicatorSettings={withoutOpenInterest} />));

    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(mocks.chart.removeSeries).toHaveBeenCalledWith(mocks.openInterest);
    expect(mocks.volume.moveToPane).toHaveBeenLastCalledWith(1);
    expect(mocks.scale.setVisibleLogicalRange).toHaveBeenCalledTimes(rangeCalls);
  });

  it('reports user-resized indicator pane heights', async () => {
    const onIndicatorHeightsChange = vi.fn();
    await act(() =>
      root.render(<ChartCanvas {...props} onIndicatorHeightsChange={onIndicatorHeightsChange} />),
    );
    const chartElement = container.firstElementChild;
    expect(chartElement).not.toBeNull();

    await act(() => chartElement?.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    mocks.panes[1].getHeight.mockReturnValue(140);
    mocks.panes[2].getHeight.mockReturnValue(180);
    await act(() => window.dispatchEvent(new Event('pointerup')));

    expect(onIndicatorHeightsChange).toHaveBeenCalledWith({ openInterest: 140, volume: 180 });
  });

  it('restores persisted pane heights and applies defaults after reset', async () => {
    const resizedSettings = {
      volume: { ...props.indicatorSettings.volume, height: 180 },
      openInterest: { ...props.indicatorSettings.openInterest, height: 140 },
    };

    await act(() => root.render(<ChartCanvas {...props} indicatorSettings={resizedSettings} />));

    expect(mocks.panes[0].setStretchFactor).toHaveBeenLastCalledWith(264);
    expect(mocks.panes[1].setStretchFactor).toHaveBeenLastCalledWith(140);
    expect(mocks.panes[2].setStretchFactor).toHaveBeenLastCalledWith(180);

    await act(() => root.render(<ChartCanvas {...props} />));

    expect(mocks.panes[0].setStretchFactor).toHaveBeenLastCalledWith(400);
    expect(mocks.panes[1].setStretchFactor).toHaveBeenLastCalledWith(72);
    expect(mocks.panes[2].setStretchFactor).toHaveBeenLastCalledWith(112);
  });

  it('restores a removed indicator series and its data without recreating the chart', async () => {
    const history = [{ timestamp: 1_757_030_400_000, valueUsd: 500_000_000 }];
    await act(() => root.render(<ChartCanvas {...props} openInterest={history} />));
    const withoutOpenInterest = {
      ...props.indicatorSettings,
      openInterest: { ...props.indicatorSettings.openInterest, visible: false },
    };
    await act(() =>
      root.render(<ChartCanvas {...props} openInterest={history} indicatorSettings={withoutOpenInterest} />),
    );
    mocks.chart.addSeries.mockReturnValueOnce(mocks.openInterest);
    mocks.openInterest.setData.mockClear();

    await act(() => root.render(<ChartCanvas {...props} openInterest={history} />));

    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(mocks.chart.addSeries).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 1);
    expect(mocks.openInterest.setData).toHaveBeenCalledWith([{ time: 1_757_030_400, value: 500_000_000 }]);
  });

  it('loads and incrementally updates open interest in its own pane', async () => {
    const openInterestCandles: Candle[] = [candles[0], [1_757_030_700_000, '110', '120', '100', '115', '70']];
    const history = [
      { timestamp: 1_757_030_400_000, valueUsd: 500_000_000 },
      { timestamp: 1_757_030_700_000, valueUsd: 510_000_000 },
    ];
    await act(() =>
      root.render(<ChartCanvas {...props} candles={openInterestCandles} openInterest={history} />),
    );

    expect(mocks.openInterest.moveToPane).toHaveBeenCalledWith(1);
    expect(mocks.volume.moveToPane).toHaveBeenCalledWith(2);
    expect(mocks.openInterest.setData).toHaveBeenCalledWith([
      { time: 1_757_030_400, value: 500_000_000 },
      { time: 1_757_030_700, value: 510_000_000 },
    ]);

    const liveCandle: Candle = [1_757_031_000_000, '115', '125', '105', '120', '80'];
    const latest = { timestamp: 1_757_031_030_000, valueUsd: 520_000_000 };
    await act(() =>
      root.render(
        <ChartCanvas
          {...props}
          candles={openInterestCandles}
          latestCandles={[liveCandle]}
          openInterest={history}
          latestOpenInterest={latest}
        />,
      ),
    );
    expect(mocks.openInterest.update).toHaveBeenLastCalledWith({
      time: 1_757_031_000,
      value: 520_000_000,
    });
  });

  it('does not add a live OI timestamp before a matching candle exists', async () => {
    const futureBucketSnapshot = {
      timestamp: 1_757_031_030_000,
      valueUsd: 520_000_000,
    };

    await act(() => root.render(<ChartCanvas {...props} latestOpenInterest={futureBucketSnapshot} />));

    expect(mocks.openInterest.update).not.toHaveBeenCalled();
  });

  it('changes volume colors without replacing candle history', async () => {
    await act(() => root.render(<ChartCanvas {...props} />));
    const candleDataCalls = mocks.candle.setData.mock.calls.length;
    const volumeDataCalls = mocks.volume.setData.mock.calls.length;

    await act(() =>
      root.render(
        <ChartCanvas
          {...props}
          indicatorSettings={{
            ...props.indicatorSettings,
            volume: { ...props.indicatorSettings.volume, upColor: '#00ff00' },
          }}
        />,
      ),
    );

    expect(mocks.candle.setData).toHaveBeenCalledTimes(candleDataCalls);
    expect(mocks.volume.setData).toHaveBeenCalledTimes(volumeDataCalls + 1);
  });

  it('changes pane heights without replacing volume history', async () => {
    await act(() => root.render(<ChartCanvas {...props} />));
    const volumeDataCalls = mocks.volume.setData.mock.calls.length;

    await act(() =>
      root.render(
        <ChartCanvas
          {...props}
          indicatorSettings={{
            volume: { ...props.indicatorSettings.volume, height: 180 },
            openInterest: { ...props.indicatorSettings.openInterest, height: 140 },
          }}
        />,
      ),
    );

    expect(mocks.volume.setData).toHaveBeenCalledTimes(volumeDataCalls);
  });

  it('consumes a reset once and preserves another chart’s saved drawings after switching symbols', async () => {
    const drawing = '[{"id":"saved-line","toolType":"HorizontalLine","points":[],"options":{}}]';
    saveLineTools({ exportLineTools: () => drawing }, btc, 'btc-chart');
    saveLineTools({ exportLineTools: () => drawing }, eth, 'eth-chart');
    await act(() => root.render(<ChartCanvas {...props} />));
    await act(() => root.render(<ChartCanvas {...props} resetRequest={1} />));
    const btcImporter = { importLineTools: vi.fn() };
    restoreLineTools(btcImporter, btc, '1m');
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
    restoreLineTools(ethImporter, eth, '1m');
    expect(ethImporter.importLineTools).toHaveBeenCalledWith(drawing);
  });

  it('applies drawing changes published by another chart of the same pair', async () => {
    const drawing = '[{"id":"shared-line","toolType":"HorizontalLine","points":[],"options":{}}]';
    await act(() => root.render(<ChartCanvas {...props} />));
    mocks.lineTools.removeAllLineTools.mockClear();
    mocks.lineTools.importLineTools.mockClear();

    await act(async () => {
      saveLineTools({ exportLineTools: () => drawing }, btc, '15m-chart');
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });

    expect(mocks.lineTools.exportLineTools).toHaveBeenCalled();
    expect(mocks.lineTools.removeAllLineTools).not.toHaveBeenCalled();
    expect(mocks.lineTools.importLineTools).toHaveBeenCalledWith(drawing);
  });

  it('shifts the visible range by one bar without returning to realtime when a live candle is appended', async () => {
    await act(() => root.render(<ChartCanvas {...props} />));
    mocks.scale.scrollToRealTime.mockClear();
    mocks.scale.setVisibleLogicalRange.mockClear();
    mocks.scale.getVisibleLogicalRange.mockReturnValue({ from: 4, to: 8 });

    const live: Candle = [1_757_030_520_000, '110', '120', '100', '115', '70'];
    await act(() => root.render(<ChartCanvas {...props} latestCandles={[live]} />));

    expect(mocks.candle.update).toHaveBeenCalledWith(expect.objectContaining({ close: 115 }));
    expect(mocks.scale.scrollToRealTime).not.toHaveBeenCalled();
    expect(mocks.scale.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 5, to: 9 });
  });

  it('preserves visible-bar count and right offset when switching instruments', async () => {
    const previousCandles = Array.from({ length: 12 }, (_, index): Candle => [
      1_757_030_400_000 + index * 60_000,
      '100',
      '110',
      '90',
      '105',
      '50',
    ]);
    const nextCandles = Array.from({ length: 20 }, (_, index): Candle => [
      1_757_040_400_000 + index * 60_000,
      '200',
      '210',
      '190',
      '205',
      '60',
    ]);
    mocks.scale.getVisibleLogicalRange.mockReturnValue({ from: 4, to: 8 });
    await act(() => root.render(<ChartCanvas {...props} candles={previousCandles} />));
    mocks.scale.setVisibleLogicalRange.mockClear();

    await act(() =>
      root.render(
        <ChartCanvas {...props} candles={nextCandles} dataKey="ETHUSDT:1m" lineToolsStorageScope={eth} />,
      ),
    );

    expect(mocks.scale.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 12, to: 16 });
    expect(mocks.scale.applyOptions).toHaveBeenCalledWith({ autoScale: true });
  });

  it('preserves the right offset after the outgoing instrument receives a live bar', async () => {
    const previousCandles = Array.from({ length: 12 }, (_, index): Candle => [
      1_757_030_400_000 + index * 60_000,
      '100',
      '110',
      '90',
      '105',
      '50',
    ]);
    const nextCandles = Array.from({ length: 20 }, (_, index): Candle => [
      1_757_040_400_000 + index * 60_000,
      '200',
      '210',
      '190',
      '205',
      '60',
    ]);
    const live: Candle = [1_757_031_120_000, '105', '120', '100', '115', '70'];
    await act(() => root.render(<ChartCanvas {...props} candles={previousCandles} />));
    await act(() => root.render(<ChartCanvas {...props} candles={previousCandles} latestCandles={[live]} />));
    mocks.scale.getVisibleLogicalRange.mockReturnValue({ from: 8, to: 12 });
    mocks.scale.setVisibleLogicalRange.mockClear();

    await act(() =>
      root.render(
        <ChartCanvas
          {...props}
          candles={nextCandles}
          latestCandles={[]}
          dataKey="ETHUSDT:1m"
          lineToolsStorageScope={eth}
        />,
      ),
    );

    expect(mocks.scale.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 15, to: 19 });
  });

  it('does not scroll to realtime when the current live candle is replaced', async () => {
    mocks.candle.barsInLogicalRange.mockReturnValue({ barsBefore: 1000, barsAfter: 0 });
    await act(() => root.render(<ChartCanvas {...props} />));
    mocks.scale.scrollToRealTime.mockClear();

    const replacement: Candle = [1_757_030_460_000, '105', '118', '95', '114', '65'];
    await act(() => root.render(<ChartCanvas {...props} latestCandles={[replacement]} />));

    expect(mocks.candle.update).toHaveBeenCalledWith(expect.objectContaining({ close: 114 }));
    expect(mocks.scale.scrollToRealTime).not.toHaveBeenCalled();
  });

  it('creates native auto levels with stable ids and removes only obsolete auto levels', async () => {
    const autoLevel: DetectedAutoLevel = {
      id: 'pulse:auto-level:support:1:2',
      detector: 'breakout',
      kind: 'support',
      points: [{ timestamp: 1, price: 100 }],
      projectedPrice: 100,
      touches: 3,
      score: 70,
      weak: false,
      analysisInterval: '15m',
      frozen: false,
      distancePercent: 0.42,
      breakoutDirection: 'down',
      compression: true,
    };
    const trendLevel: DetectedAutoLevel = {
      ...autoLevel,
      id: 'pulse:auto-level:trend-support:1:2',
      kind: 'trend-support',
      points: [
        { timestamp: 1, price: 100 },
        { timestamp: 2, price: 101 },
      ],
      projectedPrice: 102,
    };
    const extremumLevel: DetectedAutoLevel = {
      ...autoLevel,
      id: 'pulse:auto-level:ex:resistance:3',
      detector: 'extremum',
      kind: 'resistance',
      points: [{ timestamp: 3, price: 110 }],
      projectedPrice: 110,
      touches: 2,
      zonePercent: 0.8,
      breakoutDirection: undefined,
      distancePercent: undefined,
      compression: undefined,
    };
    mocks.lineTools.getLineToolsByIdRegex.mockReturnValue(
      JSON.stringify([{ id: 'pulse:auto-level:resistance:old:level' }]),
    );

    await act(() =>
      root.render(<ChartCanvas {...props} autoLevels={[autoLevel, trendLevel, extremumLevel]} />),
    );

    expect(mocks.lineTools.removeLineToolsById).toHaveBeenCalledWith([
      'pulse:auto-level:resistance:old:level',
    ]);
    expect(mocks.lineTools.createOrUpdateLineTool).toHaveBeenCalledWith(
      'HorizontalRay',
      autoLevel.points,
      expect.objectContaining({
        ownerSourceId: 'pulse:auto-levels',
        line: expect.objectContaining({ extend: { left: false, right: true } }),
        text: expect.objectContaining({ value: expect.stringContaining('↓ пробой') }),
      }),
      autoLevel.id,
    );
    expect(mocks.lineTools.createOrUpdateLineTool).toHaveBeenCalledWith(
      'TrendLine',
      trendLevel.points,
      expect.objectContaining({ ownerSourceId: 'pulse:auto-levels' }),
      trendLevel.id,
    );
    expect(mocks.lineTools.createOrUpdateLineTool).toHaveBeenCalledWith(
      'HorizontalRay',
      extremumLevel.points,
      expect.objectContaining({
        showPriceAxisLabels: true,
        priceAxisLabelAlwaysVisible: true,
        line: expect.objectContaining({ color: '#969aa8', style: 0 }),
        text: expect.objectContaining({
          value: '',
          box: { alignment: { horizontal: 'left' } },
        }),
      }),
      extremumLevel.id,
    );
  });

  it('reports selection, edits and deletion of an auto level', async () => {
    const onAutoLevelSelected = vi.fn();
    const onAutoLevelEdited = vi.fn();
    const onAutoLevelDeleted = vi.fn();
    await act(() =>
      root.render(
        <ChartCanvas
          {...props}
          onAutoLevelSelected={onAutoLevelSelected}
          onAutoLevelEdited={onAutoLevelEdited}
          onAutoLevelDeleted={onAutoLevelDeleted}
        />,
      ),
    );
    const id = 'pulse:auto-level:support:1:2';
    const points = [{ timestamp: 1, price: 100 }];
    const select = mocks.lineTools.subscribeLineToolsSingleClick.mock.calls[0][0];
    const edit = mocks.lineTools.subscribeLineToolsAfterEdit.mock.calls[0][0];
    select({
      selectionState: 'selected',
      selectedLineTool: { id, points, options: {}, toolType: 'HorizontalRay' },
    });
    edit({
      stage: 'lineToolEdited',
      selectedLineTool: { id, points, options: {}, toolType: 'HorizontalRay' },
    });
    mocks.lineTools.getSelectedLineTools.mockReturnValue(JSON.stringify([{ id }]));
    container.querySelector('div')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    expect(onAutoLevelSelected).toHaveBeenCalledWith(id);
    expect(onAutoLevelEdited).toHaveBeenCalledWith(id, points);
    expect(onAutoLevelDeleted).toHaveBeenCalledWith(id);
  });
});

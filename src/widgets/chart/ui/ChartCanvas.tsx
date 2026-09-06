import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import {
  createLineToolsPlugin,
  type ILineToolsPlugin,
  type LineToolsAfterEditEventParams,
  type LineToolsSingleClickEventParams,
} from 'lightweight-charts-line-tools-core';
import {
  chartOptions,
  chartThemeOptions,
  candleOptions,
  openInterestOptions,
  volumeOptions,
} from '../lib/chart-options';
import {
  removeSavedLineTools,
  removeManualLineTools,
  restoreLineTools,
  saveLineTools,
  subscribeToLineTools,
  type LineToolsStorageScope,
} from '../lib/line-tools-storage';
import { syncAutoLevelLineTools } from '../lib/auto-level-line-tools';
import { registerTools } from '../lib/register-tools';
import { toCandlestick, toOpenInterestSeriesData, toVolume, priceFormat } from '../lib/series-data';
import type { Candle, OpenInterestPoint } from '../../../entities/market';
import type { ChartIndicatorHeights, ChartIndicatorSettings } from '../../../features/chart-indicators';
import {
  AUTO_LEVEL_ID_PREFIX,
  type AutoLevelPoint,
  type AutoLevelSettings,
  type DetectedAutoLevel,
} from '../../../entities/auto-level';
import type { ChartTool, ChartPalette } from '../model/types';
import styles from './ChartCanvas.module.scss';

type CandleSeries = ISeriesApi<'Candlestick', Time>;
type VolumeSeries = ISeriesApi<'Histogram', Time>;
type OpenInterestSeries = ISeriesApi<'Line', Time>;
type Viewport = { bars: number; rightOffset: number };
type IndicatorLayout = { volume: boolean; openInterest: boolean };

function lastLogicalIndex(candles: Candle[], latestCandles: Candle[]) {
  const historicalLastOpenTime = candles.at(-1)?.[0];
  if (historicalLastOpenTime === undefined) return -1;
  const newerLiveBars = new Set(
    latestCandles.filter((candle) => candle[0] > historicalLastOpenTime).map((candle) => candle[0]),
  ).size;
  return candles.length + newerLiveBars - 1;
}

function intervalFromDataKey(dataKey: string) {
  return dataKey.slice(dataKey.lastIndexOf(':') + 1);
}

function readIndicatorHeights(
  chart: IChartApi,
  layout: IndicatorLayout,
  fallback: ChartIndicatorHeights,
): ChartIndicatorHeights {
  const panes = chart.panes();
  return {
    openInterest: layout.openInterest
      ? Math.round(panes[1]?.getHeight() ?? fallback.openInterest)
      : fallback.openInterest,
    volume: layout.volume
      ? Math.round(panes[layout.openInterest ? 2 : 1]?.getHeight() ?? fallback.volume)
      : fallback.volume,
  };
}

function applyIndicatorHeights(chart: IChartApi, layout: IndicatorLayout, heights: ChartIndicatorHeights) {
  const panes = chart.panes();
  const totalHeight = panes.reduce((sum, pane) => sum + pane.getHeight(), 0);
  const indicatorHeight =
    (layout.openInterest ? heights.openInterest : 0) + (layout.volume ? heights.volume : 0);
  panes[0]?.setStretchFactor(Math.max(30, totalHeight - indicatorHeight));
  if (layout.openInterest) panes[1]?.setStretchFactor(heights.openInterest);
  if (layout.volume) panes[layout.openInterest ? 2 : 1]?.setStretchFactor(heights.volume);
}

export function ChartCanvas({
  palette,
  candles,
  latestCandles,
  indicatorSettings,
  openInterest,
  latestOpenInterest,
  openInterestPeriod,
  openInterestPeriodMs,
  onIndicatorHeightsChange,
  dataKey,
  priceTickSize,
  onCandleChange,
  drawingRequest,
  isDrawingMenuOpen,
  onDrawingComplete,
  canLoadNewer,
  canLoadOlder,
  isLoadingNewer,
  isLoadingOlder,
  onLoadNewer,
  onLoadOlder,
  tool,
  lineToolsStorageScope,
  resetRequest,
  autoLevels,
  autoLevelSettings,
  onAutoLevelSelected,
  onAutoLevelEdited,
  onAutoLevelDeleted,
}: {
  palette: ChartPalette;
  candles: Candle[];
  latestCandles: Candle[];
  indicatorSettings: ChartIndicatorSettings;
  openInterest: OpenInterestPoint[];
  latestOpenInterest: OpenInterestPoint | null;
  openInterestPeriod: string;
  openInterestPeriodMs: number;
  onIndicatorHeightsChange: (heights: ChartIndicatorHeights) => void;
  dataKey: string;
  priceTickSize?: string;
  onCandleChange: (candle: Candle | null) => void;
  drawingRequest: number;
  isDrawingMenuOpen: boolean;
  onDrawingComplete: () => void;
  canLoadNewer: boolean;
  canLoadOlder: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  onLoadNewer: () => void;
  onLoadOlder: () => void;
  tool: ChartTool;
  lineToolsStorageScope: LineToolsStorageScope;
  resetRequest: number;
  autoLevels: DetectedAutoLevel[];
  autoLevelSettings: AutoLevelSettings;
  onAutoLevelSelected: (id: string | null) => void;
  onAutoLevelEdited: (id: string, points: AutoLevelPoint[]) => void;
  onAutoLevelDeleted: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<CandleSeries | null>(null);
  const volumeRef = useRef<VolumeSeries | null>(null);
  const openInterestRef = useRef<OpenInterestSeries | null>(null);
  const lineToolsRef = useRef<ILineToolsPlugin | null>(null);
  const displayedDataKeyRef = useRef<string | null>(null);
  const hasInitialRangeRef = useRef(false);
  const pendingViewportRef = useRef<Viewport | null>(null);
  const previousCandlesRef = useRef<Candle[]>([]);
  const latestCandlesRef = useRef(latestCandles);
  const latestOpenInterestRef = useRef(latestOpenInterest);
  const volumeColorsRef = useRef({
    upColor: indicatorSettings.volume.upColor,
    downColor: indicatorSettings.volume.downColor,
  });
  const indicatorHeightsRef = useRef<ChartIndicatorHeights>({
    volume: indicatorSettings.volume.height,
    openInterest: indicatorSettings.openInterest.height,
  });
  const onIndicatorHeightsChangeRef = useRef(onIndicatorHeightsChange);
  const candlesByTimeRef = useRef(new Map<number, Candle>());
  const lastSeriesOpenTimeRef = useRef<number | null>(null);
  const lastSeriesLogicalIndexRef = useRef(-1);
  const displayedLineToolsStorageScopeRef = useRef<LineToolsStorageScope | null>(null);
  const lineToolsSourceId = useId();
  const pendingLineToolsSaveRef = useRef<number | null>(null);
  const persistLineToolsRef = useRef<() => void>(() => {});
  const pendingLineToolsSyncRef = useRef<unknown[] | null | undefined>(undefined);
  const pendingLineToolsSyncTimeoutRef = useRef<number | null>(null);
  const onDrawingCompleteRef = useRef(onDrawingComplete);
  const onCandleChangeRef = useRef(onCandleChange);
  const onAutoLevelSelectedRef = useRef(onAutoLevelSelected);
  const onAutoLevelEditedRef = useRef(onAutoLevelEdited);
  const onAutoLevelDeletedRef = useRef(onAutoLevelDeleted);
  const historyLoadingRef = useRef({
    canLoadNewer,
    canLoadOlder,
    isLoadingNewer,
    isLoadingOlder,
    onLoadNewer,
    onLoadOlder,
  });
  const [ready, setReady] = useState(false);
  const initialPaletteRef = useRef(palette);
  const handledResetRequestRef = useRef(0);
  const indicatorLayoutRef = useRef({ volume: false, openInterest: false });

  useEffect(() => {
    onDrawingCompleteRef.current = onDrawingComplete;
  }, [onDrawingComplete]);

  useEffect(() => {
    onCandleChangeRef.current = onCandleChange;
  }, [onCandleChange]);

  useEffect(() => {
    onAutoLevelSelectedRef.current = onAutoLevelSelected;
    onAutoLevelEditedRef.current = onAutoLevelEdited;
    onAutoLevelDeletedRef.current = onAutoLevelDeleted;
  }, [onAutoLevelDeleted, onAutoLevelEdited, onAutoLevelSelected]);

  useEffect(() => {
    latestCandlesRef.current = latestCandles;
  }, [latestCandles]);

  useEffect(() => {
    latestOpenInterestRef.current = latestOpenInterest;
  }, [latestOpenInterest]);

  useEffect(() => {
    volumeColorsRef.current = {
      upColor: indicatorSettings.volume.upColor,
      downColor: indicatorSettings.volume.downColor,
    };
  }, [indicatorSettings.volume.downColor, indicatorSettings.volume.upColor]);

  useEffect(() => {
    indicatorHeightsRef.current = {
      volume: indicatorSettings.volume.height,
      openInterest: indicatorSettings.openInterest.height,
    };
    onIndicatorHeightsChangeRef.current = onIndicatorHeightsChange;
  }, [indicatorSettings.openInterest.height, indicatorSettings.volume.height, onIndicatorHeightsChange]);

  useEffect(() => {
    historyLoadingRef.current = {
      canLoadNewer,
      canLoadOlder,
      isLoadingNewer,
      isLoadingOlder,
      onLoadNewer,
      onLoadOlder,
    };
  }, [canLoadNewer, canLoadOlder, isLoadingNewer, isLoadingOlder, onLoadNewer, onLoadOlder]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      ...chartOptions,
    });
    chart.applyOptions(chartThemeOptions(initialPaletteRef.current));
    const candleSeries = chart.addSeries(CandlestickSeries, candleOptions);
    const lineTools = createLineToolsPlugin(chart, candleSeries);
    registerTools(lineTools);
    lineTools.setMagnetThreshold(8);
    const persistLineTools = () => {
      const scope = displayedLineToolsStorageScopeRef.current;
      if (scope) saveLineTools(lineTools, scope, lineToolsSourceId);
    };
    persistLineToolsRef.current = () => {
      if (pendingLineToolsSaveRef.current !== null) {
        window.clearTimeout(pendingLineToolsSaveRef.current);
        pendingLineToolsSaveRef.current = null;
      }
      persistLineTools();
    };
    const afterEdit = ({ stage, selectedLineTool }: LineToolsAfterEditEventParams) => {
      if (pendingLineToolsSaveRef.current === null) {
        pendingLineToolsSaveRef.current = window.setTimeout(() => {
          pendingLineToolsSaveRef.current = null;
          persistLineTools();
        }, 16);
      }
      if (stage === 'lineToolEdited' && selectedLineTool.id.startsWith(AUTO_LEVEL_ID_PREFIX))
        onAutoLevelEditedRef.current(selectedLineTool.id, selectedLineTool.points);
      if (stage === 'lineToolFinished' || stage === 'pathFinished') onDrawingCompleteRef.current();
    };
    lineTools.subscribeLineToolsAfterEdit(afterEdit);
    const selectLineTool = ({ selectionState, selectedLineTool }: LineToolsSingleClickEventParams) => {
      const id = selectedLineTool.id;
      onAutoLevelSelectedRef.current(
        selectionState === 'selected' && id.startsWith(AUTO_LEVEL_ID_PREFIX) ? id : null,
      );
    };
    lineTools.subscribeLineToolsSingleClick(selectLineTool);
    const loadHistoryNearEdge = (range: { from: number; to: number } | null) => {
      if (!range) return;
      const bars = candleSeries.barsInLogicalRange(range);
      if (!bars) return;
      const loading = historyLoadingRef.current;
      if (bars.barsBefore < 100 && loading.canLoadOlder && !loading.isLoadingOlder) loading.onLoadOlder();
      if (bars.barsAfter < 100 && loading.canLoadNewer && !loading.isLoadingNewer) loading.onLoadNewer();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(loadHistoryNearEdge);
    const showCandleAtCrosshair = ({ time }: { time?: Time }) => {
      onCandleChangeRef.current(
        typeof time === 'number' ? (candlesByTimeRef.current.get(time * 1000) ?? null) : null,
      );
    };
    chart.subscribeCrosshairMove(showCandleAtCrosshair);
    const removeSelectedOnRightClick = (event: MouseEvent) => {
      event.preventDefault();
      try {
        const selected: unknown = JSON.parse(lineTools.getSelectedLineTools());
        if (Array.isArray(selected))
          selected.forEach((lineTool) => {
            if (
              typeof lineTool === 'object' &&
              lineTool !== null &&
              'id' in lineTool &&
              typeof lineTool.id === 'string' &&
              lineTool.id.startsWith(AUTO_LEVEL_ID_PREFIX)
            )
              onAutoLevelDeletedRef.current(lineTool.id);
          });
      } catch {
        // Selection can disappear between the pointer event and plugin lookup.
      }
      lineTools.removeSelectedLineTools();
      onAutoLevelSelectedRef.current(null);
      persistLineToolsRef.current();
    };
    container.addEventListener('contextmenu', removeSelectedOnRightClick);
    chartRef.current = chart;
    candleRef.current = candleSeries;
    lineToolsRef.current = lineTools;
    setReady(true);
    let pointerStartHeights: ChartIndicatorHeights | null = null;
    const startPaneResize = () => {
      pointerStartHeights = readIndicatorHeights(
        chart,
        indicatorLayoutRef.current,
        indicatorHeightsRef.current,
      );
    };
    const persistPaneResize = () => {
      if (!pointerStartHeights) return;
      const nextHeights = readIndicatorHeights(
        chart,
        indicatorLayoutRef.current,
        indicatorHeightsRef.current,
      );
      const changed =
        nextHeights.volume !== pointerStartHeights.volume ||
        nextHeights.openInterest !== pointerStartHeights.openInterest;
      pointerStartHeights = null;
      if (changed) onIndicatorHeightsChangeRef.current(nextHeights);
    };
    container.addEventListener('pointerdown', startPaneResize);
    window.addEventListener('pointerup', persistPaneResize);
    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => {
      persistLineToolsRef.current();
      observer.disconnect();
      container.removeEventListener('contextmenu', removeSelectedOnRightClick);
      container.removeEventListener('pointerdown', startPaneResize);
      window.removeEventListener('pointerup', persistPaneResize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(loadHistoryNearEdge);
      chart.unsubscribeCrosshairMove(showCandleAtCrosshair);
      lineTools.unsubscribeLineToolsAfterEdit(afterEdit);
      lineTools.unsubscribeLineToolsSingleClick(selectLineTool);
      lineTools.destroy();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      openInterestRef.current = null;
      lineToolsRef.current = null;
      displayedDataKeyRef.current = null;
      hasInitialRangeRef.current = false;
      pendingViewportRef.current = null;
      previousCandlesRef.current = [];
      candlesByTimeRef.current.clear();
      lastSeriesOpenTimeRef.current = null;
      lastSeriesLogicalIndexRef.current = -1;
      displayedLineToolsStorageScopeRef.current = null;
      indicatorLayoutRef.current = { volume: false, openInterest: false };
      onAutoLevelSelectedRef.current(null);
      setReady(false);
    };
  }, [lineToolsSourceId]);

  useLayoutEffect(() => {
    chartRef.current?.applyOptions(chartThemeOptions(palette));
  }, [palette]);

  useEffect(() => {
    if (!ready || !priceTickSize || !candleRef.current) return;
    candleRef.current.applyOptions({ priceFormat: priceFormat(priceTickSize) });
  }, [priceTickSize, ready]);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    const chart = chartRef.current;
    const nextLayout = {
      volume: indicatorSettings.volume.visible,
      openInterest: indicatorSettings.openInterest.visible,
    };

    if (!nextLayout.openInterest && openInterestRef.current) {
      chart.removeSeries(openInterestRef.current);
      openInterestRef.current = null;
    }
    if (!nextLayout.volume && volumeRef.current) {
      chart.removeSeries(volumeRef.current);
      volumeRef.current = null;
    }
    if (nextLayout.openInterest && !openInterestRef.current)
      openInterestRef.current = chart.addSeries(
        LineSeries,
        openInterestOptions(indicatorSettings.openInterest.color, openInterestPeriod),
        1,
      );
    if (nextLayout.volume && !volumeRef.current)
      volumeRef.current = chart.addSeries(HistogramSeries, volumeOptions, nextLayout.openInterest ? 2 : 1);

    openInterestRef.current?.applyOptions(
      openInterestOptions(indicatorSettings.openInterest.color, openInterestPeriod),
    );
    if (openInterestRef.current) openInterestRef.current.moveToPane(1);
    if (volumeRef.current) volumeRef.current.moveToPane(openInterestRef.current ? 2 : 1);

    indicatorLayoutRef.current = nextLayout;
  }, [
    indicatorSettings.openInterest.color,
    indicatorSettings.openInterest.visible,
    indicatorSettings.volume.visible,
    openInterestPeriod,
    ready,
  ]);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    applyIndicatorHeights(chartRef.current, indicatorLayoutRef.current, {
      openInterest: indicatorSettings.openInterest.height,
      volume: indicatorSettings.volume.height,
    });
  }, [
    indicatorSettings.openInterest.height,
    indicatorSettings.openInterest.visible,
    indicatorSettings.volume.height,
    indicatorSettings.volume.visible,
    ready,
  ]);

  useEffect(() => {
    if (!ready || !candleRef.current || !lineToolsRef.current) return;
    const chart = chartRef.current;
    const keyChanged = displayedDataKeyRef.current !== dataKey;
    const previousCandles = previousCandlesRef.current;
    const currentVisibleRange = chart?.timeScale().getVisibleLogicalRange();
    if (keyChanged) {
      if (currentVisibleRange && previousCandles.length > 0) {
        pendingViewportRef.current = {
          bars: currentVisibleRange.to - currentVisibleRange.from,
          rightOffset: lastSeriesLogicalIndexRef.current - currentVisibleRange.to,
        };
      }
      // Price scaling belongs to the previous instrument or interval.
      candleRef.current.priceScale().applyOptions({ autoScale: true });
      displayedDataKeyRef.current = dataKey;
      onAutoLevelSelectedRef.current(null);
      hasInitialRangeRef.current = false;
      previousCandlesRef.current = [];
      lastSeriesOpenTimeRef.current = null;
    }
    const visibleRange = keyChanged ? null : currentVisibleRange;
    candlesByTimeRef.current = new Map(candles.map((candle) => [candle[0], candle]));
    candleRef.current.setData(candles.map(toCandlestick));
    if (displayedLineToolsStorageScopeRef.current !== lineToolsStorageScope) {
      persistLineToolsRef.current();
      lineToolsRef.current.removeAllLineTools();
      restoreLineTools(lineToolsRef.current, lineToolsStorageScope, intervalFromDataKey(dataKey));
      displayedLineToolsStorageScopeRef.current = lineToolsStorageScope;
    }
    lastSeriesOpenTimeRef.current = candles.at(-1)?.[0] ?? null;
    for (const candle of latestCandlesRef.current) {
      candlesByTimeRef.current.set(candle[0], candle);
      if (lastSeriesOpenTimeRef.current !== null && candle[0] < lastSeriesOpenTimeRef.current) continue;
      candleRef.current.update(toCandlestick(candle));
      lastSeriesOpenTimeRef.current = candle[0];
    }
    lastSeriesLogicalIndexRef.current = lastLogicalIndex(candles, latestCandlesRef.current);
    previousCandlesRef.current = candles;
    if (!chart || candles.length === 0) return;
    if (!hasInitialRangeRef.current) {
      const viewport = pendingViewportRef.current;
      const lastIndex = lastLogicalIndex(candles, latestCandlesRef.current);
      const to = Math.max(0, lastIndex - (viewport?.rightOffset ?? 0));
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, to - (viewport?.bars ?? 99)),
        to,
      });
      hasInitialRangeRef.current = true;
      pendingViewportRef.current = null;
    } else if (visibleRange) {
      const previousAnchorIndex = Math.min(
        previousCandles.length - 1,
        Math.max(0, Math.floor(visibleRange.from)),
      );
      const anchorTime = previousCandles[previousAnchorIndex]?.[0];
      const nextAnchorIndex = candles.findIndex((candle) => candle[0] === anchorTime);
      const shift = nextAnchorIndex >= 0 ? nextAnchorIndex - previousAnchorIndex : 0;
      chart.timeScale().setVisibleLogicalRange({
        from: visibleRange.from + shift,
        to: visibleRange.to + shift,
      });
    }
  }, [candles, dataKey, lineToolsStorageScope, ready]);

  useEffect(() => {
    if (!ready || !volumeRef.current) return;
    const colors = {
      upColor: indicatorSettings.volume.upColor,
      downColor: indicatorSettings.volume.downColor,
    };
    volumeRef.current.setData(candles.map((candle) => toVolume(candle, colors)));
    const historicalLastOpenTime = candles.at(-1)?.[0];
    for (const candle of latestCandlesRef.current) {
      if (historicalLastOpenTime !== undefined && candle[0] < historicalLastOpenTime) continue;
      volumeRef.current.update(toVolume(candle, colors));
    }
  }, [
    candles,
    dataKey,
    indicatorSettings.volume.downColor,
    indicatorSettings.volume.upColor,
    indicatorSettings.volume.visible,
    ready,
  ]);

  useEffect(() => {
    if (!ready || !lineToolsRef.current) return;
    const unsubscribe = subscribeToLineTools(lineToolsStorageScope, ({ sourceId, lineTools }) => {
      if (sourceId === lineToolsSourceId || !lineToolsRef.current) return;
      pendingLineToolsSyncRef.current = lineTools;
      if (pendingLineToolsSyncTimeoutRef.current !== null) return;
      pendingLineToolsSyncTimeoutRef.current = window.setTimeout(() => {
        pendingLineToolsSyncTimeoutRef.current = null;
        const nextLineTools = pendingLineToolsSyncRef.current;
        pendingLineToolsSyncRef.current = undefined;
        if (nextLineTools === undefined || !lineToolsRef.current) return;
        removeManualLineTools(lineToolsRef.current);
        if (nextLineTools) lineToolsRef.current.importLineTools(JSON.stringify(nextLineTools));
      }, 16);
    });
    return () => {
      unsubscribe();
      if (pendingLineToolsSyncTimeoutRef.current !== null) {
        window.clearTimeout(pendingLineToolsSyncTimeoutRef.current);
        pendingLineToolsSyncTimeoutRef.current = null;
      }
      pendingLineToolsSyncRef.current = undefined;
    };
  }, [lineToolsSourceId, lineToolsStorageScope, ready]);

  useEffect(() => {
    if (!ready || !candleRef.current) return;
    const chart = chartRef.current;
    const visibleRange = chart?.timeScale().getVisibleLogicalRange();
    let appendedBars = 0;
    for (const candle of latestCandles) {
      candlesByTimeRef.current.set(candle[0], candle);
      if (lastSeriesOpenTimeRef.current !== null && candle[0] < lastSeriesOpenTimeRef.current) continue;
      if (lastSeriesOpenTimeRef.current !== null && candle[0] > lastSeriesOpenTimeRef.current)
        appendedBars += 1;
      candleRef.current.update(toCandlestick(candle));
      volumeRef.current?.update(toVolume(candle, volumeColorsRef.current));
      lastSeriesOpenTimeRef.current = candle[0];
    }
    if (appendedBars > 0) {
      lastSeriesLogicalIndexRef.current += appendedBars;
      if (visibleRange) {
        chart?.timeScale().setVisibleLogicalRange({
          from: visibleRange.from + appendedBars,
          to: visibleRange.to + appendedBars,
        });
      }
    }
  }, [dataKey, latestCandles, ready]);

  useEffect(() => {
    if (!ready || !openInterestRef.current) return;
    const displayedCandles = [...candles, ...latestCandlesRef.current];
    const history = toOpenInterestSeriesData(openInterest, displayedCandles, openInterestPeriodMs);
    openInterestRef.current.setData(history);
    const latest = latestOpenInterestRef.current;
    const alignedLatest = latest
      ? toOpenInterestSeriesData([latest], displayedCandles, openInterestPeriodMs)[0]
      : undefined;
    const historicalLastTime = history.at(-1)?.time;
    if (
      alignedLatest &&
      (historicalLastTime === undefined || Number(alignedLatest.time) >= Number(historicalLastTime))
    )
      openInterestRef.current.update(alignedLatest);
  }, [candles, dataKey, indicatorSettings.openInterest.visible, openInterest, openInterestPeriodMs, ready]);

  useEffect(() => {
    if (!ready || !openInterestRef.current || !latestOpenInterest) return;
    const displayedCandles = [...candles, ...latestCandlesRef.current];
    const alignedLatest = toOpenInterestSeriesData(
      [latestOpenInterest],
      displayedCandles,
      openInterestPeriodMs,
    )[0];
    const historicalLast = toOpenInterestSeriesData(
      openInterest.slice(-1),
      displayedCandles,
      openInterestPeriodMs,
    )[0];
    if (!alignedLatest || (historicalLast && Number(alignedLatest.time) < Number(historicalLast.time)))
      return;
    openInterestRef.current.update(alignedLatest);
  }, [candles, dataKey, latestOpenInterest, openInterest, openInterestPeriodMs, ready]);

  useEffect(() => {
    if (!tool || !lineToolsRef.current) return;
    lineToolsRef.current.addLineTool(tool);
  }, [drawingRequest, tool]);

  useEffect(() => {
    if (!ready || !lineToolsRef.current) return;
    syncAutoLevelLineTools(lineToolsRef.current, autoLevels, autoLevelSettings);
  }, [autoLevelSettings, autoLevels, dataKey, ready]);

  useEffect(() => {
    if (!ready || resetRequest === handledResetRequestRef.current || !lineToolsRef.current) return;
    handledResetRequestRef.current = resetRequest;
    if (pendingLineToolsSaveRef.current !== null) {
      window.clearTimeout(pendingLineToolsSaveRef.current);
      pendingLineToolsSaveRef.current = null;
    }
    removeManualLineTools(lineToolsRef.current);
    removeSavedLineTools(lineToolsStorageScope, lineToolsSourceId);
  }, [lineToolsSourceId, lineToolsStorageScope, ready, resetRequest]);

  return (
    <div
      className={`${styles['lightweight-chart']} ${isDrawingMenuOpen ? styles['palette-open'] : ''}`}
      ref={containerRef}
    />
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { createLineToolsPlugin, type ILineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { chartOptions, candleOptions, volumeOptions, volumeScaleMargins } from '../lib/chart-options';
import { registerTools } from '../lib/register-tools';
import { toCandlestick, toVolume, priceFormat } from '../lib/series-data';
import type { Candle } from '../../../entities/market';
import type { ChartTool } from '../model/types';
import styles from './ChartCanvas.module.scss';

type CandleSeries = ISeriesApi<'Candlestick', Time>;
type VolumeSeries = ISeriesApi<'Histogram', Time>;
export function ChartCanvas({
  candles,
  latestCandles,
  dataKey,
  priceTickSize,
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
}: {
  candles: Candle[];
  latestCandles: Candle[];
  dataKey: string;
  priceTickSize?: string;
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<CandleSeries | null>(null);
  const volumeRef = useRef<VolumeSeries | null>(null);
  const lineToolsRef = useRef<ILineToolsPlugin | null>(null);
  const displayedDataKeyRef = useRef<string | null>(null);
  const hasInitialRangeRef = useRef(false);
  const previousCandlesRef = useRef<Candle[]>([]);
  const latestCandlesRef = useRef(latestCandles);
  const lastSeriesOpenTimeRef = useRef<number | null>(null);
  const onDrawingCompleteRef = useRef(onDrawingComplete);
  const historyLoadingRef = useRef({
    canLoadNewer,
    canLoadOlder,
    isLoadingNewer,
    isLoadingOlder,
    onLoadNewer,
    onLoadOlder,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onDrawingCompleteRef.current = onDrawingComplete;
  }, [onDrawingComplete]);

  useEffect(() => {
    latestCandlesRef.current = latestCandles;
  }, [latestCandles]);

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
    const candleSeries = chart.addSeries(CandlestickSeries, candleOptions);
    const volumeSeries = chart.addSeries(HistogramSeries, volumeOptions);
    volumeSeries.priceScale().applyOptions({ scaleMargins: volumeScaleMargins });
    const lineTools = createLineToolsPlugin(chart, candleSeries);
    registerTools(lineTools);
    lineTools.setMagnetThreshold(8);
    lineTools.subscribeLineToolsAfterEdit(({ stage }) => {
      if (stage === 'lineToolFinished' || stage === 'pathFinished') onDrawingCompleteRef.current();
    });
    const loadHistoryNearEdge = (range: { from: number; to: number } | null) => {
      if (!range) return;
      const bars = candleSeries.barsInLogicalRange(range);
      if (!bars) return;
      const loading = historyLoadingRef.current;
      if (bars.barsBefore < 100 && loading.canLoadOlder && !loading.isLoadingOlder) loading.onLoadOlder();
      if (bars.barsAfter < 100 && loading.canLoadNewer && !loading.isLoadingNewer) loading.onLoadNewer();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(loadHistoryNearEdge);
    const removeSelectedOnRightClick = (event: MouseEvent) => {
      event.preventDefault();
      lineTools.removeSelectedLineTools();
    };
    container.addEventListener('contextmenu', removeSelectedOnRightClick);
    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;
    lineToolsRef.current = lineTools;
    setReady(true);
    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener('contextmenu', removeSelectedOnRightClick);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(loadHistoryNearEdge);
      lineTools.destroy();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      lineToolsRef.current = null;
      displayedDataKeyRef.current = null;
      hasInitialRangeRef.current = false;
      previousCandlesRef.current = [];
      lastSeriesOpenTimeRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !priceTickSize || !candleRef.current) return;
    candleRef.current.applyOptions({ priceFormat: priceFormat(priceTickSize) });
  }, [priceTickSize, ready]);

  useEffect(() => {
    if (!ready || !candleRef.current || !volumeRef.current) return;
    const chart = chartRef.current;
    const keyChanged = displayedDataKeyRef.current !== dataKey;
    if (keyChanged) {
      // Manual scaling and visible range belong to the previous instrument or interval.
      candleRef.current.priceScale().applyOptions({ autoScale: true });
      displayedDataKeyRef.current = dataKey;
      hasInitialRangeRef.current = false;
      previousCandlesRef.current = [];
      lastSeriesOpenTimeRef.current = null;
    }
    const visibleRange = keyChanged ? null : chart?.timeScale().getVisibleLogicalRange();
    const previousCandles = previousCandlesRef.current;
    candleRef.current.setData(candles.map(toCandlestick));
    volumeRef.current.setData(candles.map(toVolume));
    lastSeriesOpenTimeRef.current = candles.at(-1)?.[0] ?? null;
    for (const candle of latestCandlesRef.current) {
      if (lastSeriesOpenTimeRef.current !== null && candle[0] < lastSeriesOpenTimeRef.current) continue;
      candleRef.current.update(toCandlestick(candle));
      volumeRef.current.update(toVolume(candle));
      lastSeriesOpenTimeRef.current = candle[0];
    }
    previousCandlesRef.current = candles;
    if (!chart || candles.length === 0) return;
    if (!hasInitialRangeRef.current) {
      const to = candles.length - 1;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 100), to });
      hasInitialRangeRef.current = true;
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
  }, [candles, dataKey, ready]);

  useEffect(() => {
    if (!ready || !candleRef.current || !volumeRef.current) return;
    for (const candle of latestCandles) {
      if (lastSeriesOpenTimeRef.current !== null && candle[0] < lastSeriesOpenTimeRef.current) continue;
      candleRef.current.update(toCandlestick(candle));
      volumeRef.current.update(toVolume(candle));
      lastSeriesOpenTimeRef.current = candle[0];
    }
  }, [dataKey, latestCandles, ready]);

  useEffect(() => {
    if (!tool || !lineToolsRef.current) return;
    lineToolsRef.current.addLineTool(tool);
  }, [drawingRequest, tool]);

  return (
    <div
      className={`${styles['lightweight-chart']} ${isDrawingMenuOpen ? styles['palette-open'] : ''}`}
      ref={containerRef}
    />
  );
}

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
import type { ChartTool } from '../model/types';
import styles from './ChartCanvas.module.scss';

type Candle = [number, string, string, string, string, string];
type CandleSeries = ISeriesApi<'Candlestick', Time>;
type VolumeSeries = ISeriesApi<'Histogram', Time>;
export function ChartCanvas({
  candles,
  symbol,
  priceTickSize,
  drawingRequest,
  isDrawingMenuOpen,
  onDrawingComplete,
  tool,
}: {
  candles: Candle[];
  symbol: string;
  priceTickSize?: string;
  drawingRequest: number;
  isDrawingMenuOpen: boolean;
  onDrawingComplete: () => void;
  tool: ChartTool;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<CandleSeries | null>(null);
  const volumeRef = useRef<VolumeSeries | null>(null);
  const lineToolsRef = useRef<ILineToolsPlugin | null>(null);
  const displayedSymbolRef = useRef<string | null>(null);
  const onDrawingCompleteRef = useRef(onDrawingComplete);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onDrawingCompleteRef.current = onDrawingComplete;
  }, [onDrawingComplete]);

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
      lineTools.destroy();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      lineToolsRef.current = null;
      displayedSymbolRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !priceTickSize || !candleRef.current) return;
    candleRef.current.applyOptions({ priceFormat: priceFormat(priceTickSize) });
  }, [priceTickSize, ready]);

  useEffect(() => {
    if (!ready || !candleRef.current || !volumeRef.current) return;
    if (displayedSymbolRef.current !== symbol) {
      // Manual price scaling belongs to the previous instrument's price range.
      candleRef.current.priceScale().applyOptions({ autoScale: true });
      displayedSymbolRef.current = symbol;
    }
    candleRef.current.setData(candles.map(toCandlestick));
    volumeRef.current.setData(candles.map(toVolume));
    chartRef.current?.timeScale().fitContent();
  }, [candles, ready, symbol]);

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

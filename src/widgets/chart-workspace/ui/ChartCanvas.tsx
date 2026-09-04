import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { LineToolCircle } from 'lightweight-charts-line-tools-circle';
import {
  createLineToolsPlugin,
  type ILineToolsPlugin,
  type LineToolType,
} from 'lightweight-charts-line-tools-core';
import { registerFibRetracementPlugin } from 'lightweight-charts-line-tools-fib-retracement';
import { registerFreehandPlugin } from 'lightweight-charts-line-tools-freehand';
import { registerLinesPlugin } from 'lightweight-charts-line-tools-lines';
import { registerLongShortPositionPlugin } from 'lightweight-charts-line-tools-long-short-position';
import { registerMarketDepthPlugin } from 'lightweight-charts-line-tools-market-depth';
import { registerParallelChannelPlugin } from 'lightweight-charts-line-tools-parallel-channel';
import { registerPathPlugin } from 'lightweight-charts-line-tools-path';
import { registerPriceRangePlugin } from 'lightweight-charts-line-tools-price-range';
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle';
import { registerTextPlugin } from 'lightweight-charts-line-tools-text';
import { registerTrianglePlugin } from 'lightweight-charts-line-tools-triangle';
import styles from './ChartCanvas.module.scss';

type Candle = [number, string, string, string, string, string];
export type ChartTool = LineToolType | null;
type CandleSeries = ISeriesApi<'Candlestick', Time>;
type VolumeSeries = ISeriesApi<'Histogram', Time>;
type PluginWithLooseRegistration = ILineToolsPlugin & {
  registerLineTool: (type: string, toolClass: new (...args: never[]) => unknown) => void;
};

const registerTools = (lineTools: PluginWithLooseRegistration) => {
  registerLinesPlugin(lineTools);
  registerFreehandPlugin(lineTools);
  lineTools.registerLineTool('Rectangle', LineToolRectangle);
  lineTools.registerLineTool('Circle', LineToolCircle);
  registerTrianglePlugin(lineTools);
  registerPathPlugin(lineTools);
  registerParallelChannelPlugin(lineTools);
  registerFibRetracementPlugin(lineTools);
  registerPriceRangePlugin(lineTools);
  registerLongShortPositionPlugin(lineTools);
  registerTextPlugin(lineTools);
  registerMarketDepthPlugin(lineTools);
};

export function ChartCanvas({
  candles,
  drawingRequest,
  isDrawingMenuOpen,
  onDrawingComplete,
  tool,
}: {
  candles: Candle[];
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
      layout: { background: { type: ColorType.Solid, color: '#0c0d14' }, textColor: '#a9adba', fontSize: 11 },
      grid: { vertLines: { color: '#181b26' }, horzLines: { color: '#181b26' } },
      rightPriceScale: { borderColor: '#2a2c37' },
      timeScale: { borderColor: '#2a2c37', timeVisible: true },
      crosshair: { vertLine: { color: '#68657966' }, horzLine: { color: '#68657966' } },
      handleScroll: true,
      handleScale: true,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ac18b',
      downColor: '#e63c64',
      borderVisible: false,
      wickUpColor: '#0ac18b',
      wickDownColor: '#e63c64',
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
    const lineTools = createLineToolsPlugin(chart, candleSeries);
    registerTools(lineTools as PluginWithLooseRegistration);
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
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !candleRef.current || !volumeRef.current) return;
    candleRef.current.setData(
      candles.map((candle) => ({
        time: Math.floor(candle[0] / 1000) as Time,
        open: Number(candle[1]),
        high: Number(candle[2]),
        low: Number(candle[3]),
        close: Number(candle[4]),
      })),
    );
    volumeRef.current.setData(
      candles.map((candle) => ({
        time: Math.floor(candle[0] / 1000) as Time,
        value: Number(candle[5]),
        color: Number(candle[4]) >= Number(candle[1]) ? '#09825f99' : '#a7294a99',
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, ready]);

  useEffect(() => {
    if (!tool || !lineToolsRef.current) return;
    lineToolsRef.current.addLineTool(tool as LineToolType);
  }, [drawingRequest, tool]);

  return (
    <div
      className={`${styles['lightweight-chart']} ${isDrawingMenuOpen ? styles['palette-open'] : ''}`}
      ref={containerRef}
    />
  );
}

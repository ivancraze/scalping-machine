import { useLayoutEffect, useRef } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import type { Candle, OpenInterestPoint } from '../../../entities/market';
import {
  chartOptions,
  chartThemeOptions,
  candleOptions,
  openInterestOptions,
  volumeOptions,
} from '../lib/chart-options';
import { toCandlestick, toOpenInterestSeriesData, toVolume } from '../lib/series-data';
import type { ChartPalette } from '../model/types';
import styles from './GridChartCanvas.module.scss';

type CandleSeries = ISeriesApi<'Candlestick', Time>;
type VolumeSeries = ISeriesApi<'Histogram', Time>;
type OpenInterestSeries = ISeriesApi<'Line', Time>;

export function GridChartCanvas({
  palette,
  candles,
  openInterest,
  dataKey,
  volumeVisible,
  openInterestVisible,
  openInterestPeriod,
  openInterestPeriodMs,
  priceTickSize,
  currentPrice,
  scaleLabelsVisible = true,
}: {
  palette: ChartPalette;
  candles: Candle[];
  openInterest: OpenInterestPoint[];
  dataKey: string;
  volumeVisible: boolean;
  openInterestVisible: boolean;
  openInterestPeriod: string;
  openInterestPeriodMs: number;
  priceTickSize: string;
  currentPrice: number;
  scaleLabelsVisible?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<CandleSeries | null>(null);
  const volumeRef = useRef<VolumeSeries | null>(null);
  const openInterestRef = useRef<OpenInterestSeries | null>(null);
  const displayedCandlesRef = useRef<Candle[] | null>(null);
  const openInterestCandlesRef = useRef<Candle[] | null>(null);
  const displayedOpenInterestRef = useRef(openInterest);
  const displayedOpenInterestPeriodMsRef = useRef(openInterestPeriodMs);
  const displayedDataKeyRef = useRef<string | null>(null);
  const displayedVolumeVisibleRef = useRef(volumeVisible);
  const paletteRef = useRef(palette);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      ...chartOptions,
      width: container.clientWidth,
      height: container.clientHeight,
      rightPriceScale: { minimumWidth: 40 },
    });
    chart.applyOptions(chartThemeOptions(paletteRef.current));
    chartRef.current = chart;
    candleRef.current = chart.addSeries(CandlestickSeries, candleOptions);
    const observer = new ResizeObserver(([entry]) =>
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      openInterestRef.current = null;
      displayedCandlesRef.current = null;
      openInterestCandlesRef.current = null;
      displayedDataKeyRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    paletteRef.current = palette;
    chartRef.current?.applyOptions(chartThemeOptions(palette));
  }, [palette]);

  useLayoutEffect(() => {
    const tickPrecision = (priceTickSize.split('.')[1] ?? '').replace(/0+$/, '').length;
    const readablePrecision = Math.max(2, Math.ceil(-Math.log10(currentPrice)) + 3);
    const precision = Math.min(tickPrecision, readablePrecision);
    candleRef.current?.applyOptions({
      priceFormat: { type: 'price', minMove: 10 ** -precision, precision },
    });
  }, [currentPrice, priceTickSize]);

  useLayoutEffect(() => {
    chartRef.current?.applyOptions({
      rightPriceScale: { minimumWidth: 40, visible: scaleLabelsVisible },
      timeScale: { visible: scaleLabelsVisible },
    });
  }, [scaleLabelsVisible]);

  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!openInterestVisible && openInterestRef.current) {
      chart.removeSeries(openInterestRef.current);
      openInterestRef.current = null;
      openInterestCandlesRef.current = null;
    }
    if (!volumeVisible && volumeRef.current) {
      chart.removeSeries(volumeRef.current);
      volumeRef.current = null;
    }
    if (openInterestVisible && !openInterestRef.current) {
      openInterestRef.current = chart.addSeries(
        LineSeries,
        openInterestOptions('#0f8bfd', openInterestPeriod),
        1,
      );
      openInterestCandlesRef.current = null;
    }
    if (volumeVisible && !volumeRef.current)
      volumeRef.current = chart.addSeries(HistogramSeries, volumeOptions, openInterestRef.current ? 2 : 1);
    openInterestRef.current?.applyOptions(openInterestOptions('#0f8bfd', openInterestPeriod));
    if (openInterestRef.current) openInterestRef.current.moveToPane(1);
    if (volumeRef.current) volumeRef.current.moveToPane(openInterestRef.current ? 2 : 1);
    const panes = chart.panes();
    panes[0]?.setStretchFactor(5);
    if (openInterestRef.current) panes[1]?.setStretchFactor(1);
    if (volumeRef.current) panes[openInterestRef.current ? 2 : 1]?.setStretchFactor(1.4);
  }, [openInterestPeriod, openInterestVisible, volumeVisible]);

  useLayoutEffect(() => {
    if (!candleRef.current || candles.length === 0) return;
    const keyChanged = displayedDataKeyRef.current !== dataKey;
    const volumeVisibilityChanged = displayedVolumeVisibleRef.current !== volumeVisible;
    const lastCandle = candles.at(-1);
    const previousCandles = displayedCandlesRef.current;
    const onlyCurrentCandleChanged =
      !keyChanged &&
      previousCandles?.length === candles.length &&
      previousCandles.slice(0, -1).every((candle, index) => candle === candles[index]) &&
      previousCandles.at(-1)?.[0] === lastCandle?.[0];
    displayedDataKeyRef.current = dataKey;
    if (!onlyCurrentCandleChanged || volumeVisibilityChanged) {
      candleRef.current.setData(candles.map(toCandlestick));
      volumeRef.current?.setData(
        candles.map((candle) => toVolume(candle, { upColor: '#09825f', downColor: '#a7294a' })),
      );
    } else if (lastCandle) {
      candleRef.current.update(toCandlestick(lastCandle));
      volumeRef.current?.update(toVolume(lastCandle, { upColor: '#09825f', downColor: '#a7294a' }));
    }
    displayedCandlesRef.current = candles;
    displayedVolumeVisibleRef.current = volumeVisible;
    if (keyChanged) chartRef.current?.timeScale().fitContent();
  }, [candles, dataKey, volumeVisible]);

  useLayoutEffect(() => {
    if (!openInterestRef.current) return;
    const previousCandles = openInterestCandlesRef.current;
    const sameTimeline =
      previousCandles?.length === candles.length &&
      previousCandles.every((candle, index) => candle[0] === candles[index]?.[0]);
    const openInterestChanged = displayedOpenInterestRef.current !== openInterest;
    const periodChanged = displayedOpenInterestPeriodMsRef.current !== openInterestPeriodMs;
    openInterestCandlesRef.current = candles;
    displayedOpenInterestRef.current = openInterest;
    displayedOpenInterestPeriodMsRef.current = openInterestPeriodMs;
    if (sameTimeline && !openInterestChanged && !periodChanged) return;
    openInterestRef.current.setData(toOpenInterestSeriesData(openInterest, candles, openInterestPeriodMs));
  }, [candles, openInterest, openInterestPeriodMs, openInterestVisible]);

  return <div ref={containerRef} className={styles.canvas} />;
}

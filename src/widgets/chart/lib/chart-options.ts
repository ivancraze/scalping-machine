import {
  ColorType,
  CrosshairMode,
  type ChartOptions,
  type DeepPartial,
  type CandlestickSeriesPartialOptions,
  type HistogramSeriesPartialOptions,
} from 'lightweight-charts';
import { localTickMarkFormatter, localTimeFormatter } from './time-format';
export const chartOptions: DeepPartial<ChartOptions> = {
  layout: { background: { type: ColorType.Solid, color: '#0c0d14' }, textColor: '#a9adba', fontSize: 11 },
  grid: { vertLines: { color: '#181b26' }, horzLines: { color: '#181b26' } },
  rightPriceScale: { borderColor: '#2a2c37' },
  localization: { timeFormatter: localTimeFormatter },
  timeScale: { borderColor: '#2a2c37', timeVisible: true, tickMarkFormatter: localTickMarkFormatter },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#68657966' },
    horzLine: { color: '#68657966' },
  },
  handleScroll: true,
  handleScale: true,
};
export const candleOptions: CandlestickSeriesPartialOptions = {
  upColor: '#0ac18b',
  downColor: '#e63c64',
  borderVisible: false,
  wickUpColor: '#0ac18b',
  wickDownColor: '#e63c64',
};
export const volumeOptions: HistogramSeriesPartialOptions = {
  priceFormat: { type: 'volume' },
  priceScaleId: '',
};
export const volumeScaleMargins = { top: 0.83, bottom: 0 };

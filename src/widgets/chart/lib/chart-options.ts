import {
  ColorType,
  CrosshairMode,
  type ChartOptions,
  type DeepPartial,
  type CandlestickSeriesPartialOptions,
  type HistogramSeriesPartialOptions,
} from 'lightweight-charts';
import { localTickMarkFormatter, localTimeFormatter } from './time-format';
import type { ChartPalette } from '../model/types';

export const chartThemeOptions = (palette: ChartPalette): DeepPartial<ChartOptions> => ({
  layout: { background: { type: ColorType.Solid, color: palette.background }, textColor: palette.text },
  grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
  rightPriceScale: { borderColor: palette.border },
  timeScale: { borderColor: palette.border },
  crosshair: {
    vertLine: { color: palette.crosshair },
    horzLine: { color: palette.crosshair },
  },
});
export const chartOptions: DeepPartial<ChartOptions> = {
  layout: { fontSize: 11 },
  localization: { timeFormatter: localTimeFormatter },
  timeScale: { timeVisible: true, tickMarkFormatter: localTickMarkFormatter },
  crosshair: {
    mode: CrosshairMode.Normal,
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

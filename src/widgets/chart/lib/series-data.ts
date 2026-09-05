import type { CandlestickData, HistogramData, Time, PriceFormatBuiltIn } from 'lightweight-charts';
type Candle = [number, string, string, string, string, string];
export const toCandlestick = (candle: Candle): CandlestickData<Time> => ({
  time: Math.floor(candle[0] / 1000) as Time,
  open: Number(candle[1]),
  high: Number(candle[2]),
  low: Number(candle[3]),
  close: Number(candle[4]),
});
export const toVolume = (candle: Candle): HistogramData<Time> => ({
  time: Math.floor(candle[0] / 1000) as Time,
  value: Number(candle[5]),
  color: Number(candle[4]) >= Number(candle[1]) ? '#09825f99' : '#a7294a99',
});
export function priceFormat(tickSize: string): PriceFormatBuiltIn {
  // Axis subdivisions may be finer than the exchange tick; candle prices stay unchanged.
  return {
    type: 'price',
    minMove: Number(tickSize) / 100,
    precision: (tickSize.split('.')[1] ?? '').replace(/0+$/, '').length + 2,
  };
}

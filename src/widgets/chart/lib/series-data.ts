import type { CandlestickData, HistogramData, LineData, Time, PriceFormatBuiltIn } from 'lightweight-charts';
import type { OpenInterestPoint } from '../../../entities/market';
type Candle = [number, string, string, string, string, string];
type VolumeColors = { upColor: string; downColor: string };
export const toCandlestick = (candle: Candle): CandlestickData<Time> => ({
  time: Math.floor(candle[0] / 1000) as Time,
  open: Number(candle[1]),
  high: Number(candle[2]),
  low: Number(candle[3]),
  close: Number(candle[4]),
});
export const toVolume = (candle: Candle, colors: VolumeColors): HistogramData<Time> => ({
  time: Math.floor(candle[0] / 1000) as Time,
  value: Number(candle[5]),
  color: `${Number(candle[4]) >= Number(candle[1]) ? colors.upColor : colors.downColor}99`,
});

export function toOpenInterestSeriesData(
  points: OpenInterestPoint[],
  candles: Candle[],
  periodMilliseconds: number,
): LineData<Time>[] {
  const candleTimes = [...new Set(candles.map(([timestamp]) => timestamp))].sort(
    (left, right) => left - right,
  );
  const firstCandleTime = candleTimes[0];
  const lastCandleTime = candleTimes.at(-1);
  if (firstCandleTime === undefined || lastCandleTime === undefined) return [];

  const valuesByCandleTime = new Map<number, number>();
  for (const point of points) {
    const bucketTime = Math.floor(point.timestamp / periodMilliseconds) * periodMilliseconds;
    if (bucketTime + periodMilliseconds <= firstCandleTime || bucketTime > lastCandleTime) continue;

    let left = 0;
    let right = candleTimes.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (candleTimes[middle] < bucketTime) left = middle + 1;
      else right = middle;
    }
    const candleTime = candleTimes[left];
    if (candleTime !== undefined && candleTime < bucketTime + periodMilliseconds)
      valuesByCandleTime.set(candleTime, point.valueUsd);
  }

  return [...valuesByCandleTime]
    .sort(([left], [right]) => left - right)
    .map(([timestamp, value]) => ({ time: Math.floor(timestamp / 1000) as Time, value }));
}

export function priceFormat(tickSize: string): PriceFormatBuiltIn {
  // Axis subdivisions may be finer than the exchange tick; candle prices stay unchanged.
  return {
    type: 'price',
    minMove: Number(tickSize) / 100,
    precision: (tickSize.split('.')[1] ?? '').replace(/0+$/, '').length + 2,
  };
}

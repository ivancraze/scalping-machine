export function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  return leftVariance && rightVariance ? numerator / Math.sqrt(leftVariance * rightVariance) : null;
}

export function returnsFrom(candles: Candle[]) {
  return candles.slice(1).map((candle, index) => Number(candle[4]) / Number(candles[index][4]) - 1);
}

export function correlationFromCandles(left: Candle[], right: Candle[]) {
  return pearson(returnsFrom(left), returnsFrom(right));
}
import type { Candle } from '../model/candle';

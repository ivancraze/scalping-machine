import type { Candle } from '../model/candle';

export function natrFromCandles(candles: Candle[], period: number) {
  if (period < 1 || candles.length <= period) return null;
  const trueRanges = candles.slice(1).map((candle, index) => {
    const high = Number(candle[2]);
    const low = Number(candle[3]);
    const previousClose = Number(candles[index][4]);
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  });
  if (trueRanges.some((range) => !Number.isFinite(range))) return null;

  let atr = trueRanges.slice(0, period).reduce((sum, range) => sum + range, 0) / period;
  for (const range of trueRanges.slice(period)) atr = (atr * (period - 1) + range) / period;

  const close = Number(candles.at(-1)?.[4]);
  return Number.isFinite(close) && close > 0 ? (atr / close) * 100 : null;
}

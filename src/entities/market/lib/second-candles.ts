import type { AggregateTrade } from '../api/binance';
import type { Candle } from '../model/types';

export function aggregateSecondTrades(trades: AggregateTrade[], secondsPerCandle: number): Candle[] {
  return trades.reduce<Candle[]>(
    (candles, trade) => updateSecondCandle(candles, trade, secondsPerCandle),
    [],
  );
}

export function updateSecondCandle(
  candles: Candle[],
  trade: AggregateTrade,
  secondsPerCandle: number,
): Candle[] {
  const openTime = Math.floor(trade.T / (secondsPerCandle * 1_000)) * secondsPerCandle * 1_000;
  const previous = candles.at(-1);
  if (previous?.[0] === openTime) {
    const updated: Candle = [
      openTime,
      previous[1],
      Math.max(Number(previous[2]), Number(trade.p)).toString(),
      Math.min(Number(previous[3]), Number(trade.p)).toString(),
      trade.p,
      (Number(previous[5]) + Number(trade.q)).toString(),
    ];
    return [...candles.slice(0, -1), updated];
  }
  const next: Candle = [openTime, trade.p, trade.p, trade.p, trade.p, trade.q];
  return [...candles, next].slice(-1_000);
}

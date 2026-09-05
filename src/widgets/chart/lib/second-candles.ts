import type { Candle } from '../../../entities/market';

export type AggregateTrade = { T: number; p: string; q: string };

export function aggregateSecondTrades(trades: AggregateTrade[], secondsPerCandle: number): Candle[] {
  const candles: Candle[] = [];
  for (const trade of trades) {
    const openTime = Math.floor(trade.T / (secondsPerCandle * 1_000)) * secondsPerCandle * 1_000;
    const previous = candles.at(-1);
    if (previous?.[0] === openTime) {
      previous[2] = Math.max(Number(previous[2]), Number(trade.p)).toString();
      previous[3] = Math.min(Number(previous[3]), Number(trade.p)).toString();
      previous[4] = trade.p;
      previous[5] = (Number(previous[5]) + Number(trade.q)).toString();
    } else {
      candles.push([openTime, trade.p, trade.p, trade.p, trade.p, trade.q]);
    }
  }
  return candles;
}

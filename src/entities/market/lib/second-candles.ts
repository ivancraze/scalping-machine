import type { Candle } from '../model/candle';
import type { MarketTrade } from '../model/market';

export function aggregateSecondTrades(trades: MarketTrade[], secondsPerCandle: number): Candle[] {
  return trades.reduce<Candle[]>(
    (candles, trade) => updateSecondCandle(candles, trade, secondsPerCandle),
    [],
  );
}

export function updateSecondCandle(
  candles: Candle[],
  trade: MarketTrade,
  secondsPerCandle: number,
): Candle[] {
  const openTime = Math.floor(trade.timestamp / (secondsPerCandle * 1_000)) * secondsPerCandle * 1_000;
  const previous = candles.at(-1);
  if (previous?.[0] === openTime) {
    const updated: Candle = [
      openTime,
      previous[1],
      Math.max(Number(previous[2]), Number(trade.price)).toString(),
      Math.min(Number(previous[3]), Number(trade.price)).toString(),
      trade.price,
      (Number(previous[5]) + Number(trade.quantity)).toString(),
    ];
    return [...candles.slice(0, -1), updated];
  }
  const next: Candle = [openTime, trade.price, trade.price, trade.price, trade.price, trade.quantity];
  return [...candles, next].slice(-1_000);
}

import { binanceWebSocket } from '../../../shared/api/binance-websocket';
import type { Candle } from '../model/types';
import type { AggregateTrade } from './binance';

type BinanceKlineMessage = {
  k: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
  };
};

export function toCandle(message: BinanceKlineMessage): Candle {
  const { k } = message;
  return [k.t, k.o, k.h, k.l, k.c, k.v];
}

export function subscribeKline(
  symbol: string,
  interval: string,
  onCandle: (candle: Candle) => void,
  onReconnect?: () => void,
) {
  return binanceWebSocket.subscribe(
    `${symbol.toLowerCase()}@kline_${interval}`,
    (message) => onCandle(toCandle(message as BinanceKlineMessage)),
    onReconnect,
  );
}

export function subscribeAggregateTrades(
  symbol: string,
  onTrade: (trade: AggregateTrade) => void,
  onReconnect?: () => void,
) {
  return binanceWebSocket.subscribe(
    `${symbol.toLowerCase()}@aggTrade`,
    (message) => onTrade(message as AggregateTrade),
    onReconnect,
  );
}

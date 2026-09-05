import { binanceWebSocket } from '../../../shared/api/binance-websocket';
import type { Candle } from '../model/types';
import type { AggregateTrade } from './binance';

export type BinanceTickerUpdate = {
  s: string;
  c: string;
  P: string;
  h: string;
  l: string;
  q: string;
  n: number;
};

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

const isFiniteNumericString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));

export function isBinanceTickerUpdate(value: unknown): value is BinanceTickerUpdate {
  if (typeof value !== 'object' || value === null) return false;
  const ticker = value as Record<string, unknown>;
  return (
    typeof ticker.s === 'string' &&
    isFiniteNumericString(ticker.c) &&
    isFiniteNumericString(ticker.P) &&
    isFiniteNumericString(ticker.h) &&
    isFiniteNumericString(ticker.l) &&
    isFiniteNumericString(ticker.q) &&
    typeof ticker.n === 'number' &&
    Number.isFinite(ticker.n)
  );
}

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

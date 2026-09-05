import { binanceWebSocket } from './binance-websocket';
import type { Candle } from '../model/candle';
import type { MarketTickerUpdate, MarketTrade } from '../model/market';

type BinanceTickerUpdate = {
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

function toMarketTickerUpdate(ticker: BinanceTickerUpdate): MarketTickerUpdate {
  const price = Number(ticker.c);
  const high = Number(ticker.h);
  const low = Number(ticker.l);
  return {
    symbol: ticker.s,
    price,
    change: Number(ticker.P),
    range: (high / low) * 100 - 100,
    natr: ((high - low) / price) * 100,
    trades: ticker.n,
    volume: Number(ticker.q),
  };
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
  onTrade: (trade: MarketTrade) => void,
  onReconnect?: () => void,
) {
  return binanceWebSocket.subscribe(
    `${symbol.toLowerCase()}@aggTrade`,
    (message) => {
      if (!isBinanceAggregateTrade(message)) return;
      onTrade({ timestamp: message.T, price: message.p, quantity: message.q });
    },
    onReconnect,
  );
}

export function subscribeMarketTickers(
  onUpdates: (updates: MarketTickerUpdate[]) => void,
  onReconnect?: () => void,
) {
  return binanceWebSocket.subscribe(
    '!ticker@arr',
    (message) => {
      if (!Array.isArray(message)) return;
      const updates = message.filter(isBinanceTickerUpdate).map(toMarketTickerUpdate);
      if (updates.length > 0) onUpdates(updates);
    },
    onReconnect,
  );
}

function isBinanceAggregateTrade(value: unknown): value is { T: number; p: string; q: string } {
  if (typeof value !== 'object' || value === null) return false;
  const trade = value as Record<string, unknown>;
  return (
    typeof trade.T === 'number' &&
    Number.isFinite(trade.T) &&
    isFiniteNumericString(trade.p) &&
    isFiniteNumericString(trade.q)
  );
}

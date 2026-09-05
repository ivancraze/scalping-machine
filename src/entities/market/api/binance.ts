import { throwRequestError } from '../../../shared/api/http-client';
import type { Candle } from '../model/candle';
import type { MarketDepthLevel } from '../model/depth';
import type { MarketRow, MarketTrade } from '../model/market';
import { binanceHttpClient } from './binance-client';

const asNumber = (value: string | number) => Number(value);

type FuturesSymbol = {
  symbol: string;
  status: string;
  contractType: string;
  quoteAsset: string;
  marginAsset: string;
  filters: Array<{ filterType: string; tickSize?: string }>;
};

type MarketTicker = Record<string, string>;
type BinanceCandle = [number, string, string, string, string, string, ...unknown[]];
type BinanceAggregateTrade = { T: number; p: string; q: string };
type BinanceOpenInterest = { openInterest: string };
export type Instruments = Record<string, string>;

export type CandleRequest = {
  limit?: number;
  startTime?: number;
  endTime?: number;
  signal?: AbortSignal;
};

export async function getInstruments(signal?: AbortSignal): Promise<Instruments> {
  try {
    const { data } = await binanceHttpClient.get<{ symbols: FuturesSymbol[] }>('/exchangeInfo', { signal });
    return Object.fromEntries(
      data.symbols
        .filter(
          (item) =>
            item.status === 'TRADING' &&
            item.contractType === 'PERPETUAL' &&
            item.quoteAsset === 'USDT' &&
            item.marginAsset === 'USDT',
        )
        .map((item) => {
          const tickSize = item.filters.find((filter) => filter.filterType === 'PRICE_FILTER')?.tickSize;
          if (!tickSize || !Number.isFinite(Number(tickSize)) || Number(tickSize) <= 0)
            throw new Error('Invalid Binance price tick');
          return [item.symbol, tickSize];
        }),
    );
  } catch (error) {
    throwRequestError(error, 'Binance Futures instruments unavailable');
  }
}

export async function getMarket(instruments: Instruments, signal?: AbortSignal): Promise<MarketRow[]> {
  try {
    const { data } = await binanceHttpClient.get<MarketTicker[]>('/ticker/24hr', { signal });
    return data
      .filter((item) => instruments[item.symbol] !== undefined)
      .map((item) => {
        const price = asNumber(item.lastPrice);
        const high = asNumber(item.highPrice);
        const low = asNumber(item.lowPrice);
        return {
          symbol: item.symbol,
          priceTickSize: instruments[item.symbol],
          price,
          change: asNumber(item.priceChangePercent),
          range: (high / low) * 100 - 100,
          natr: ((high - low) / price) * 100,
          trades: asNumber(item.count),
          volume: asNumber(item.quoteVolume),
        };
      });
  } catch (error) {
    throwRequestError(error, 'Binance market unavailable');
  }
}

export async function getCandles(
  symbol: string,
  interval = '1m',
  { limit = 72, startTime, endTime, signal }: CandleRequest = {},
): Promise<Candle[]> {
  try {
    const { data } = await binanceHttpClient.get<BinanceCandle[]>('/klines', {
      params: { symbol, interval, limit, startTime, endTime },
      signal,
    });
    return data.map((item) => [item[0], item[1], item[2], item[3], item[4], item[5]]);
  } catch (error) {
    throwRequestError(error, 'Candles unavailable');
  }
}

export async function getAggregateTrades(symbol: string, signal?: AbortSignal): Promise<MarketTrade[]> {
  try {
    const { data } = await binanceHttpClient.get<BinanceAggregateTrade[]>('/aggTrades', {
      params: { symbol, limit: 1000 },
      signal,
    });
    return data.map(toMarketTrade);
  } catch (error) {
    throwRequestError(error, 'Aggregate trades unavailable');
  }
}

export async function getOpenInterest(symbol: string, signal?: AbortSignal): Promise<number> {
  try {
    const { data } = await binanceHttpClient.get<BinanceOpenInterest>('/openInterest', {
      params: { symbol },
      signal,
    });
    return asNumber(data.openInterest);
  } catch (error) {
    throwRequestError(error, 'Open interest unavailable');
  }
}

export async function getDepth(
  symbol: string,
  minNotional: number,
  distance: number,
  signal?: AbortSignal,
): Promise<{ mid: number; levels: MarketDepthLevel[] }> {
  try {
    const { data } = await binanceHttpClient.get<{ bids: [string, string][]; asks: [string, string][] }>(
      '/depth',
      { params: { symbol, limit: 500 }, signal },
    );
    const mid = (asNumber(data.bids[0][0]) + asNumber(data.asks[0][0])) / 2;
    const parse = (side: 'bid' | 'ask', list: [string, string][]) =>
      list
        .map(([price, quantity]) => ({
          price: asNumber(price),
          quantity: asNumber(quantity),
          notional: asNumber(price) * asNumber(quantity),
          side,
        }))
        .filter(
          (level) => level.notional >= minNotional && Math.abs((level.price / mid - 1) * 100) <= distance,
        );
    return { mid, levels: [...parse('ask', data.asks), ...parse('bid', data.bids)] };
  } catch (error) {
    throwRequestError(error, 'Order book unavailable');
  }
}

function toMarketTrade({ T, p, q }: BinanceAggregateTrade): MarketTrade {
  return { timestamp: T, price: p, quantity: q };
}

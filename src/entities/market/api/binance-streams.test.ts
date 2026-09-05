import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marketQueryKeys } from '../model/query-keys';
import { mergeLatestCandle } from '../model/candle-query';
import {
  isBinanceTickerUpdate,
  subscribeAggregateTrades,
  subscribeMarketTickers,
  toCandle,
} from './binance-streams';
import { binanceWebSocket } from './binance-websocket';
import { updateSecondCandle } from '../lib/second-candles';
import type { Candle } from '../model/candle';

vi.mock('./binance-websocket', () => ({
  binanceWebSocket: { subscribe: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

describe('Binance market stream adapters', () => {
  it('normalizes a kline event into the domain candle shape', () => {
    expect(toCandle({ k: { t: 1_000, o: '10', h: '12', l: '9', c: '11', v: '50' } })).toEqual([
      1_000,
      '10',
      '12',
      '9',
      '11',
      '50',
    ]);
  });

  it('accepts only finite ticker values before writing them to the market cache', () => {
    expect(
      isBinanceTickerUpdate({ s: 'BTCUSDT', c: '100', P: '1', h: '101', l: '99', q: '1000', n: 5 }),
    ).toBe(true);
    expect(
      isBinanceTickerUpdate({ s: 'BTCUSDT', c: 'invalid', P: '1', h: '101', l: '99', q: '1000', n: 5 }),
    ).toBe(false);
  });

  it('maps Binance ticker updates to domain market values', () => {
    const onUpdates = vi.fn();
    subscribeMarketTickers(onUpdates);
    const onMessage = vi.mocked(binanceWebSocket.subscribe).mock.calls[0][1];

    onMessage([
      { s: 'BTCUSDT', c: '100', P: '1.5', h: '110', l: '90', q: '1234', n: 42 },
      { s: 'ETHUSDT', c: 'invalid', P: '1', h: '101', l: '99', q: '1000', n: 5 },
    ]);

    expect(onUpdates).toHaveBeenCalledWith([
      {
        symbol: 'BTCUSDT',
        price: 100,
        change: 1.5,
        range: 22.22222222222223,
        natr: 20,
        trades: 42,
        volume: 1234,
      },
    ]);
  });

  it('maps valid aggregate trades to domain trade values', () => {
    const onTrade = vi.fn();
    subscribeAggregateTrades('BTCUSDT', onTrade);
    const onMessage = vi.mocked(binanceWebSocket.subscribe).mock.calls[0][1];

    onMessage({ T: 1_000, p: '100.5', q: '0.25' });
    onMessage({ T: 1_000, p: 'invalid', q: '0.25' });

    expect(onTrade).toHaveBeenCalledOnce();
    expect(onTrade).toHaveBeenCalledWith({ timestamp: 1_000, price: '100.5', quantity: '0.25' });
  });

  it('updates the current second candle and starts the next one', () => {
    const initial: Candle[] = [[0, '10', '10', '10', '10', '1']];
    const updated = updateSecondCandle(initial, { timestamp: 500, price: '12', quantity: '2' }, 1);
    const next = updateSecondCandle(updated, { timestamp: 1_100, price: '11', quantity: '3' }, 1);

    expect(updated).toEqual([[0, '10', '12', '10', '12', '3']]);
    expect(next).toEqual([
      [0, '10', '12', '10', '12', '3'],
      [1_000, '11', '11', '11', '11', '3'],
    ]);
  });

  it('writes a live kline to the TanStack Query cache without a REST refetch', () => {
    const queryClient = new QueryClient();
    const queryKey = marketQueryKeys.latestCandles('BTCUSDT', '1m');
    queryClient.setQueryData<Candle[]>(queryKey, [[0, '10', '10', '10', '10', '1']]);
    queryClient.setQueryData<Candle[]>(queryKey, (previous) =>
      mergeLatestCandle(previous, [0, '10', '12', '9', '11', '2']),
    );

    expect(queryClient.getQueryData(queryKey)).toEqual([[0, '10', '12', '9', '11', '2']]);
  });
});

import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { marketQueryKeys, mergeLatestCandle } from './queries';
import { isBinanceTickerUpdate, toCandle } from './binance-streams';
import { updateSecondCandle } from '../lib/second-candles';
import type { Candle } from '../model/types';

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

  it('updates the current second candle and starts the next one', () => {
    const initial: Candle[] = [[0, '10', '10', '10', '10', '1']];
    const updated = updateSecondCandle(initial, { T: 500, p: '12', q: '2' }, 1);
    const next = updateSecondCandle(updated, { T: 1_100, p: '11', q: '3' }, 1);

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

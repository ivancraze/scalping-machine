import { describe, expect, it } from 'vitest';
import { natrFromCandles } from './natr';
import type { Candle } from '../model/candle';

const candle = (time: number, high: number, low: number, close: number): Candle => [
  time,
  String(close),
  String(high),
  String(low),
  String(close),
  '0',
];

describe('natrFromCandles', () => {
  it('uses Wilder smoothing after the initial true-range average', () => {
    const candles = [
      candle(0, 10, 10, 10),
      candle(1, 12, 9, 11),
      candle(2, 14, 10, 12),
      candle(3, 13, 11, 12),
      candle(4, 15, 12, 14),
    ];

    // Initial ATR: (3 + 4 + 2) / 3 = 3; then Wilder ATR: (3 * 2 + 3) / 3 = 3.
    expect(natrFromCandles(candles, 3)).toBeCloseTo((3 / 14) * 100);
  });

  it('returns null for an insufficient or invalid candle series', () => {
    expect(natrFromCandles([candle(0, 10, 10, 10), candle(1, 11, 9, 10)], 2)).toBeNull();
    expect(natrFromCandles([candle(0, 10, 10, 10), candle(1, Number.NaN, 9, 10)], 1)).toBeNull();
    expect(natrFromCandles([candle(0, 10, 10, 10), candle(1, 11, 9, 0)], 1)).toBeNull();
  });
});

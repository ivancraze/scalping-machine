import { describe, expect, it } from 'vitest';
import { correlationFromCandles } from './correlation';
import type { Candle } from '../model/candle';

const candlesFromCloses = (closes: number[]): Candle[] =>
  closes.map((close, index) => [index, String(close), String(close), String(close), String(close), '0']);

describe('correlationFromCandles', () => {
  it('calculates Pearson correlation from candle returns rather than price levels', () => {
    const bitcoin = candlesFromCloses([100, 110, 99, 108.9]);
    const asset = candlesFromCloses([10, 11, 9.9, 10.89]);

    expect(correlationFromCandles(asset, bitcoin)).toBeCloseTo(1);
  });

  it('returns null when there are not enough return observations', () => {
    expect(correlationFromCandles(candlesFromCloses([100]), candlesFromCloses([200]))).toBeNull();
  });
});

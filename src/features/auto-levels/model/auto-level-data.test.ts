import { describe, expect, it } from 'vitest';
import type { AutoLevelCandle } from '../../../entities/auto-level';
import { confirmedAutoLevelCandles, mergeAutoLevelCandles } from './auto-level-data';

const candle = (openTime: number, close: string): AutoLevelCandle => [
  openTime,
  close,
  close,
  close,
  close,
  '1',
];

describe('auto level candle preparation', () => {
  it('lets latest candles replace stale history and keeps chronological order', () => {
    expect(
      mergeAutoLevelCandles(
        [candle(60_000, '1'), candle(120_000, '2')],
        [candle(120_000, '3'), candle(180_000, '4')],
      ),
    ).toEqual([candle(60_000, '1'), candle(120_000, '3'), candle(180_000, '4')]);
  });

  it('requires a newer exchange candle and applies its final predecessor', () => {
    const candles = [candle(0, '1'), candle(60_000, '2'), candle(120_000, '3')];

    expect(confirmedAutoLevelCandles(candles, [candle(60_000, '2.5')], 120_000, 300)).toEqual([
      candle(0, '1'),
      candle(60_000, '2.5'),
    ]);
  });

  it('limits main-thread preparation to the requested history tail', () => {
    const candles = Array.from({ length: 1100 }, (_, index) => candle(index * 60_000, '1'));

    const result = confirmedAutoLevelCandles(candles, [], 1100 * 60_000, 300);

    expect(result).toHaveLength(300);
    expect(result[0][0]).toBe(800 * 60_000);
  });

  it('keeps every closed live candle in a rolling analysis window', () => {
    const history = [candle(0, '1'), candle(60_000, '2')];
    const first = confirmedAutoLevelCandles(history, [candle(120_000, '3')], 180_000, 300);
    const second = confirmedAutoLevelCandles(history, [candle(180_000, '4')], 240_000, 300, first);

    expect(second).toEqual([candle(0, '1'), candle(60_000, '2'), candle(120_000, '3'), candle(180_000, '4')]);
  });
});

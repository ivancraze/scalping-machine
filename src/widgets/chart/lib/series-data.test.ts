import { describe, expect, it } from 'vitest';
import type { Candle, OpenInterestPoint } from '../../../entities/market';
import { toOpenInterestSeriesData } from './series-data';

const FIVE_MINUTES = 5 * 60_000;
const candle = (timestamp: number): Candle => [timestamp, '1', '2', '0.5', '1.5', '10'];

describe('open interest series data', () => {
  it('drops points outside candle history and uses only existing candle timestamps', () => {
    const candles = [candle(600_000), candle(660_000), candle(900_000)];
    const points: OpenInterestPoint[] = [
      { timestamp: 0, valueUsd: 1 },
      { timestamp: 600_000, valueUsd: 2 },
      { timestamp: 930_000, valueUsd: 3 },
      { timestamp: 1_200_000, valueUsd: 4 },
    ];

    expect(toOpenInterestSeriesData(points, candles, FIVE_MINUTES)).toEqual([
      { time: 600, value: 2 },
      { time: 900, value: 3 },
    ]);
  });

  it('aligns an unrounded live snapshot to the first candle in its OI bucket', () => {
    const candles = [candle(660_000), candle(720_000), candle(900_000)];

    expect(toOpenInterestSeriesData([{ timestamp: 630_000, valueUsd: 42 }], candles, FIVE_MINUTES)).toEqual([
      { time: 660, value: 42 },
    ]);
  });

  it('does not move OI into a later bucket when candles are sparse', () => {
    const candles = [candle(600_000), candle(1_200_000)];

    expect(toOpenInterestSeriesData([{ timestamp: 930_000, valueUsd: 42 }], candles, FIVE_MINUTES)).toEqual(
      [],
    );
  });
});

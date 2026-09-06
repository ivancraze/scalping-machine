import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_LEVEL_SETTINGS, type AutoLevelCandle, type AutoLevelSettings } from '../model/types';
import { detectAutoLevels } from './detect-auto-levels';

const MINUTE = 60_000;

function candle(index: number, low = 99, high = 101, close = 100): AutoLevelCandle {
  return [index * MINUTE, String(close), String(high), String(low), String(close), '1'];
}

function settings(overrides: Partial<AutoLevelSettings> = {}): AutoLevelSettings {
  return {
    ...DEFAULT_AUTO_LEVEL_SETTINGS,
    enabled: true,
    historySize: 300,
    nearPriceOnly: false,
    enabledTypes: { ...DEFAULT_AUTO_LEVEL_SETTINGS.enabledTypes },
    colors: { ...DEFAULT_AUTO_LEVEL_SETTINGS.colors },
    ...overrides,
  };
}

function candlesWithLevels(length = 60) {
  const result = Array.from({ length }, (_, index) => candle(index));
  for (const index of [10, 20, 30]) if (index < length) result[index] = candle(index, 90, 101, 100);
  for (const index of [15, 25, 35]) if (index < length) result[index] = candle(index, 99, 110, 100);
  return result;
}

describe('automatic level detection', () => {
  it('combines independently enabled breakout and EX detector results', () => {
    const levels = detectAutoLevels(
      candlesWithLevels(),
      settings({
        enabledDetectors: { breakout: true, extremum: true },
        extremumStrength: 'weak',
        enabledTypes: { support: true, resistance: true, trend: false },
      }),
    );

    expect(levels.some(({ detector }) => detector === 'breakout')).toBe(true);
    expect(levels.some(({ detector }) => detector === 'extremum')).toBe(true);
  });

  it('finds horizontal support and resistance after three independent pivots', () => {
    const levels = detectAutoLevels(
      candlesWithLevels(),
      settings({ enabledTypes: { support: true, resistance: true, trend: false } }),
    );

    expect(levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'support', projectedPrice: 90, touches: 3 }),
        expect.objectContaining({ kind: 'resistance', projectedPrice: 110, touches: 3 }),
      ]),
    );
  });

  it('does not use a pivot until five candles have closed on its right', () => {
    const candles = candlesWithLevels(35);

    expect(
      detectAutoLevels(
        candles,
        settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
      ),
    ).toEqual([]);
    expect(
      detectAutoLevels(
        [...candles, candle(35)],
        settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
      ),
    ).toHaveLength(1);
  });

  it('clusters prices inside the configured deviation and keeps a stable id after a new candle', () => {
    const candles = candlesWithLevels();
    candles[20] = candle(20, 90.1, 101, 100);
    candles[30] = candle(30, 89.9, 101, 100);
    const onlySupport = settings({ enabledTypes: { support: true, resistance: false, trend: false } });
    const first = detectAutoLevels(candles, onlySupport)[0];
    const second = detectAutoLevels([...candles, candle(60)], onlySupport)[0];

    expect(first).toMatchObject({ touches: 3, projectedPrice: 90 });
    expect(second.id).toBe(first.id);
  });

  it('counts only wick extrema that remain inside the final median zone', () => {
    const candles = Array.from({ length: 70 }, (_, index) => candle(index, 100.8, 102, 101.5));
    for (const [index, low] of [
      [10, 100],
      [20, 100.24],
      [30, 100.36],
      [40, 100.48],
    ] as const)
      candles[index] = candle(index, low, 102, 101.5);

    const levels = detectAutoLevels(
      candles,
      settings({
        deviationPercent: 0.25,
        enabledTypes: { support: true, resistance: false, trend: false },
      }),
    );

    expect(levels[0]).toMatchObject({ kind: 'support', touches: 3, projectedPrice: 100.36 });
  });

  it('removes a support after a close-through break', () => {
    const candles = candlesWithLevels();
    candles[45] = candle(45, 88, 91, 89);

    const levels = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
    );

    expect(levels).toHaveLength(0);
  });

  it('does not count horizontal pivots less than five candles apart as independent touches', () => {
    const candles = Array.from({ length: 60 }, (_, index) => candle(index));
    for (const index of [10, 13, 20]) candles[index] = candle(index, 90, 101, 100);

    const levels = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
    );

    expect(levels).toHaveLength(0);
  });

  it('finds a confirmed trend support and projects it to the newest candle', () => {
    const candles = Array.from({ length: 70 }, (_, index) => candle(index, 99, 105, 101));
    for (const [index, low] of [
      [10, 90],
      [30, 92],
      [50, 94],
    ] as const)
      candles[index] = candle(index, low, 105, 101);

    const levels = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: false, resistance: false, trend: true } }),
    );
    const trend = levels.find(({ kind }) => kind === 'trend-support');

    expect(trend).toMatchObject({ touches: 3, analysisInterval: '15m' });
    expect(trend?.projectedPrice).toBeCloseTo(95.9);
    expect(trend?.points).toHaveLength(2);
  });

  it('rejects a trend support after a close-through break', () => {
    const candles = Array.from({ length: 70 }, (_, index) => candle(index, 99, 105, 101));
    for (const [index, low] of [
      [10, 90],
      [30, 92],
      [50, 94],
    ] as const)
      candles[index] = candle(index, low, 105, 101);
    candles[69] = candle(69, 80, 105, 80);

    const levels = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: false, resistance: false, trend: true } }),
    );

    expect(levels.filter(({ kind }) => kind === 'trend-support')).toHaveLength(0);
  });

  it('caps horizontal output at eight ranked levels', () => {
    const candles = Array.from({ length: 300 }, (_, index) => candle(index, 180, 210, 200));
    for (let level = 0; level < 9; level += 1) {
      for (const cycle of [0, 1, 2]) {
        const index = 10 + level * 10 + cycle * 90;
        candles[index] = candle(index, 60 + level * 2, 210, 200);
      }
    }

    const levels = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
    );

    expect(levels).toHaveLength(8);
    expect(levels.every(({ kind }) => kind === 'support')).toBe(true);
  });

  it('can hide candidates ranked as weak', () => {
    const candles = Array.from({ length: 300 }, (_, index) => candle(index));
    for (const index of [10, 20, 30]) candles[index] = candle(index, 90, 101, 100);

    const visible = detectAutoLevels(
      candles,
      settings({ enabledTypes: { support: true, resistance: false, trend: false } }),
    );
    const hidden = detectAutoLevels(
      candles,
      settings({ hideWeak: true, enabledTypes: { support: true, resistance: false, trend: false } }),
    );

    expect(visible[0]?.weak).toBe(true);
    expect(hidden).toHaveLength(0);
  });

  it('keeps only horizontal breakout candidates near the current price', () => {
    const candles = candlesWithLevels();
    candles[candles.length - 1] = candle(candles.length - 1, 108.5, 109.7, 109.5);

    const levels = detectAutoLevels(
      candles,
      settings({
        nearPriceOnly: true,
        maxDistancePercent: 1,
        enabledTypes: { support: true, resistance: true, trend: false },
      }),
    );

    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({
      kind: 'resistance',
      breakoutDirection: 'up',
      distancePercent: expect.any(Number),
    });
    expect(levels[0].distancePercent).toBeLessThan(1);
  });

  it('marks nearby support as a breakout candidate directed down', () => {
    const candles = candlesWithLevels();
    candles[candles.length - 1] = candle(candles.length - 1, 90.2, 91, 90.5);

    const levels = detectAutoLevels(
      candles,
      settings({
        nearPriceOnly: true,
        maxDistancePercent: 1,
        enabledTypes: { support: true, resistance: true, trend: false },
      }),
    );

    expect(levels).toHaveLength(1);
    expect(levels[0]).toMatchObject({
      kind: 'support',
      breakoutDirection: 'down',
      distancePercent: expect.any(Number),
    });
    expect(levels[0].distancePercent).toBeLessThan(1);
  });

  it('marks a compact series of tests near resistance as compression', () => {
    const candles = candlesWithLevels();
    for (let index = candles.length - 12; index < candles.length; index += 1) {
      const progress = index - (candles.length - 12);
      candles[index] = candle(index, 108.4 + progress * 0.04, 109.9, 109.6);
    }

    const levels = detectAutoLevels(
      candles,
      settings({
        nearPriceOnly: true,
        maxDistancePercent: 1,
        enabledTypes: { support: false, resistance: true, trend: false },
      }),
    );

    expect(levels[0]).toMatchObject({
      kind: 'resistance',
      breakoutDirection: 'up',
      compression: true,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_LEVEL_SETTINGS, type AutoLevelCandle, type AutoLevelSettings } from '../model/types';
import { autoExtremumZonePercent, detectExtremumLevels } from './detect-extremum-levels';

const MINUTE = 60_000;

function candle(index: number, low = 99, high = 101, close = 100): AutoLevelCandle {
  return [index * MINUTE, String(close), String(high), String(low), String(close), '1'];
}

function settings(overrides: Partial<AutoLevelSettings> = {}): AutoLevelSettings {
  return {
    ...DEFAULT_AUTO_LEVEL_SETTINGS,
    enabled: true,
    historySize: 300,
    enabledDetectors: { breakout: false, extremum: true },
    extremumStrength: 'weak',
    enabledTypes: { support: false, resistance: true, trend: false },
    colors: { ...DEFAULT_AUTO_LEVEL_SETTINGS.colors },
    ...overrides,
  };
}

describe('EX swing-extremum level detection', () => {
  it('shows an unbroken wick extremum without requiring repeated touches', () => {
    const candles = Array.from({ length: 30 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);

    expect(detectExtremumLevels(candles, settings())).toEqual([
      expect.objectContaining({
        detector: 'extremum',
        kind: 'resistance',
        projectedPrice: 110,
        touches: 1,
        broken: false,
        points: [{ timestamp: (10 * MINUTE) / 1000, price: 110 }],
      }),
    ]);
  });

  it('merges nearby wick extremums and applies two- or three-touch confirmation', () => {
    const candles = Array.from({ length: 40 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);
    candles[20] = candle(20, 99, 109.9, 100);

    const confirmed = detectExtremumLevels(candles, settings({ extremumMinTouches: 2 }));
    const rejected = detectExtremumLevels(candles, settings({ extremumMinTouches: 3 }));

    expect(confirmed[0]).toMatchObject({
      touches: 2,
      projectedPrice: 110,
      points: [{ timestamp: (10 * MINUTE) / 1000, price: 110 }],
    });
    expect(rejected).toHaveLength(0);
  });

  it('confirms a level from three wick extremums in the adaptive zone', () => {
    const candles = Array.from({ length: 50 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);
    candles[20] = candle(20, 99, 109.9, 100);
    candles[30] = candle(30, 99, 109.8, 100);

    const levels = detectExtremumLevels(candles, settings({ extremumMinTouches: 3 }));

    expect(levels[0]).toMatchObject({ detector: 'extremum', touches: 3, projectedPrice: 110 });
  });

  it('selects the nearest unbroken levels instead of balancing sides or preferring score', () => {
    const candles = Array.from({ length: 50 }, (_, index) => candle(index));
    candles[5] = candle(5, 99, 115, 100);
    candles[10] = candle(10, 99, 114.9, 100);
    candles[20] = candle(20, 99, 110, 100);
    candles[30] = candle(30, 99, 105, 100);

    const levels = detectExtremumLevels(candles, settings({ extremumLimit: 3 }));

    expect(levels.map(({ projectedPrice }) => projectedPrice)).toEqual([105, 110, 115]);
    expect(levels[2].touches).toBe(2);
  });

  it('uses the dedicated EX history depth independently from breakout history', () => {
    const candles = Array.from({ length: 260 }, (_, index) => candle(index));
    candles[20] = candle(20, 99, 110, 100);

    const short = detectExtremumLevels(candles, settings({ historySize: 1000, extremumHistorySize: 200 }));
    const long = detectExtremumLevels(candles, settings({ historySize: 300, extremumHistorySize: 500 }));

    expect(short).toEqual([]);
    expect(long).toEqual([expect.objectContaining({ projectedPrice: 110 })]);
  });

  it('uses swing strength to require more neighboring candles around an extremum', () => {
    const candles = Array.from({ length: 35 }, (_, index) => candle(index));
    candles[7] = candle(7, 99, 112, 100);
    candles[10] = candle(10, 99, 110, 100);

    const weak = detectExtremumLevels(candles, settings({ extremumStrength: 'weak' }));
    const medium = detectExtremumLevels(candles, settings({ extremumStrength: 'medium' }));

    expect(weak).toEqual(expect.arrayContaining([expect.objectContaining({ projectedPrice: 110 })]));
    expect(medium.some(({ projectedPrice }) => projectedPrice === 110)).toBe(false);
  });

  it('replaces a broken level with a new same-zone swing instead of reviving the old ray', () => {
    const candles = Array.from({ length: 50 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);
    candles[25] = candle(25, 99, 113, 100);
    candles[35] = candle(35, 99, 110.1, 100);

    const active = detectExtremumLevels(candles, settings());
    const withBroken = detectExtremumLevels(candles, settings({ showBrokenExtremums: true }));
    const oldId = `pulse:auto-level:ex:resistance:${(10 * MINUTE) / 1000}`;
    const replacementId = `pulse:auto-level:ex:resistance:${(35 * MINUTE) / 1000}`;

    expect(active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: replacementId,
          projectedPrice: 110.1,
          points: [{ timestamp: (35 * MINUTE) / 1000, price: 110.1 }],
          touches: 1,
          broken: false,
        }),
      ]),
    );
    expect(active.some(({ id }) => id === oldId)).toBe(false);
    expect(withBroken.some(({ id }) => id === oldId)).toBe(false);
  });

  it('can expose a wick-broken level when no later same-zone swing replaces it', () => {
    const candles = Array.from({ length: 35 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);
    candles[25] = candle(25, 99, 113, 100);

    const active = detectExtremumLevels(candles, settings());
    const withBroken = detectExtremumLevels(candles, settings({ showBrokenExtremums: true }));

    expect(active.some(({ projectedPrice }) => projectedPrice === 110)).toBe(false);
    expect(withBroken).toEqual(
      expect.arrayContaining([expect.objectContaining({ projectedPrice: 110, broken: true, touches: 1 })]),
    );
  });

  it('reanchors after any wick crossing even when it remains inside the adaptive zone', () => {
    const candles = Array.from({ length: 40 }, (_, index) => candle(index));
    candles[10] = candle(10, 99, 110, 100);
    candles[25] = candle(25, 99, 110.1, 100);

    const levels = detectExtremumLevels(candles, settings());

    expect(levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `pulse:auto-level:ex:resistance:${(25 * MINUTE) / 1000}`,
          projectedPrice: 110.1,
          points: [{ timestamp: (25 * MINUTE) / 1000, price: 110.1 }],
        }),
      ]),
    );
    expect(levels.some(({ id }) => id === `pulse:auto-level:ex:resistance:${(10 * MINUTE) / 1000}`)).toBe(
      false,
    );
  });

  it('applies the same post-extremum wick break rule to support', () => {
    const candles = Array.from({ length: 50 }, (_, index) => candle(index));
    candles[10] = candle(10, 90, 101, 100);
    candles[25] = candle(25, 87, 101, 100);
    candles[35] = candle(35, 89.9, 101, 100);
    const supportOnly = {
      enabledTypes: { support: true, resistance: false, trend: false },
    } as const;

    const active = detectExtremumLevels(candles, settings(supportOnly));
    const withBroken = detectExtremumLevels(candles, settings({ ...supportOnly, showBrokenExtremums: true }));

    expect(active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'support',
          projectedPrice: 89.9,
          points: [{ timestamp: (35 * MINUTE) / 1000, price: 89.9 }],
          broken: false,
        }),
      ]),
    );
    expect(withBroken.some(({ projectedPrice }) => projectedPrice === 90)).toBe(false);
  });

  it('limits output and keeps ids stable when a candle is appended', () => {
    const candles = Array.from({ length: 120 }, (_, index) => candle(index));
    for (let index = 5; index <= 95; index += 10) candles[index] = candle(index, 99, 110 + index / 2, 100);
    const configured = settings({ extremumLimit: 7, showBrokenExtremums: true });
    const first = detectExtremumLevels(candles, configured);
    const second = detectExtremumLevels([...candles, candle(120)], configured);

    expect(first).toHaveLength(7);
    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });

  it('clamps the volatility-derived touch zone to 0.5–2 percent', () => {
    expect(autoExtremumZonePercent([candle(0, 99.9, 100.1, 100)])).toBe(0.5);
    expect(autoExtremumZonePercent([candle(0, 90, 110, 100)])).toBe(2);
  });
});

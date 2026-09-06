import {
  AUTO_LEVEL_ID_PREFIX,
  type AutoLevelCandle,
  type AutoLevelKind,
  type AutoLevelSettings,
  type DetectedAutoLevel,
} from '../model/types';
import { detectExtremumLevels } from './detect-extremum-levels';

const PIVOT_RADIUS = 5;
const MIN_TOUCH_DISTANCE = 5;
const MIN_TREND_ANCHOR_DISTANCE = 20;
const COMPRESSION_LOOKBACK = 12;

type NumericCandle = {
  index: number;
  timestamp: number;
  high: number;
  low: number;
  close: number;
};

type Pivot = {
  index: number;
  timestamp: number;
  price: number;
};

type RankedCandidate = DetectedAutoLevel & {
  firstTouchIndex: number;
  lastTouchIndex: number;
  meanNormalizedError: number;
  slope?: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const relativeDifference = (left: number, right: number) =>
  right === 0 ? Number.POSITIVE_INFINITY : Math.abs(left / right - 1);

function normalizeCandles(candles: AutoLevelCandle[], historySize: number): NumericCandle[] {
  return candles
    .slice(-historySize)
    .map((candle, index) => ({
      index,
      timestamp: candle[0] / 1000,
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
    }))
    .filter(
      ({ timestamp, high, low, close }) =>
        Number.isFinite(timestamp) &&
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        Number.isFinite(close) &&
        high >= low,
    )
    .map((candle, index) => ({ ...candle, index }));
}

function findPivots(candles: NumericCandle[]) {
  const lows: Pivot[] = [];
  const highs: Pivot[] = [];
  for (let index = PIVOT_RADIUS; index < candles.length - PIVOT_RADIUS; index += 1) {
    const candle = candles[index];
    const neighbors = candles.slice(index - PIVOT_RADIUS, index + PIVOT_RADIUS + 1);
    const neighborLows = neighbors.filter((_, offset) => offset !== PIVOT_RADIUS).map(({ low }) => low);
    const neighborHighs = neighbors.filter((_, offset) => offset !== PIVOT_RADIUS).map(({ high }) => high);
    if (
      neighborLows.every((price) => candle.low <= price) &&
      neighborLows.some((price) => candle.low < price)
    )
      lows.push({ index, timestamp: candle.timestamp, price: candle.low });
    if (
      neighborHighs.every((price) => candle.high >= price) &&
      neighborHighs.some((price) => candle.high > price)
    )
      highs.push({ index, timestamp: candle.timestamp, price: candle.high });
  }
  return { lows, highs };
}

function independentTouches(pivots: Pivot[], center: number) {
  const touches: Pivot[] = [];
  for (const pivot of [...pivots].sort((left, right) => left.index - right.index)) {
    const previous = touches.at(-1);
    if (!previous || pivot.index - previous.index >= MIN_TOUCH_DISTANCE) {
      touches.push(pivot);
      continue;
    }
    if (relativeDifference(pivot.price, center) < relativeDifference(previous.price, center))
      touches[touches.length - 1] = pivot;
  }
  return touches;
}

function clusterPivots(pivots: Pivot[], tolerance: number) {
  const clusters: Pivot[][] = [];
  for (const pivot of [...pivots].sort((left, right) => left.price - right.price)) {
    let closest: Pivot[] | undefined;
    let closestDifference = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const difference = relativeDifference(pivot.price, median(cluster.map(({ price }) => price)));
      if (difference <= tolerance && difference < closestDifference) {
        closest = cluster;
        closestDifference = difference;
      }
    }
    if (closest) closest.push(pivot);
    else clusters.push([pivot]);
  }
  return clusters;
}

function centeredTouches(pivots: Pivot[], tolerance: number) {
  if (pivots.length === 0) return { center: 0, touches: [] as Pivot[] };
  let center = median(pivots.map(({ price }) => price));
  let touches = independentTouches(pivots, center);
  for (let iteration = 0; iteration < 2 && touches.length > 0; iteration += 1) {
    center = median(touches.map(({ price }) => price));
    touches = independentTouches(
      pivots.filter(({ price }) => relativeDifference(price, center) <= tolerance),
      center,
    );
  }
  if (touches.length > 0) center = median(touches.map(({ price }) => price));
  return { center, touches };
}

function scoreCandidate(
  touches: Pivot[],
  candleCount: number,
  minTouches: number,
  meanNormalizedError: number,
) {
  const denominator = Math.max(candleCount - 1, 1);
  const firstIndex = touches[0].index;
  const lastIndex = touches.at(-1)?.index ?? firstIndex;
  const touchFactor = Math.min(touches.length / (minTouches + 3), 1);
  const spanFactor = (lastIndex - firstIndex) / denominator;
  const recencyFactor = 1 - (candleCount - 1 - lastIndex) / denominator;
  const accuracyFactor = 1 - Math.min(meanNormalizedError, 1);
  return Math.round(
    100 * (0.5 * touchFactor + 0.2 * spanFactor + 0.2 * recencyFactor + 0.1 * accuracyFactor),
  );
}

function isBroken(kind: AutoLevelKind, close: number, linePrice: number, tolerance: number) {
  if (kind === 'support' || kind === 'trend-support') return close < linePrice * (1 - tolerance);
  return close > linePrice * (1 + tolerance);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function breakoutState(
  candles: NumericCandle[],
  kind: 'support' | 'resistance',
  levelPrice: number,
  tolerance: number,
  maxDistancePercent: number,
) {
  const latestClose = candles.at(-1)?.close ?? levelPrice;
  const distancePercent = relativeDifference(latestClose, levelPrice) * 100;
  const recent = candles.slice(-COMPRESSION_LOOKBACK);
  const middle = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, middle);
  const secondHalf = recent.slice(middle);
  const wickPrices = recent.map((candle) => (kind === 'resistance' ? candle.high : candle.low));
  const nearWicks = wickPrices.filter(
    (price) => relativeDifference(price, levelPrice) <= tolerance * 2,
  ).length;
  const recentHigh = Math.max(...recent.map(({ high }) => high));
  const recentLow = Math.min(...recent.map(({ low }) => low));
  const rangePercent = relativeDifference(recentHigh, recentLow) * 100;
  const pressureTowardLevel =
    kind === 'resistance'
      ? average(secondHalf.map(({ low }) => low)) >= average(firstHalf.map(({ low }) => low))
      : average(secondHalf.map(({ high }) => high)) <= average(firstHalf.map(({ high }) => high));
  const remainsBeforeBreakout = recent.every(({ close }) =>
    kind === 'resistance' ? close <= levelPrice * (1 + tolerance) : close >= levelPrice * (1 - tolerance),
  );
  const compactRangePercent = Math.max(maxDistancePercent * 2, tolerance * 400);
  return {
    distancePercent,
    breakoutDirection: kind === 'resistance' ? ('up' as const) : ('down' as const),
    compression:
      recent.length === COMPRESSION_LOOKBACK &&
      distancePercent <= maxDistancePercent &&
      nearWicks >= 3 &&
      rangePercent <= compactRangePercent &&
      pressureTowardLevel &&
      remainsBeforeBreakout,
  };
}

function horizontalCandidates(
  candles: NumericCandle[],
  pivots: Pivot[],
  kind: 'support' | 'resistance',
  settings: AutoLevelSettings,
): RankedCandidate[] {
  const tolerance = settings.deviationPercent / 100;
  return clusterPivots(pivots, tolerance).flatMap((cluster) => {
    let { center, touches } = centeredTouches(cluster, tolerance);
    if (touches.length === 0) return [];
    let lastBreakIndex = -1;
    for (let index = touches[0].index; index < candles.length; index += 1) {
      if (isBroken(kind, candles[index].close, center, tolerance)) lastBreakIndex = index;
    }
    ({ center, touches } = centeredTouches(
      touches.filter(({ index }) => index > lastBreakIndex),
      tolerance,
    ));
    if (touches.length < settings.minTouches) return [];
    const normalizedErrors = touches.map(({ price }) => relativeDifference(price, center) / tolerance);
    const meanNormalizedError = normalizedErrors.reduce((sum, value) => sum + value, 0) / touches.length;
    const score = scoreCandidate(touches, candles.length, settings.minTouches, meanNormalizedError);
    const firstTouch = touches[0];
    const secondTouch = touches[1];
    const lastTouch = touches.at(-1) ?? firstTouch;
    const breakout = breakoutState(candles, kind, center, tolerance, settings.maxDistancePercent);
    return [
      {
        id: `${AUTO_LEVEL_ID_PREFIX}${kind}:${firstTouch.timestamp}:${secondTouch.timestamp}`,
        detector: 'breakout',
        kind,
        points: [{ timestamp: firstTouch.timestamp, price: center }],
        projectedPrice: center,
        touches: touches.length,
        score,
        weak: score < 50,
        analysisInterval: settings.interval,
        frozen: false,
        ...breakout,
        firstTouchIndex: firstTouch.index,
        lastTouchIndex: lastTouch.index,
        meanNormalizedError,
      },
    ];
  });
}

function linePriceAt(first: Pivot, second: Pivot, index: number) {
  const slope = (second.price - first.price) / (second.index - first.index);
  return first.price + slope * (index - first.index);
}

function trendCandidates(
  candles: NumericCandle[],
  pivots: Pivot[],
  kind: 'trend-support' | 'trend-resistance',
  settings: AutoLevelSettings,
): RankedCandidate[] {
  const tolerance = settings.deviationPercent / 100;
  const byId = new Map<string, RankedCandidate>();
  for (let firstIndex = 0; firstIndex < pivots.length - 1; firstIndex += 1) {
    const first = pivots[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < pivots.length; secondIndex += 1) {
      const second = pivots[secondIndex];
      if (second.index - first.index < MIN_TREND_ANCHOR_DISTANCE) continue;
      const touches = pivots.filter((pivot) => {
        if (pivot.index < first.index) return false;
        return relativeDifference(pivot.price, linePriceAt(first, second, pivot.index)) <= tolerance;
      });
      if (touches.length < settings.minTouches) continue;
      let broken = false;
      for (let index = first.index; index < candles.length; index += 1) {
        if (isBroken(kind, candles[index].close, linePriceAt(first, second, index), tolerance)) {
          broken = true;
          break;
        }
      }
      if (broken) continue;
      const normalizedErrors = touches.map(
        (pivot) => relativeDifference(pivot.price, linePriceAt(first, second, pivot.index)) / tolerance,
      );
      const meanNormalizedError = normalizedErrors.reduce((sum, value) => sum + value, 0) / touches.length;
      const score = scoreCandidate(touches, candles.length, settings.minTouches, meanNormalizedError);
      const firstTouch = touches[0];
      const secondTouch = touches[1];
      const lastTouch = touches.at(-1) ?? firstTouch;
      const id = `${AUTO_LEVEL_ID_PREFIX}${kind}:${firstTouch.timestamp}:${secondTouch.timestamp}`;
      const candidate: RankedCandidate = {
        id,
        detector: 'breakout',
        kind,
        points: [
          { timestamp: first.timestamp, price: first.price },
          { timestamp: second.timestamp, price: second.price },
        ],
        projectedPrice: linePriceAt(first, second, candles.length - 1),
        touches: touches.length,
        score,
        weak: score < 50,
        analysisInterval: settings.interval,
        frozen: false,
        firstTouchIndex: firstTouch.index,
        lastTouchIndex: lastTouch.index,
        meanNormalizedError,
        slope: (second.price - first.price) / (second.index - first.index),
      };
      const previous = byId.get(id);
      if (!previous || compareCandidates(candidate, previous) < 0) byId.set(id, candidate);
    }
  }
  return deduplicateTrends([...byId.values()], tolerance, candles.length);
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate) {
  return (
    Number(Boolean(right.compression)) - Number(Boolean(left.compression)) ||
    (left.distancePercent ?? Number.POSITIVE_INFINITY) -
      (right.distancePercent ?? Number.POSITIVE_INFINITY) ||
    right.score - left.score ||
    right.touches - left.touches ||
    right.lastTouchIndex - left.lastTouchIndex ||
    left.meanNormalizedError - right.meanNormalizedError ||
    left.id.localeCompare(right.id)
  );
}

function deduplicateTrends(candidates: RankedCandidate[], tolerance: number, candleCount: number) {
  const selected: RankedCandidate[] = [];
  for (const candidate of [...candidates].sort(compareCandidates)) {
    const duplicate = selected.some((existing) => {
      if (existing.kind !== candidate.kind) return false;
      const endDifference = relativeDifference(candidate.projectedPrice, existing.projectedPrice);
      const slopeDifference =
        Math.abs((candidate.slope ?? 0) - (existing.slope ?? 0)) * Math.max(candleCount - 1, 1);
      const scale = Math.max(Math.abs(candidate.projectedPrice), Math.abs(existing.projectedPrice), 1);
      return endDifference <= tolerance && slopeDifference / scale <= tolerance;
    });
    if (!duplicate) selected.push(candidate);
  }
  return selected;
}

function takeBalanced(
  candidates: RankedCandidate[],
  firstKind: AutoLevelKind,
  secondKind: AutoLevelKind,
  total: number,
) {
  const sorted = [...candidates].sort(compareCandidates);
  const perKind = total / 2;
  const selected = [
    ...sorted.filter(({ kind }) => kind === firstKind).slice(0, perKind),
    ...sorted.filter(({ kind }) => kind === secondKind).slice(0, perKind),
  ];
  const selectedIds = new Set(selected.map(({ id }) => id));
  for (const candidate of sorted) {
    if (selected.length >= total) break;
    if (!selectedIds.has(candidate.id)) {
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  }
  return selected.sort(compareCandidates);
}

function stripRanking(candidate: RankedCandidate): DetectedAutoLevel {
  return {
    id: candidate.id,
    detector: candidate.detector,
    kind: candidate.kind,
    points: candidate.points,
    projectedPrice: candidate.projectedPrice,
    touches: candidate.touches,
    score: candidate.score,
    weak: candidate.weak,
    analysisInterval: candidate.analysisInterval,
    frozen: candidate.frozen,
    distancePercent: candidate.distancePercent,
    breakoutDirection: candidate.breakoutDirection,
    compression: candidate.compression,
  };
}

export function detectAutoLevels(
  candles: AutoLevelCandle[],
  settings: AutoLevelSettings,
): DetectedAutoLevel[] {
  const extremums = settings.enabledDetectors.extremum ? detectExtremumLevels(candles, settings) : [];
  if (!settings.enabledDetectors.breakout) return extremums;
  const normalized = normalizeCandles(candles, settings.historySize);
  if (normalized.length < PIVOT_RADIUS * 2 + 1) return extremums;
  const pivots = findPivots(normalized);
  const horizontal: RankedCandidate[] = [];
  if (settings.enabledTypes.support)
    horizontal.push(...horizontalCandidates(normalized, pivots.lows, 'support', settings));
  if (settings.enabledTypes.resistance)
    horizontal.push(...horizontalCandidates(normalized, pivots.highs, 'resistance', settings));
  const trends = settings.enabledTypes.trend
    ? [
        ...trendCandidates(normalized, pivots.lows, 'trend-support', settings),
        ...trendCandidates(normalized, pivots.highs, 'trend-resistance', settings),
      ]
    : [];
  const visible = (candidate: RankedCandidate) => !settings.hideWeak || !candidate.weak;
  const nearPrice = (candidate: RankedCandidate) =>
    !settings.nearPriceOnly ||
    candidate.distancePercent === undefined ||
    candidate.distancePercent <= settings.maxDistancePercent;
  return [
    ...takeBalanced(horizontal.filter(visible).filter(nearPrice), 'support', 'resistance', 8),
    ...takeBalanced(trends.filter(visible), 'trend-support', 'trend-resistance', 4),
  ]
    .map(stripRanking)
    .concat(extremums);
}

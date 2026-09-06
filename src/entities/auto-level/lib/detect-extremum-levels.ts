import {
  AUTO_LEVEL_ID_PREFIX,
  type AutoLevelCandle,
  type AutoLevelSettings,
  type DetectedAutoLevel,
  type ExtremumLevelStrength,
} from '../model/types';

type NumericCandle = {
  index: number;
  timestamp: number;
  high: number;
  low: number;
  close: number;
};

type Extremum = {
  index: number;
  timestamp: number;
  price: number;
  prominence: number;
};

type RankedExtremumLevel = DetectedAutoLevel & {
  lastTouchIndex: number;
  prominence: number;
  distancePercent: number;
};

const strengthRadius: Record<ExtremumLevelStrength, number> = {
  weak: 2,
  medium: 5,
  strong: 10,
};

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const relativeDifference = (left: number, right: number) =>
  right === 0 ? Number.POSITIVE_INFINITY : Math.abs(left / right - 1);

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

function normalizeCandles(candles: AutoLevelCandle[], historySize: number): NumericCandle[] {
  return candles
    .slice(-historySize)
    .map((candle) => ({
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
        close > 0 &&
        high >= low,
    )
    .map((candle, index) => ({ ...candle, index }));
}

export function autoExtremumZonePercent(candles: AutoLevelCandle[]) {
  const ranges = candles.flatMap((candle) => {
    const high = Number(candle[2]);
    const low = Number(candle[3]);
    const close = Number(candle[4]);
    return Number.isFinite(high) && Number.isFinite(low) && close > 0 ? [((high - low) / close) * 100] : [];
  });
  return ranges.length === 0 ? 0.5 : clamp(median(ranges), 0.5, 2);
}

function findExtremums(candles: NumericCandle[], radius: number) {
  const lows: Extremum[] = [];
  const highs: Extremum[] = [];
  for (let index = radius; index < candles.length - radius; index += 1) {
    const candle = candles[index];
    const neighbors = candles
      .slice(index - radius, index + radius + 1)
      .filter((_, offset) => offset !== radius);
    const neighborLow = Math.min(...neighbors.map(({ low }) => low));
    const neighborHigh = Math.max(...neighbors.map(({ high }) => high));
    if (candle.low < neighborLow) {
      lows.push({
        index,
        timestamp: candle.timestamp,
        price: candle.low,
        prominence: relativeDifference(candle.low, neighborLow),
      });
    }
    if (candle.high > neighborHigh) {
      highs.push({
        index,
        timestamp: candle.timestamp,
        price: candle.high,
        prominence: relativeDifference(candle.high, neighborHigh),
      });
    }
  }
  return { lows, highs };
}

function clusterExtremums(extremums: Extremum[], tolerance: number) {
  const clusters: Extremum[][] = [];
  for (const extremum of [...extremums].sort((left, right) => left.price - right.price)) {
    let closest: Extremum[] | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const distance = relativeDifference(extremum.price, median(cluster.map(({ price }) => price)));
      if (distance <= tolerance && distance < closestDistance) {
        closest = cluster;
        closestDistance = distance;
      }
    }
    if (closest) closest.push(extremum);
    else clusters.push([extremum]);
  }
  return clusters;
}

function compareLevels(left: RankedExtremumLevel, right: RankedExtremumLevel) {
  return (
    Number(left.broken) - Number(right.broken) ||
    left.distancePercent - right.distancePercent ||
    right.touches - left.touches ||
    right.prominence - left.prominence ||
    right.lastTouchIndex - left.lastTouchIndex ||
    left.id.localeCompare(right.id)
  );
}

function toLevel(
  candles: NumericCandle[],
  cluster: Extremum[],
  kind: 'support' | 'resistance',
  tolerance: number,
  zonePercent: number,
  settings: AutoLevelSettings,
): RankedExtremumLevel | null {
  const clusterCenter = median(cluster.map(({ price }) => price));
  const centered = cluster
    .filter(({ price }) => relativeDifference(price, clusterCenter) <= tolerance)
    .sort((left, right) => left.index - right.index);
  const isBrokenAfter = (touch: Extremum) =>
    candles
      .slice(touch.index + 1)
      .some((candle) => (kind === 'support' ? candle.low < touch.price : candle.high > touch.price));
  const firstTouch = centered.find((touch) => !isBrokenAfter(touch)) ?? centered[0];
  if (!firstTouch) return null;
  const center = firstTouch.price;
  const touches = centered.filter(
    ({ index, price }) => index >= firstTouch.index && relativeDifference(price, center) <= tolerance,
  );
  if (touches.length < settings.extremumMinTouches) return null;
  const lastTouch = touches.at(-1) ?? firstTouch;
  const broken = isBrokenAfter(firstTouch);
  if (broken && !settings.showBrokenExtremums) return null;
  const averageProminence =
    touches.reduce((sum, touch) => sum + touch.prominence, 0) / Math.max(touches.length, 1);
  const touchScore = Math.min(touches.length / 3, 1);
  const prominenceScore = Math.min(averageProminence / Math.max(tolerance, Number.EPSILON), 1);
  const recencyScore = 1 - (candles.length - 1 - lastTouch.index) / Math.max(candles.length - 1, 1);
  const score = Math.round(100 * (0.3 * touchScore + 0.5 * prominenceScore + 0.2 * recencyScore));
  const lastClose = candles.at(-1)?.close ?? center;
  return {
    id: `${AUTO_LEVEL_ID_PREFIX}ex:${kind}:${firstTouch.timestamp}`,
    detector: 'extremum',
    kind,
    points: [{ timestamp: firstTouch.timestamp, price: center }],
    projectedPrice: center,
    touches: touches.length,
    score,
    weak: score < 50,
    analysisInterval: settings.interval,
    frozen: false,
    broken,
    zonePercent,
    lastTouchIndex: lastTouch.index,
    prominence: averageProminence,
    distancePercent: relativeDifference(center, lastClose) * 100,
  };
}

export function detectExtremumLevels(
  source: AutoLevelCandle[],
  settings: AutoLevelSettings,
): DetectedAutoLevel[] {
  const candles = normalizeCandles(source, settings.extremumHistorySize);
  const radius = strengthRadius[settings.extremumStrength];
  if (candles.length < radius * 2 + 1) return [];
  const zonePercent = autoExtremumZonePercent(source.slice(-settings.extremumHistorySize));
  const tolerance = zonePercent / 200;
  const extrema = findExtremums(candles, radius);
  const candidates: RankedExtremumLevel[] = [];
  if (settings.enabledTypes.support) {
    for (const cluster of clusterExtremums(extrema.lows, tolerance)) {
      const candidate = toLevel(candles, cluster, 'support', tolerance, zonePercent, settings);
      if (candidate && (!settings.hideWeak || !candidate.weak)) candidates.push(candidate);
    }
  }
  if (settings.enabledTypes.resistance) {
    for (const cluster of clusterExtremums(extrema.highs, tolerance)) {
      const candidate = toLevel(candles, cluster, 'resistance', tolerance, zonePercent, settings);
      if (candidate && (!settings.hideWeak || !candidate.weak)) candidates.push(candidate);
    }
  }
  return candidates
    .sort(compareLevels)
    .slice(0, settings.extremumLimit)
    .map((candidate) => ({
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
      broken: candidate.broken,
      zonePercent: candidate.zonePercent,
      distancePercent: candidate.distancePercent,
    }));
}

import type { AutoLevelCandle } from '../../../entities/auto-level';

export function mergeAutoLevelCandles(history: AutoLevelCandle[], latest: AutoLevelCandle[]) {
  const byOpenTime = new Map<number, AutoLevelCandle>();
  for (const candle of history) byOpenTime.set(candle[0], candle);
  for (const candle of latest) byOpenTime.set(candle[0], candle);
  return [...byOpenTime.values()].sort((left, right) => left[0] - right[0]);
}

export function confirmedAutoLevelCandles(
  history: AutoLevelCandle[],
  confirmedLatest: AutoLevelCandle[],
  newestObservedOpenTime: number,
  historySize: number,
  accumulated: AutoLevelCandle[] = [],
) {
  const historyTail = history.slice(-(historySize + 1));
  const accumulatedTail = accumulated.slice(-(historySize + 1));
  const latestTail = confirmedLatest.slice(-(historySize + 1));
  return mergeAutoLevelCandles([...historyTail, ...accumulatedTail], latestTail)
    .filter(([openTime]) => openTime < newestObservedOpenTime)
    .slice(-historySize);
}

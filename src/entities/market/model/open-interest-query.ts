import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getOpenInterestHistory } from '../api/binance';
import { runGridRequest } from '../api/grid-request-pool';
import type { OpenInterestPeriod, OpenInterestPoint } from './open-interest';
import { marketQueryKeys } from './query-keys';

const OPEN_INTEREST_PAGE_SIZE = 500;
const OPEN_INTEREST_MAX_AGE = 30 * 24 * 60 * 60_000;

type OpenInterestPageParam = { direction: 'initial' } | { direction: 'older'; endTime: number };

export type OpenInterestPage = {
  points: OpenInterestPoint[];
  reachesOlderEnd: boolean;
};

export function openInterestPeriodForInterval(interval: string): OpenInterestPeriod {
  if (interval === '15m') return '15m';
  if (interval === '30m') return '30m';
  if (interval === '1h') return '1h';
  if (interval === '4h') return '4h';
  if (interval === '1d') return '1d';
  return '5m';
}

export function useOpenInterestHistoryQuery(symbol: string, period: OpenInterestPeriod, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: marketQueryKeys.openInterestHistory(symbol, period),
    queryFn: async ({ pageParam, signal }): Promise<OpenInterestPage> => {
      const points = await getOpenInterestHistory(symbol, period, {
        limit: OPEN_INTEREST_PAGE_SIZE,
        endTime: pageParam.direction === 'older' ? pageParam.endTime : undefined,
        signal,
      });
      const oldestTimestamp = points[0]?.timestamp;
      return {
        points,
        reachesOlderEnd:
          points.length < OPEN_INTEREST_PAGE_SIZE ||
          oldestTimestamp === undefined ||
          oldestTimestamp <= Date.now() - OPEN_INTEREST_MAX_AGE,
      };
    },
    initialPageParam: { direction: 'initial' } as OpenInterestPageParam,
    getNextPageParam: (lastPage): OpenInterestPageParam | undefined => {
      const firstPoint = lastPage.points[0];
      if (lastPage.reachesOlderEnd || !firstPoint) return undefined;
      return { direction: 'older', endTime: firstPoint.timestamp - 1 };
    },
    staleTime: Infinity,
    enabled,
  });
}

export function useGridOpenInterestQuery(symbol: string, period: OpenInterestPeriod, enabled: boolean) {
  return useQuery({
    queryKey: marketQueryKeys.gridOpenInterest(symbol, period),
    queryFn: ({ signal }) =>
      runGridRequest(signal, () => getOpenInterestHistory(symbol, period, { limit: 120, signal })),
    staleTime: 60_000,
    enabled,
  });
}

export function mergeOpenInterestPages(pages: OpenInterestPage[] | undefined): OpenInterestPoint[] {
  if (!pages) return [];
  const pointsByTime = new Map<number, OpenInterestPoint>();
  for (const page of pages) {
    for (const point of page.points) pointsByTime.set(point.timestamp, point);
  }
  return [...pointsByTime.values()].sort((left, right) => left.timestamp - right.timestamp);
}

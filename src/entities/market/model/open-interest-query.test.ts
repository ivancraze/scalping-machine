import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOpenInterestHistory: vi.fn(),
  useInfiniteQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery: mocks.useInfiniteQuery }));
vi.mock('../api/binance', () => ({ getOpenInterestHistory: mocks.getOpenInterestHistory }));

import {
  mergeOpenInterestPages,
  openInterestPeriodForInterval,
  useOpenInterestHistoryQuery,
} from './open-interest-query';

type QueryOptions = {
  queryFn: (context: {
    pageParam: { direction: 'initial' } | { direction: 'older'; endTime: number };
    signal: AbortSignal;
  }) => Promise<{ points: { timestamp: number; valueUsd: number }[]; reachesOlderEnd: boolean }>;
  getNextPageParam: (page: {
    points: { timestamp: number; valueUsd: number }[];
    reachesOlderEnd: boolean;
  }) => unknown;
};

describe('open interest history query', () => {
  let options: QueryOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useInfiniteQuery.mockImplementation((queryOptions: QueryOptions) => {
      options = queryOptions;
      return queryOptions;
    });
  });

  it('uses honest Binance periods for every chart interval', () => {
    expect(['1s', '5s', '15s', '1m'].map(openInterestPeriodForInterval)).toEqual(['5m', '5m', '5m', '5m']);
    expect(['5m', '15m', '1h', '4h', '1d'].map(openInterestPeriodForInterval)).toEqual([
      '5m',
      '15m',
      '1h',
      '4h',
      '1d',
    ]);
  });

  it('requests older pages from the preceding timestamp and forwards cancellation', async () => {
    const points = Array.from({ length: 500 }, (_, index) => ({
      timestamp: Date.now() - (500 - index) * 300_000,
      valueUsd: index,
    }));
    mocks.getOpenInterestHistory.mockResolvedValue(points);
    useOpenInterestHistoryQuery('BTCUSDT', '5m', true);
    const controller = new AbortController();
    const page = await options.queryFn({ pageParam: { direction: 'initial' }, signal: controller.signal });

    expect(mocks.getOpenInterestHistory).toHaveBeenCalledWith('BTCUSDT', '5m', {
      limit: 500,
      endTime: undefined,
      signal: controller.signal,
    });
    expect(options.getNextPageParam(page)).toEqual({
      direction: 'older',
      endTime: points[0].timestamp - 1,
    });
  });

  it('stops pagination when the oldest point reaches the 30-day source boundary', async () => {
    const now = 1_800_000_000_000;
    const oldestAvailableTimestamp = now - 30 * 24 * 60 * 60_000;
    const points = Array.from({ length: 500 }, (_, index) => ({
      timestamp: oldestAvailableTimestamp + index * 300_000,
      valueUsd: index,
    }));
    vi.spyOn(Date, 'now').mockReturnValue(now);
    mocks.getOpenInterestHistory.mockResolvedValue(points);
    useOpenInterestHistoryQuery('BTCUSDT', '5m', true);

    const page = await options.queryFn({
      pageParam: { direction: 'older', endTime: points.at(-1)!.timestamp },
      signal: new AbortController().signal,
    });

    expect(page.reachesOlderEnd).toBe(true);
    expect(options.getNextPageParam(page)).toBeUndefined();
    vi.mocked(Date.now).mockRestore();
  });

  it('merges, deduplicates and sorts pages', () => {
    expect(
      mergeOpenInterestPages([
        {
          reachesOlderEnd: false,
          points: [
            { timestamp: 2, valueUsd: 20 },
            { timestamp: 3, valueUsd: 30 },
          ],
        },
        {
          reachesOlderEnd: true,
          points: [
            { timestamp: 1, valueUsd: 10 },
            { timestamp: 2, valueUsd: 22 },
          ],
        },
      ]),
    ).toEqual([
      { timestamp: 1, valueUsd: 10 },
      { timestamp: 2, valueUsd: 22 },
      { timestamp: 3, valueUsd: 30 },
    ]);
  });
});

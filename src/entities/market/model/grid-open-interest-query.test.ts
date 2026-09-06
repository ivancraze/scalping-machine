import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCandles: vi.fn(),
  getFundingSnapshot: vi.fn(),
  getOpenInterest: vi.fn(),
  getQueryState: vi.fn(),
  setQueryData: vi.fn(),
  runGridRequest: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../api/binance', () => ({
  getCandles: mocks.getCandles,
  getFundingSnapshot: mocks.getFundingSnapshot,
  getOpenInterest: mocks.getOpenInterest,
}));

vi.mock('../api/grid-request-pool', () => ({ runGridRequest: mocks.runGridRequest }));

import {
  useGridFundingQuery,
  useGridNatrsQuery,
  useGridOpenInterestSnapshotQuery,
} from './technical-data-query';

type GridQueryOptions = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
};

describe('grid technical data queries', () => {
  let options: GridQueryOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation((queryOptions: GridQueryOptions) => {
      options = queryOptions;
      return queryOptions;
    });
    mocks.useQueryClient.mockReturnValue({
      getQueryState: mocks.getQueryState,
      setQueryData: mocks.setQueryData,
    });
    mocks.runGridRequest.mockImplementation((_signal: AbortSignal, request: () => Promise<unknown>) =>
      request(),
    );
  });

  it('runs the snapshot through the shared grid pool and converts quantity using current price', async () => {
    mocks.getOpenInterest.mockResolvedValue({ timestamp: 123, quantity: 2.5 });
    useGridOpenInterestSnapshotQuery('BTCUSDT', 100_000, true);
    const signal = new AbortController().signal;

    await expect(options.queryFn({ signal })).resolves.toEqual({
      timestamp: 123,
      valueUsd: 250_000,
    });
    expect(mocks.runGridRequest).toHaveBeenCalledWith(signal, expect.any(Function));
    expect(mocks.getOpenInterest).toHaveBeenCalledWith('BTCUSDT', signal);
  });

  it('stays disabled without a positive price or when the card is inactive', () => {
    useGridOpenInterestSnapshotQuery('BTCUSDT', 0, true);
    expect(options.enabled).toBe(false);

    useGridOpenInterestSnapshotQuery('BTCUSDT', 100_000, false);
    expect(options.enabled).toBe(false);
  });

  it('loads funding through the shared pool with the same cancellation signal', async () => {
    const funding = { rate: 0.0001, nextFundingTime: 456, timestamp: 123 };
    mocks.getFundingSnapshot.mockResolvedValue(funding);
    useGridFundingQuery('BTCUSDT', true);
    const signal = new AbortController().signal;

    await expect(options.queryFn({ signal })).resolves.toEqual(funding);
    expect(mocks.runGridRequest).toHaveBeenCalledWith(signal, expect.any(Function));
    expect(mocks.getFundingSnapshot).toHaveBeenCalledWith('BTCUSDT', signal);
  });

  it('loads uncached NATR inputs through the shared pool and stores per-symbol results', async () => {
    const candles = Array.from(
      { length: 16 },
      (_, index) => [index * 300_000, '100', '102', '99', String(100 + index / 10), '10'] as const,
    );
    mocks.getCandles.mockResolvedValue(candles);
    useGridNatrsQuery(['ETHUSDT', 'BTCUSDT'], true);
    const result = (await options.queryFn({
      signal: new AbortController().signal,
    })) as Record<string, number>;

    expect(Object.keys(result)).toEqual(['BTCUSDT', 'ETHUSDT']);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
    expect(mocks.runGridRequest).toHaveBeenCalledTimes(2);
    expect(mocks.setQueryData).toHaveBeenCalledTimes(2);
  });
});

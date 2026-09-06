import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOpenInterest: vi.fn(),
  runGridRequest: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: vi.fn(),
}));

vi.mock('../api/binance', () => ({
  getCandles: vi.fn(),
  getOpenInterest: mocks.getOpenInterest,
}));

vi.mock('../api/grid-request-pool', () => ({ runGridRequest: mocks.runGridRequest }));

import { useGridOpenInterestSnapshotQuery } from './technical-data-query';

type SnapshotQueryOptions = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: (context: { signal: AbortSignal }) => Promise<{ timestamp: number; valueUsd: number }>;
};

describe('grid open interest snapshot query', () => {
  let options: SnapshotQueryOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation((queryOptions: SnapshotQueryOptions) => {
      options = queryOptions;
      return queryOptions;
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
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCandles: vi.fn(),
  getQueryState: vi.fn(),
  setQueryData: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../api/binance', () => ({
  getCandles: mocks.getCandles,
  getOpenInterest: vi.fn(),
}));

import { useNatrsQuery } from './technical-data-query';

type QueryOptions = {
  queryFn: (context: { signal: AbortSignal }) => Promise<Record<string, number>>;
};

describe('useNatrsQuery', () => {
  let options: QueryOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation((queryOptions: QueryOptions) => {
      options = queryOptions;
      return queryOptions;
    });
    mocks.useQueryClient.mockReturnValue({
      getQueryState: mocks.getQueryState,
      setQueryData: mocks.setQueryData,
    });
  });

  it('does not start queued NATR requests after cancellation', async () => {
    const pending = new Map<string, (candles: []) => void>();
    mocks.getCandles.mockImplementation(
      (symbol: string) => new Promise<[]>((resolve) => pending.set(symbol, resolve)),
    );
    useNatrsQuery(['FUSDT', 'EUSDT', 'DUSDT', 'CUSDT', 'BUSDT', 'AUSDT'], true);
    const controller = new AbortController();
    const batch = options.queryFn({ signal: controller.signal });

    await vi.waitFor(() => expect(mocks.getCandles).toHaveBeenCalledTimes(5));
    controller.abort();
    pending.forEach((resolve) => resolve([]));

    await expect(batch).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.getCandles.mock.calls.map(([symbol]) => symbol)).toEqual([
      'AUSDT',
      'BUSDT',
      'CUSDT',
      'DUSDT',
      'EUSDT',
    ]);
  });
});

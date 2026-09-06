// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from './candle';
import { marketQueryKeys } from './query-keys';
import { useClosedCandleWindowQuery, useClosedCandleWindowSubscription } from './candle-query';
import { getCandles } from '../api/binance';
import { subscribeKline } from '../api/binance-streams';

vi.mock('../api/binance', () => ({
  getCandles: vi.fn(),
  getAggregateTrades: vi.fn(),
}));
vi.mock('../api/binance-streams', () => ({
  subscribeKline: vi.fn(),
  subscribeAggregateTrades: vi.fn(),
}));

const closed: Candle = [0, '100', '101', '99', '100', '1'];
const current: Candle = [60_000, '100', '102', '99', '101', '2'];
const candleAt = (openTime: number, close: string): Candle => [openTime, close, close, close, close, '1'];

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

function Harness({
  symbol = 'BTCUSDT',
  interval = '1m',
  historySize = 300,
}: {
  symbol?: string;
  interval?: string;
  historySize?: number;
}) {
  const query = useClosedCandleWindowQuery(symbol, interval, historySize, true);
  useClosedCandleWindowSubscription(symbol, interval, historySize, query.isSuccess && !query.isFetching);
  return null;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(getCandles).mockResolvedValue([closed, current]);
  vi.mocked(subscribeKline).mockReturnValue(vi.fn());
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  queryClient.clear();
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('closed candle analysis window', () => {
  it('loads 1500 closed candles without requesting more than the Binance limit', async () => {
    const latest = Array.from({ length: 1500 }, (_, index) =>
      candleAt((index + 1) * 60_000, String(index + 1)),
    );
    const older = candleAt(0, '0');
    vi.mocked(getCandles).mockResolvedValueOnce(latest).mockResolvedValueOnce([older]);

    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness historySize={1500} />
        </QueryClientProvider>,
      ),
    );
    await act(async () =>
      vi.waitFor(() =>
        expect(queryClient.getQueryData(marketQueryKeys.closedCandleWindow('BTCUSDT', '1m', 1500))).toEqual({
          candles: [older, ...latest.slice(0, -1)],
          current: latest.at(-1),
        }),
      ),
    );

    expect(vi.mocked(getCandles)).toHaveBeenNthCalledWith(
      1,
      'BTCUSDT',
      '1m',
      expect.objectContaining({ limit: 1500 }),
    );
    expect(vi.mocked(getCandles)).toHaveBeenNthCalledWith(
      2,
      'BTCUSDT',
      '1m',
      expect.objectContaining({ limit: 1, endTime: 60_000 - 1 }),
    );
    expect(vi.mocked(getCandles).mock.calls.every(([, , options]) => (options?.limit ?? 0) <= 1500)).toBe(
      true,
    );
  });

  it('does not publish current-tick updates and appends the final candle only on the next bar', async () => {
    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(1)));
    const queryKey = marketQueryKeys.closedCandleWindow('BTCUSDT', '1m', 300);
    const beforeTick = queryClient.getQueryData(queryKey);
    const onCandle = vi.mocked(subscribeKline).mock.calls[0][2];
    const finalCurrent: Candle = [60_000, '100', '103', '98', '102', '3'];

    await act(() => onCandle(finalCurrent));
    expect(queryClient.getQueryData(queryKey)).toBe(beforeTick);

    const next: Candle = [120_000, '102', '102', '102', '102', '0'];
    await act(() => onCandle(next));
    expect(queryClient.getQueryData(queryKey)).toEqual({
      candles: [closed, finalCurrent],
      current: next,
    });
  });

  it('keeps a newer websocket revision when an older same-candle resync finishes later', async () => {
    let resolveResync: (candles: Candle[]) => void = () => undefined;
    const staleResync = new Promise<Candle[]>((resolve) => {
      resolveResync = resolve;
    });
    vi.mocked(getCandles).mockResolvedValueOnce([closed, current]).mockReturnValueOnce(staleResync);
    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(1)));
    const [, , onCandle, resync] = vi.mocked(subscribeKline).mock.calls[0];
    const finalCurrent: Candle = [60_000, '100', '104', '98', '103', '4'];

    expect(resync).toBeTypeOf('function');
    act(() => resync?.());
    act(() => onCandle(finalCurrent));
    await act(async () => {
      resolveResync([closed, current]);
      await staleResync;
      await Promise.resolve();
    });
    const next: Candle = [120_000, '103', '103', '103', '103', '0'];
    act(() => onCandle(next));

    expect(queryClient.getQueryData(marketQueryKeys.closedCandleWindow('BTCUSDT', '1m', 300))).toEqual({
      candles: [closed, finalCurrent],
      current: next,
    });
  });

  it('keeps every websocket-closed bar when a resync response is multiple bars behind', async () => {
    let resolveResync: (candles: Candle[]) => void = () => undefined;
    const staleResync = new Promise<Candle[]>((resolve) => {
      resolveResync = resolve;
    });
    vi.mocked(getCandles).mockResolvedValueOnce([closed, current]).mockReturnValueOnce(staleResync);
    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(1)));
    const [, , onCandle, resync] = vi.mocked(subscribeKline).mock.calls[0];
    const finalCurrent: Candle = [60_000, '100', '105', '98', '104', '5'];
    const next: Candle = [120_000, '101', '103', '100', '102', '3'];
    const nextAfterThat: Candle = [180_000, '102', '104', '101', '103', '4'];

    expect(resync).toBeTypeOf('function');
    act(() => resync?.());
    act(() => onCandle(finalCurrent));
    act(() => onCandle(next));
    act(() => onCandle(nextAfterThat));
    await act(async () => {
      resolveResync([closed, current]);
      await staleResync;
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(marketQueryKeys.closedCandleWindow('BTCUSDT', '1m', 300))).toEqual({
      candles: [closed, finalCurrent, next],
      current: nextAfterThat,
    });
  });

  it('uses the REST-final predecessor when the first resync tick skips its final update', async () => {
    let resolveResync: (candles: Candle[]) => void = () => undefined;
    const pendingResync = new Promise<Candle[]>((resolve) => {
      resolveResync = resolve;
    });
    vi.mocked(getCandles).mockResolvedValueOnce([closed, current]).mockReturnValueOnce(pendingResync);
    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(1)));
    const [, , onCandle, resync] = vi.mocked(subscribeKline).mock.calls[0];
    const finalCurrent: Candle = [60_000, '100', '106', '97', '105', '6'];
    const restNext: Candle = [120_000, '105', '106', '104', '105', '1'];
    const streamNext: Candle = [120_000, '105', '107', '104', '106', '2'];

    expect(resync).toBeTypeOf('function');
    act(() => resync?.());
    act(() => onCandle(streamNext));
    await act(async () => {
      resolveResync([closed, finalCurrent, restNext]);
      await pendingResync;
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(marketQueryKeys.closedCandleWindow('BTCUSDT', '1m', 300))).toEqual({
      candles: [closed, finalCurrent],
      current: streamNext,
    });
  });

  it('does not carry the current candle across symbol and timeframe subscriptions', async () => {
    const ethClosed: Candle = [0, '200', '201', '199', '200', '1'];
    const ethCurrent: Candle = [300_000, '200', '202', '199', '201', '2'];
    vi.mocked(getCandles).mockImplementation((_symbol, interval) =>
      Promise.resolve(interval === '5m' ? [ethClosed, ethCurrent] : [closed, current]),
    );
    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(1)));
    const btcTick: Candle = [60_000, '100', '105', '98', '104', '5'];
    act(() => vi.mocked(subscribeKline).mock.calls[0][2](btcTick));

    await act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness symbol="ETHUSDT" interval="5m" />
        </QueryClientProvider>,
      ),
    );
    await act(async () => vi.waitFor(() => expect(vi.mocked(subscribeKline)).toHaveBeenCalledTimes(2)));
    const ethNext: Candle = [600_000, '201', '201', '201', '201', '0'];
    act(() => vi.mocked(subscribeKline).mock.calls[1][2](ethNext));

    expect(queryClient.getQueryData(marketQueryKeys.closedCandleWindow('ETHUSDT', '5m', 300))).toEqual({
      candles: [ethClosed, ethCurrent],
      current: ethNext,
    });
  });
});

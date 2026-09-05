// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarketQuery, mergeMarketTickerUpdates } from './market-query';
import { marketQueryKeys } from './query-keys';

const mocks = vi.hoisted(() => ({
  subscribeMarketTickers: vi.fn(),
  getInstruments: vi.fn(),
  getMarket: vi.fn(),
}));

vi.mock('../api/binance', () => ({
  getInstruments: mocks.getInstruments,
  getMarket: mocks.getMarket,
}));
vi.mock('../api/binance-streams', () => ({ subscribeMarketTickers: mocks.subscribeMarketTickers }));

let root: Root;
let container: HTMLDivElement;
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;
let frameCallback: FrameRequestCallback | undefined;

function MarketQueryConsumer() {
  useMarketQuery();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInstruments.mockResolvedValue({ BTCUSDT: '0.1' });
  mocks.getMarket.mockResolvedValue([]);
  mocks.subscribeMarketTickers.mockReturnValue(vi.fn());
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  frameCallback = undefined;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    }),
  );
  cancelAnimationFrameMock = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe('mergeMarketTickerUpdates', () => {
  it('updates only received symbols in one batched cache write', () => {
    const market = [
      {
        symbol: 'BTCUSDT',
        priceTickSize: '0.1',
        price: 1,
        change: 0,
        range: 0,
        natr: 0,
        trades: 1,
        volume: 1,
      },
      {
        symbol: 'ETHUSDT',
        priceTickSize: '0.01',
        price: 2,
        change: 0,
        range: 0,
        natr: 0,
        trades: 2,
        volume: 2,
      },
    ];
    const updates = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 3, change: 1, range: 2, natr: 3, trades: 4, volume: 5 }],
    ]);

    expect(mergeMarketTickerUpdates(market, updates)).toEqual([
      {
        symbol: 'BTCUSDT',
        priceTickSize: '0.1',
        price: 3,
        change: 1,
        range: 2,
        natr: 3,
        trades: 4,
        volume: 5,
      },
      market[1],
    ]);
  });

  it('unsubscribes and cancels a queued live update when the consumer unmounts', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root.render(
        createElement(QueryClientProvider, { client: queryClient }, createElement(MarketQueryConsumer)),
      );
    });
    const onUpdates = mocks.subscribeMarketTickers.mock.calls[0][0];
    const unsubscribe = mocks.subscribeMarketTickers.mock.results[0].value;

    act(() => {
      onUpdates([{ symbol: 'BTCUSDT', price: 1, change: 0, range: 0, natr: 0, trades: 1, volume: 1 }]);
      root.unmount();
    });

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1);
  });

  it('batches multiple ticker packets into one cache update per animation frame', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = marketQueryKeys.ticker();
    queryClient.setQueryData(queryKey, [
      {
        symbol: 'BTCUSDT',
        priceTickSize: '0.1',
        price: 1,
        change: 0,
        range: 0,
        natr: 0,
        trades: 1,
        volume: 1,
      },
    ]);
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    act(() => {
      root.render(
        createElement(QueryClientProvider, { client: queryClient }, createElement(MarketQueryConsumer)),
      );
    });
    const onUpdates = mocks.subscribeMarketTickers.mock.calls[0][0];

    act(() => {
      onUpdates([{ symbol: 'BTCUSDT', price: 2, change: 1, range: 2, natr: 2, trades: 2, volume: 2 }]);
      onUpdates([{ symbol: 'BTCUSDT', price: 3, change: 2, range: 3, natr: 3, trades: 3, volume: 3 }]);
      frameCallback?.(0);
    });

    expect(setQueryData).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKey)).toEqual([
      {
        symbol: 'BTCUSDT',
        priceTickSize: '0.1',
        price: 3,
        change: 2,
        range: 3,
        natr: 3,
        trades: 3,
        volume: 3,
      },
    ]);
  });
});

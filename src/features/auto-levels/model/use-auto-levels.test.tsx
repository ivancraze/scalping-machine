// @vitest-environment jsdom
import { act, createRef, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutoLevelWorkerRequest,
  AutoLevelWorkerResponse,
  DetectedAutoLevel,
} from '../../../entities/auto-level';
import type { Candle } from '../../../entities/market';
import { useAutoLevels } from './use-auto-levels';

const marketMocks = vi.hoisted(() => ({
  state: {
    data: undefined as { candles: Candle[]; current: Candle | null } | undefined,
    isError: false,
    isSuccess: false,
    isFetching: false,
  },
  query: vi.fn(),
  subscription: vi.fn(),
}));

vi.mock('../../../entities/market', () => ({
  useClosedCandleWindowQuery: (...args: unknown[]) => {
    marketMocks.query(...args);
    return marketMocks.state;
  },
  useClosedCandleWindowSubscription: (...args: unknown[]) => marketMocks.subscription(...args),
}));

class WorkerMock {
  static instances: WorkerMock[] = [];
  onmessage: ((event: MessageEvent<AutoLevelWorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  requests: AutoLevelWorkerRequest[] = [];
  terminate = vi.fn();

  constructor() {
    WorkerMock.instances.push(this);
  }

  postMessage(request: AutoLevelWorkerRequest) {
    this.requests.push(request);
  }

  emit(response: AutoLevelWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<AutoLevelWorkerResponse>);
  }
}

const storage = new Map<string, string>();
const now = Date.now();
const candleAt = (openTime: number, close: string): Candle => [openTime, close, close, close, close, '1'];
const candles: Candle[] = [
  [now - 45 * 60_000, '100', '101', '99', '100', '1'],
  [now - 30 * 60_000, '100', '101', '99', '100', '1'],
  [now - 5 * 60_000, '100', '101', '99', '100', '1'],
];
const level: DetectedAutoLevel = {
  id: 'pulse:auto-level:support:1:2',
  detector: 'breakout',
  kind: 'support',
  points: [{ timestamp: 1, price: 100 }],
  projectedPrice: 100,
  touches: 3,
  score: 70,
  weak: false,
  analysisInterval: '15m',
  frozen: false,
};
const extremumLevel: DetectedAutoLevel = {
  ...level,
  id: 'pulse:auto-level:ex:resistance:3',
  detector: 'extremum',
  kind: 'resistance',
  points: [{ timestamp: 3, price: 110 }],
  projectedPrice: 110,
  touches: 1,
};

let root: Root;
let container: HTMLDivElement;
type AutoLevelsResult = ReturnType<typeof useAutoLevels>;
const resultRef = createRef<AutoLevelsResult>();

const Harness = forwardRef<AutoLevelsResult>(function Harness(_, ref) {
  const result = useAutoLevels({
    symbol: 'BTCUSDT',
    displayedInterval: '15m',
    displayedCandles: candles,
    displayedLatestCandles: [],
  });
  useImperativeHandle(ref, () => result, [result]);
  return null;
});

const ScopedHarness = forwardRef<AutoLevelsResult, { symbol: string }>(function ScopedHarness(
  { symbol },
  ref,
) {
  const result = useAutoLevels({
    symbol,
    displayedInterval: '15m',
    displayedCandles: candles,
    displayedLatestCandles: [],
  });
  useImperativeHandle(ref, () => result, [result]);
  return null;
});

const IndependentHarness = forwardRef<AutoLevelsResult>(function IndependentHarness(_, ref) {
  const result = useAutoLevels({
    symbol: 'BTCUSDT',
    displayedInterval: '1m',
    displayedCandles: [],
    displayedLatestCandles: [],
    displayedIncludesCurrentEnd: false,
  });
  useImperativeHandle(ref, () => result, [result]);
  return null;
});

const IntervalHarness = forwardRef<AutoLevelsResult, { interval: string }>(function IntervalHarness(
  { interval },
  ref,
) {
  const result = useAutoLevels({
    symbol: 'BTCUSDT',
    displayedInterval: interval,
    displayedCandles: candles,
    displayedLatestCandles: [],
  });
  useImperativeHandle(ref, () => result, [result]);
  return null;
});

const DisplayedDepthHarness = forwardRef<AutoLevelsResult, { displayed: Candle[]; canLoadOlder: boolean }>(
  function DisplayedDepthHarness({ displayed, canLoadOlder }, ref) {
    const result = useAutoLevels({
      symbol: 'BTCUSDT',
      displayedInterval: '15m',
      displayedCandles: displayed,
      displayedLatestCandles: [],
      displayedIncludesCurrentEnd: true,
      displayedCanLoadOlder: canLoadOlder,
    });
    useImperativeHandle(ref, () => result, [result]);
    return null;
  },
);

const currentResult = () => {
  if (!resultRef.current) throw new Error('Hook result is unavailable');
  return resultRef.current;
};

beforeEach(() => {
  WorkerMock.instances = [];
  storage.clear();
  marketMocks.state = {
    data: undefined,
    isError: false,
    isSuccess: false,
    isFetching: false,
  };
  marketMocks.query.mockClear();
  marketMocks.subscription.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Worker', WorkerMock);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('useAutoLevels', () => {
  it('runs one worker on closed candles and ignores a stale response', async () => {
    await act(() => root.render(<Harness ref={resultRef} />));
    await act(() => currentResult().updateSettings({ enabled: true }));
    const worker = WorkerMock.instances[0];
    const firstRequest = worker.requests[0];

    expect(firstRequest.candles).toHaveLength(2);
    expect(firstRequest.scope).toBe('BTCUSDT:15m');
    expect(firstRequest.settings).toMatchObject({
      nearPriceOnly: true,
      maxDistancePercent: 1,
      enabledTypes: { trend: false },
    });

    await act(() =>
      currentResult().updateSettings({
        minTouches: 4,
        nearPriceOnly: false,
        maxDistancePercent: 2,
      }),
    );
    const secondRequest = worker.requests[1];
    expect(secondRequest.settings).toMatchObject({
      minTouches: 4,
      nearPriceOnly: false,
      maxDistancePercent: 2,
    });
    await act(() =>
      worker.emit({ requestId: firstRequest.requestId, scope: firstRequest.scope, levels: [level] }),
    );
    expect(currentResult().levels).toEqual([]);

    await act(() =>
      worker.emit({ requestId: secondRequest.requestId, scope: secondRequest.scope, levels: [level] }),
    );
    expect(currentResult().levels).toEqual([level]);
    expect(currentResult().isCalculating).toBe(false);
  });

  it('freezes edits, deletes a level and clears state when disabled', async () => {
    await act(() => root.render(<Harness ref={resultRef} />));
    await act(() => currentResult().updateSettings({ enabled: true }));
    const worker = WorkerMock.instances[0];
    const request = worker.requests[0];
    await act(() => worker.emit({ requestId: request.requestId, scope: request.scope, levels: [level] }));

    await act(() => currentResult().editLevel(level.id, [{ timestamp: 1, price: 101 }]));
    expect(currentResult().levels[0]).toMatchObject({ frozen: true, projectedPrice: 101 });

    await act(() => currentResult().deleteLevel(level.id));
    expect(currentResult().levels).toEqual([]);

    await act(() => currentResult().updateSettings({ enabled: false }));
    expect(currentResult().levels).toEqual([]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('immediately hides a frozen detector level and restores it when the detector is re-enabled', async () => {
    await act(() => root.render(<Harness ref={resultRef} />));
    await act(() =>
      currentResult().updateSettings({
        enabled: true,
        enabledDetectors: { breakout: true, extremum: true },
      }),
    );
    const worker = WorkerMock.instances[0];
    const request = worker.requests[0];
    await act(() =>
      worker.emit({
        requestId: request.requestId,
        scope: request.scope,
        levels: [level, extremumLevel],
      }),
    );
    await act(() => currentResult().toggleFrozen(extremumLevel.id));
    expect(currentResult().levels.find(({ id }) => id === extremumLevel.id)?.frozen).toBe(true);

    await act(() =>
      currentResult().updateSettings({ enabledDetectors: { breakout: true, extremum: false } }),
    );
    expect(currentResult().levels).toEqual([level]);

    await act(() => currentResult().updateSettings({ enabledDetectors: { breakout: true, extremum: true } }));
    expect(currentResult().levels.find(({ id }) => id === extremumLevel.id)?.frozen).toBe(true);

    await act(() =>
      currentResult().updateSettings({
        enabledTypes: { support: true, resistance: false, trend: false },
      }),
    );
    expect(currentResult().levels).toEqual([level]);

    await act(() =>
      currentResult().updateSettings({
        enabledTypes: { support: true, resistance: true, trend: false },
      }),
    );
    expect(currentResult().levels.find(({ id }) => id === extremumLevel.id)?.frozen).toBe(true);
  });

  it('keeps scopes isolated and ignores the previous symbol response', async () => {
    await act(() => root.render(<ScopedHarness ref={resultRef} symbol="BTCUSDT" />));
    await act(() => currentResult().updateSettings({ enabled: true }));
    const worker = WorkerMock.instances[0];
    const btcRequest = worker.requests[0];

    await act(() => root.render(<ScopedHarness ref={resultRef} symbol="ETHUSDT" />));
    const ethRequest = worker.requests[1];
    expect(ethRequest.scope).toBe('ETHUSDT:15m');

    await act(() =>
      worker.emit({ requestId: btcRequest.requestId, scope: btcRequest.scope, levels: [level] }),
    );
    expect(currentResult().levels).toEqual([]);

    const ethLevel = { ...level, id: 'pulse:auto-level:support:3:4' };
    await act(() =>
      worker.emit({ requestId: ethRequest.requestId, scope: ethRequest.scope, levels: [ethLevel] }),
    );
    expect(currentResult().levels).toEqual([ethLevel]);
  });

  it('switches the analysis scope and worker request with the displayed timeframe', async () => {
    await act(() => root.render(<IntervalHarness ref={resultRef} interval="15m" />));
    await act(() => currentResult().updateSettings({ enabled: true }));
    const worker = WorkerMock.instances[0];

    expect(worker.requests[0]).toMatchObject({
      scope: 'BTCUSDT:15m',
      settings: { interval: '15m' },
    });
    expect(currentResult().analysisUsesDisplayedInterval).toBe(true);

    await act(() => root.render(<IntervalHarness ref={resultRef} interval="1h" />));

    expect(worker.requests).toHaveLength(2);
    expect(worker.requests[1]).toMatchObject({
      scope: 'BTCUSDT:1h',
      settings: { interval: '1h' },
    });
  });

  it('uses an independent 1m source and scope for a seconds chart', async () => {
    marketMocks.state = {
      data: { candles, current: candleAt(now, '101') },
      isError: false,
      isSuccess: true,
      isFetching: false,
    };
    await act(() => root.render(<IntervalHarness ref={resultRef} interval="5s" />));
    await act(() => currentResult().updateSettings({ enabled: true }));
    const worker = WorkerMock.instances[0];

    expect(marketMocks.query).toHaveBeenLastCalledWith('BTCUSDT', '1m', 600, true);
    expect(marketMocks.subscription).toHaveBeenLastCalledWith('BTCUSDT', '1m', 600, true);
    expect(worker.requests[0]).toMatchObject({
      scope: 'BTCUSDT:1m',
      settings: { interval: '1m' },
    });
    expect(currentResult().analysisUsesDisplayedInterval).toBe(false);
  });

  it('waits for a fresh independent closed window before first run and re-enable', async () => {
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    const staleClosed: Candle = [60_000, '100', '101', '99', '100', '1'];
    marketMocks.state = {
      data: { candles: [staleClosed], current: [120_000, '100', '101', '99', '100', '1'] },
      isError: false,
      isSuccess: true,
      isFetching: true,
    };
    await act(() => currentResult().updateSettings({ enabled: true }));
    expect(WorkerMock.instances[0].requests).toEqual([]);
    expect(marketMocks.subscription).toHaveBeenLastCalledWith('BTCUSDT', '1m', 600, false);

    const freshClosed: Candle = [120_000, '101', '102', '100', '101', '2'];
    marketMocks.state = {
      data: { candles: [staleClosed, freshClosed], current: [180_000, '101', '102', '100', '101', '1'] },
      isError: false,
      isSuccess: true,
      isFetching: false,
    };
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    expect(WorkerMock.instances[0].requests[0].candles).toEqual([staleClosed, freshClosed]);
    expect(marketMocks.subscription).toHaveBeenLastCalledWith('BTCUSDT', '1m', 600, true);

    await act(() => currentResult().updateSettings({ enabled: false }));
    marketMocks.state = { ...marketMocks.state, isFetching: true };
    await act(() => currentResult().updateSettings({ enabled: true }));
    expect(WorkerMock.instances[1].requests).toEqual([]);

    const nextClosed: Candle = [180_000, '102', '103', '101', '102', '3'];
    marketMocks.state = {
      data: {
        candles: [staleClosed, freshClosed, nextClosed],
        current: [240_000, '102', '103', '101', '102', '1'],
      },
      isError: false,
      isSuccess: true,
      isFetching: false,
    };
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    expect(WorkerMock.instances[1].requests[0].candles).toEqual([staleClosed, freshClosed, nextClosed]);
  });

  it('loads the larger enabled detector history and keeps EX depth independent', async () => {
    await act(() => root.render(<IndependentHarness ref={resultRef} />));

    await act(() =>
      currentResult().updateSettings({
        enabled: true,
        enabledDetectors: { breakout: true, extremum: true },
      }),
    );
    expect(marketMocks.query).toHaveBeenLastCalledWith('BTCUSDT', '1m', 1500, true);

    await act(() => currentResult().updateSettings({ historySize: 1000, extremumHistorySize: 500 }));
    expect(marketMocks.query).toHaveBeenLastCalledWith('BTCUSDT', '1m', 1000, true);

    await act(() =>
      currentResult().updateSettings({
        enabledDetectors: { breakout: false, extremum: true },
      }),
    );
    expect(marketMocks.query).toHaveBeenLastCalledWith('BTCUSDT', '1m', 500, true);
  });

  it('waits for a complete deeper displayed window and preserves previous levels if backfill fails', async () => {
    const initial = Array.from({ length: 600 }, (_, index) =>
      candleAt(index * 60_000, String(100 + index / 1000)),
    );
    await act(() => root.render(<DisplayedDepthHarness ref={resultRef} displayed={initial} canLoadOlder />));
    await act(() =>
      currentResult().updateSettings({
        enabled: true,
        enabledDetectors: { breakout: false, extremum: true },
        extremumHistorySize: 500,
      }),
    );
    const worker = WorkerMock.instances[0];
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0].candles).toHaveLength(500);
    await act(() =>
      worker.emit({
        requestId: worker.requests[0].requestId,
        scope: worker.requests[0].scope,
        levels: [extremumLevel],
      }),
    );

    await act(() => currentResult().updateSettings({ extremumHistorySize: 1500 }));
    expect(worker.requests).toHaveLength(1);
    expect(currentResult().levels).toEqual([extremumLevel]);

    await act(() => root.render(<DisplayedDepthHarness ref={resultRef} displayed={initial} canLoadOlder />));
    expect(worker.requests).toHaveLength(1);
    expect(currentResult().levels).toEqual([extremumLevel]);

    const complete = Array.from({ length: 1501 }, (_, index) =>
      candleAt(index * 60_000, String(100 + index / 1000)),
    );
    await act(() => root.render(<DisplayedDepthHarness ref={resultRef} displayed={complete} canLoadOlder />));
    expect(worker.requests).toHaveLength(2);
    expect(worker.requests[1].candles).toHaveLength(1500);
  });

  it('does not reuse a smaller independent window while deeper data is pending or failed', async () => {
    const initial = Array.from({ length: 500 }, (_, index) =>
      candleAt(index * 60_000, String(100 + index / 1000)),
    );
    marketMocks.state = {
      data: { candles: initial, current: candleAt(500 * 60_000, '101') },
      isError: false,
      isSuccess: true,
      isFetching: false,
    };
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    await act(() =>
      currentResult().updateSettings({
        enabled: true,
        enabledDetectors: { breakout: false, extremum: true },
        extremumHistorySize: 500,
      }),
    );
    const worker = WorkerMock.instances[0];
    expect(worker.requests).toHaveLength(1);
    await act(() =>
      worker.emit({
        requestId: worker.requests[0].requestId,
        scope: worker.requests[0].scope,
        levels: [extremumLevel],
      }),
    );

    marketMocks.state = { ...marketMocks.state, isFetching: true };
    await act(() => currentResult().updateSettings({ extremumHistorySize: 1500 }));
    expect(worker.requests).toHaveLength(1);
    expect(currentResult().levels).toEqual([extremumLevel]);

    marketMocks.state = {
      data: undefined,
      isError: true,
      isSuccess: false,
      isFetching: false,
    };
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    expect(worker.requests).toHaveLength(1);
    expect(currentResult().levels).toEqual([extremumLevel]);
    expect(currentResult().error).toBe('Не удалось загрузить свечи для автоуровней');

    const complete = Array.from({ length: 1500 }, (_, index) =>
      candleAt(index * 60_000, String(100 + index / 1000)),
    );
    marketMocks.state = {
      data: { candles: complete, current: candleAt(1500 * 60_000, '102') },
      isError: false,
      isSuccess: true,
      isFetching: false,
    };
    await act(() => root.render(<IndependentHarness ref={resultRef} />));
    expect(worker.requests).toHaveLength(2);
    expect(worker.requests[1].candles).toHaveLength(1500);
  });
});

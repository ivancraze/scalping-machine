// @vitest-environment jsdom
import { act, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chart } from './Chart';

const mocks = vi.hoisted(() => ({
  candles: Array.from({ length: 1000 }, (_, index) => [index * 60_000, '100', '101', '99', '100', '1']),
  history: {
    data: { pages: [{ candles: [], reachesNewerEnd: true }] },
    hasNextPage: true,
    hasPreviousPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    isPending: false,
    isError: false,
    isFetchNextPageError: false,
    isFetchPreviousPageError: false,
    fetchNextPage: vi.fn(),
    fetchPreviousPage: vi.fn(),
    refetch: vi.fn(),
  },
  openInterestHistory: {
    data: { pages: [{ points: [], reachesOlderEnd: true }] },
    hasNextPage: false,
    isFetching: false,
    isFetchNextPageError: false,
    isError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
}));

vi.mock('antd', () => ({
  Alert: ({ title, action }: { title: ReactNode; action?: ReactNode }) => (
    <div>
      {title}
      {action}
    </div>
  ),
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Dropdown: ({ children }: { children: ReactNode }) => children,
  Segmented: () => null,
  Spin: () => null,
  Tooltip: ({ children }: { children: ReactNode }) => children,
  Typography: { Text: ({ children }: { children: ReactNode }) => <span>{children}</span> },
  theme: {
    useToken: () => ({
      token: {
        colorBgContainer: '#000000',
        colorTextSecondary: '#ffffff',
        colorBorderSecondary: '#333333',
        colorBorder: '#444444',
        colorTextTertiary: '#777777',
      },
    }),
  },
}));
vi.mock('@ant-design/icons', () => ({
  AimOutlined: () => null,
  EllipsisOutlined: () => null,
  LeftOutlined: () => null,
  RightOutlined: () => null,
}));
vi.mock('../../../features/reset-chart-objects', () => ({ ResetChartObjects: () => null }));
vi.mock('../../../features/auto-levels', () => ({
  AutoLevelsPanel: () => null,
  useAutoLevels: () => ({
    settings: { enabled: true, interval: '15m' },
    analysisHistorySize: 1500,
    levels: [],
    isCalculating: false,
    error: null,
    updateSettings: vi.fn(),
    toggleFrozen: vi.fn(),
    editLevel: vi.fn(),
    deleteLevel: vi.fn(),
  }),
}));
vi.mock('../../../features/chart-indicators', () => ({
  ChartIndicators: () => null,
  useChartIndicators: () => ({
    settings: {
      volume: { visible: true, upColor: '#09825f', downColor: '#a7294a', height: 112 },
      openInterest: { visible: true, color: '#0f8bfd', height: 72 },
    },
    updateSettings: vi.fn(),
    updateHeights: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));
vi.mock('../../../entities/market', () => ({
  mergeCandlePages: () => mocks.candles,
  mergeOpenInterestPages: () => [],
  openInterestPeriodMilliseconds: () => 15 * 60_000,
  openInterestPeriodForInterval: () => '15m',
  useCandleHistoryQuery: () => mocks.history,
  useLatestCandlesQuery: () => ({ data: [] }),
  useLiveCandleSubscription: vi.fn(),
  useSecondCandlesQuery: () => ({ data: [] }),
  useCorrelationToBtcQuery: () => ({ data: null }),
  useNatrQuery: () => ({ data: null }),
  useOpenInterestQuery: () => ({ data: undefined }),
  useOpenInterestHistoryQuery: () => mocks.openInterestHistory,
}));
vi.mock('../lib/drawing-tools', () => ({ primaryDrawingTools: [], extraDrawingTools: [] }));
vi.mock('../lib/timeframe-storage', () => ({
  loadChartTimeframe: () => '15м',
  saveChartTimeframe: vi.fn(),
}));
vi.mock('./ChartCanvas', () => ({ ChartCanvas: () => null }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.history.isFetchNextPageError = false;
  mocks.history.isFetching = false;
  mocks.history.hasNextPage = true;
  mocks.history.fetchNextPage.mockReset().mockResolvedValue({ isError: true });
  mocks.openInterestHistory.isFetchNextPageError = false;
  mocks.openInterestHistory.isError = false;
  mocks.openInterestHistory.fetchNextPage.mockReset();
  mocks.openInterestHistory.refetch.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Chart auto-level history loading', () => {
  it('does not retry insufficient same-timeframe EX history after a page-load error rerender', async () => {
    await act(() => root.render(<Chart symbol="BTCUSDT" />));
    expect(mocks.history.fetchNextPage).toHaveBeenCalledTimes(1);

    mocks.history.isFetchNextPageError = true;
    await act(() => root.render(<Chart symbol="BTCUSDT" />));
    await act(() => root.render(<Chart symbol="BTCUSDT" />));

    expect(mocks.history.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('retries only the failed OI page', async () => {
    mocks.openInterestHistory.isFetchNextPageError = true;
    mocks.openInterestHistory.isError = true;
    await act(() => root.render(<Chart symbol="BTCUSDT" />));

    const retry = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Повторить',
    );
    expect(retry).toBeDefined();
    await act(() => retry?.click());

    expect(mocks.openInterestHistory.fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
    expect(mocks.openInterestHistory.refetch).not.toHaveBeenCalled();
  });
});

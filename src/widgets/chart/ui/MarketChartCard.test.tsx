import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MarketRow } from '../../../entities/market';
import { MarketChartCard } from './MarketChartCard';

vi.mock('antd', () => ({
  Alert: () => <span />,
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  Select: ({
    options,
    popupMatchSelectWidth,
    virtual,
  }: {
    options: Array<{ value: string; label: string }>;
    popupMatchSelectWidth?: number;
    virtual?: boolean;
  }) => (
    <div data-popup-width={popupMatchSelectWidth} data-virtual={String(virtual)}>
      {options.map(({ value, label }) => (
        <span key={value}>{label}</span>
      ))}
    </div>
  ),
  Spin: () => <span />,
  Tag: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  theme: {
    useToken: () => ({
      token: {
        colorBgContainer: '#111',
        colorTextSecondary: '#eee',
        colorBorderSecondary: '#222',
        colorBorder: '#333',
        colorTextTertiary: '#aaa',
      },
    }),
  },
}));

vi.mock('@ant-design/icons', () => ({
  ExpandOutlined: () => null,
  FlagFilled: () => null,
  FlagOutlined: () => null,
  FullscreenOutlined: () => null,
  LineChartOutlined: () => null,
}));

vi.mock('../../../entities/market', () => ({
  openInterestPeriodForInterval: () => '5m',
  openInterestPeriodMilliseconds: () => 300_000,
  useGridCandlesQuery: () => ({ data: undefined, isError: false, isPending: true }),
  useGridCandleSubscription: () => undefined,
  useGridOpenInterestQuery: () => ({ data: [] }),
  useGridOpenInterestSnapshotQuery: () => ({ data: undefined }),
}));

vi.mock('./GridChartCanvas', () => ({ GridChartCanvas: () => null }));

const market: MarketRow = {
  symbol: 'BTCUSDT',
  priceTickSize: '0.1',
  price: 100_000,
  change: 1,
  range: 2,
  natr: 1,
  trades: 100,
  volume: 1_000_000,
};

describe('market chart card timeframe control', () => {
  it('renders all six timeframe labels in a non-virtualized readable popup', () => {
    const markup = renderToStaticMarkup(
      <MarketChartCard
        market={market}
        timeframe="5м"
        favorite={false}
        volumeVisible
        openInterestVisible
        forceActive
        onTimeframeChange={vi.fn()}
        onFavoriteChange={vi.fn()}
        onOpenMain={vi.fn()}
      />,
    );

    expect(markup).toContain('data-popup-width="72"');
    expect(markup).toContain('data-virtual="false"');
    for (const label of ['1м', '5м', '15м', '1ч', '4ч', '1д']) expect(markup).toContain(`>${label}<`);
  });
});

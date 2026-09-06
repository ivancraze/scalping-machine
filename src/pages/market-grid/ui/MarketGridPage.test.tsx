// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketRow } from '../../../entities/market';
import MarketGridPage from './MarketGridPage';

vi.mock('../../../features/market-list-controls', () => ({
  useMarketListControls: () => ({ favoriteSymbols: new Set<string>(), toggleFavorite: vi.fn() }),
}));

vi.mock('../../../widgets/chart/grid', () => ({
  MarketChartCard: ({ market, timeframe }: { market: MarketRow; timeframe: string }) => (
    <article data-testid="market-card" data-symbol={market.symbol} data-timeframe={timeframe} />
  ),
}));

const market: MarketRow[] = Array.from({ length: 40 }, (_, index) => ({
  symbol: `COIN${String(index).padStart(2, '0')}USDT`,
  priceTickSize: '0.01',
  price: index + 1,
  change: index,
  range: 1,
  natr: 1,
  trades: index,
  volume: 40 - index,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  localStorage.setItem(
    'pulse-terminal:market-grid-settings',
    JSON.stringify({
      version: 1,
      settings: {
        columns: 4,
        mode: 'scroll',
        timeframe: '5м',
        view: 'all',
        volumeVisible: true,
        openInterestVisible: true,
        filters: { minVolume: null, minTrades: null, minChange: null, maxChange: null },
        symbolTimeframes: { COIN00USDT: '1м' },
      },
    }),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('market grid virtualization', () => {
  it('mounts only visible rows with overscan and swaps them on scroll', async () => {
    await act(() => root.render(<MarketGridPage market={market} onOpenMainChart={vi.fn()} />));

    const initialCards = [...container.querySelectorAll<HTMLElement>('[data-testid="market-card"]')];
    expect(initialCards).toHaveLength(16);
    expect(initialCards[0].dataset.symbol).toBe('COIN00USDT');

    const viewport = container.querySelector<HTMLElement>('section[class*="viewport"]');
    expect(viewport).not.toBeNull();
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 1_104 });
    await act(() => viewport?.dispatchEvent(new Event('scroll', { bubbles: true })));

    const scrolledCards = [...container.querySelectorAll<HTMLElement>('[data-testid="market-card"]')];
    expect(scrolledCards).toHaveLength(16);
    expect(scrolledCards[0].dataset.symbol).toBe('COIN08USDT');
    expect(scrolledCards.some(({ dataset }) => dataset.symbol === 'COIN00USDT')).toBe(false);
  });

  it('applies the common timeframe to every card and clears local overrides', async () => {
    await act(() => root.render(<MarketGridPage market={market} onOpenMainChart={vi.fn()} />));
    const initialCards = [...container.querySelectorAll<HTMLElement>('[data-testid="market-card"]')];
    expect(initialCards[0].dataset.timeframe).toBe('1м');
    expect(initialCards[1].dataset.timeframe).toBe('5м');

    const timeframeControl = container.querySelector<HTMLElement>('[aria-label="Общий таймфрейм сетки"]');
    const oneHour = [...(timeframeControl?.querySelectorAll<HTMLElement>('label') ?? [])].find(
      ({ textContent }) => textContent === '1ч',
    );
    expect(oneHour).not.toBeUndefined();

    await act(() => oneHour?.click());

    const updatedCards = [...container.querySelectorAll<HTMLElement>('[data-testid="market-card"]')];
    expect(updatedCards.every(({ dataset }) => dataset.timeframe === '1ч')).toBe(true);
    const stored = JSON.parse(localStorage.getItem('pulse-terminal:market-grid-settings') ?? '{}');
    expect(stored.settings.symbolTimeframes).toEqual({});
  });
});

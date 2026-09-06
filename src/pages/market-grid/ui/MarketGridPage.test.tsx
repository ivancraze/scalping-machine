// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as MarketEntity from '../../../entities/market';
import type { MarketRow } from '../../../entities/market';
import MarketGridPage from './MarketGridPage';

const mocks = vi.hoisted(() => ({
  useGridNatrsQuery: vi.fn<(symbols: string[], enabled: boolean) => { data: Record<string, number> }>(() => ({
    data: {},
  })),
}));

vi.mock('../../../entities/market', async (importOriginal) => ({
  ...(await importOriginal<typeof MarketEntity>()),
  useGridNatrsQuery: mocks.useGridNatrsQuery,
}));

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
const nativeGetComputedStyle = window.getComputedStyle;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    nativeGetComputedStyle.call(window, element),
  );
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('market grid virtualization', () => {
  it('requests NATR for the applied volume-ascending slice in its actual order', async () => {
    const stored = JSON.parse(localStorage.getItem('pulse-terminal:market-grid-settings') ?? '{}');
    stored.version = 2;
    stored.settings.sortField = 'volume';
    stored.settings.sortDirection = 'asc';
    stored.settings.limit = 3;
    localStorage.setItem('pulse-terminal:market-grid-settings', JSON.stringify(stored));

    await act(() => root.render(<MarketGridPage market={market} onOpenMainChart={vi.fn()} />));

    expect(mocks.useGridNatrsQuery).toHaveBeenLastCalledWith(
      ['COIN39USDT', 'COIN38USDT', 'COIN37USDT'],
      true,
    );
  });

  it('unions applied volume-ascending symbols with a different draft NATR candidate set', async () => {
    const stored = JSON.parse(localStorage.getItem('pulse-terminal:market-grid-settings') ?? '{}');
    stored.version = 2;
    stored.settings.sortField = 'volume';
    stored.settings.sortDirection = 'asc';
    stored.settings.limit = 3;
    localStorage.setItem('pulse-terminal:market-grid-settings', JSON.stringify(stored));
    await act(() => root.render(<MarketGridPage market={market} onOpenMainChart={vi.fn()} />));

    const filtersButton = container.querySelector<HTMLButtonElement>('[aria-label="Фильтры сетки"]');
    await act(() => filtersButton?.click());
    const natrLabel = [...document.body.querySelectorAll<HTMLLabelElement>('label')].find(({ textContent }) =>
      textContent?.includes('NATR 5м/14 от'),
    );
    const input = natrLabel?.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    await act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '1');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await vi.waitFor(() => {
      const symbols = mocks.useGridNatrsQuery.mock.calls.at(-1)?.[0] ?? [];
      expect(symbols).toHaveLength(40);
      expect(symbols.slice(0, 3)).toEqual(['COIN39USDT', 'COIN38USDT', 'COIN37USDT']);
      expect(symbols).toContain('COIN00USDT');
    });
  });

  it('labels the activity view by trade count and exposes the extra minute timeframes', async () => {
    const stored = JSON.parse(localStorage.getItem('pulse-terminal:market-grid-settings') ?? '{}');
    stored.settings.view = 'active';
    localStorage.setItem('pulse-terminal:market-grid-settings', JSON.stringify(stored));
    await act(() => root.render(<MarketGridPage market={market} onOpenMainChart={vi.fn()} />));

    const viewControl = container.querySelector<HTMLElement>('[aria-label="Представление сетки"]');
    expect(viewControl?.closest('.ant-select')?.textContent).toContain('Кол-во сделок');
    const extraTimeframes = container.querySelector<HTMLElement>(
      '[aria-label="Дополнительный общий таймфрейм"]',
    );
    expect(extraTimeframes).not.toBeNull();
    await act(() =>
      extraTimeframes?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })),
    );
    expect(document.body.textContent).toContain('3м');
    expect(document.body.textContent).toContain('30м');
  });

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

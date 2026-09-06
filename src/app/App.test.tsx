// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('antd', () => ({
  Menu: ({
    items,
    selectedKeys,
    onClick,
  }: {
    items: Array<{ key: string; label: ReactNode }>;
    selectedKeys: string[];
    onClick: (info: { key: string }) => void;
  }) => (
    <div role="tablist">
      {items.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={selectedKeys.includes(key)}
          onClick={() => onClick({ key })}
        >
          {label}
        </button>
      ))}
    </div>
  ),
  Spin: () => <span>loading</span>,
}));

vi.mock('./ThemeProvider', () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('../features/theme-switch', () => ({ ThemeSwitch: () => null }));
vi.mock('../entities/market', () => ({ useMarketQuery: () => ({ data: [] }) }));
vi.mock('../features/select-market-symbol', () => ({
  useSelectedMarketSymbol: () => ({ symbol: 'BTCUSDT', setSymbol: vi.fn() }),
}));
vi.mock('../pages/market-terminal', () => ({
  MarketTerminalPage: () => <main data-testid="watchlist-page">watchlist</main>,
}));
vi.mock('../pages/market-grid', () => ({
  MarketGridPage: () => <main data-testid="grid-page">grid</main>,
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('application routes', () => {
  it('renders grid at /grid and navigates with the top tabs', async () => {
    await act(() =>
      root.render(
        <MemoryRouter initialEntries={['/grid']}>
          <App />
          <LocationProbe />
        </MemoryRouter>,
      ),
    );

    expect(container.querySelector('[data-testid="grid-page"]')).not.toBeNull();
    const watchlistTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      ({ textContent }) => textContent === 'Список наблюдения',
    );
    const gridTab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      ({ textContent }) => textContent === 'Сетка',
    );
    expect(gridTab?.getAttribute('aria-selected')).toBe('true');

    await act(() => watchlistTab?.click());

    expect(container.querySelector('[data-testid="watchlist-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/watchlist');
    expect(watchlistTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('redirects an unknown path to /watchlist', async () => {
    await act(() =>
      root.render(
        <MemoryRouter initialEntries={['/unknown']}>
          <App />
          <LocationProbe />
        </MemoryRouter>,
      ),
    );

    expect(container.querySelector('[data-testid="watchlist-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/watchlist');
  });
});

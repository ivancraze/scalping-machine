import { describe, expect, it } from 'vitest';
import { createMarketListFilters, nextMarketListSortState, selectMarketRows } from './market-list';

describe('market list controls', () => {
  const market = [
    {
      symbol: 'BTCUSDT',
      priceTickSize: '0.1',
      price: 1,
      change: 1,
      range: 1,
      natr: 1,
      trades: 1,
      volume: 10,
    },
    {
      symbol: 'ETHUSDT',
      priceTickSize: '0.01',
      price: 2,
      change: -1,
      range: 2,
      natr: 2,
      trades: 2,
      volume: 20,
    },
  ];

  it('filters symbols case-insensitively', () => {
    expect(selectMarketRows(market, 'eth', null, 'desc', {})).toEqual([market[1]]);
  });

  it('cycles sort direction and clears active sorting', () => {
    const first = nextMarketListSortState({ sorting: null, sortDirection: 'desc' }, 'symbol');
    const second = nextMarketListSortState(first, 'symbol');
    const third = nextMarketListSortState(second, 'symbol');

    expect(first).toEqual({ sorting: 'symbol', sortDirection: 'asc' });
    expect(second).toEqual({ sorting: 'symbol', sortDirection: 'desc' });
    expect(third).toEqual({ sorting: null, sortDirection: 'desc' });
  });

  it('cycles favorite sorting between favorites first, favorites last, and the original order', () => {
    const favorites = new Set(['BTCUSDT']);
    const first = nextMarketListSortState({ sorting: null, sortDirection: 'asc' }, 'favorite');
    const second = nextMarketListSortState(first, 'favorite');
    const third = nextMarketListSortState(second, 'favorite');

    expect(first).toEqual({ sorting: 'favorite', sortDirection: 'desc' });
    expect(selectMarketRows(market, '', first.sorting, first.sortDirection, {}, {}, favorites)).toEqual(
      market,
    );
    expect(second).toEqual({ sorting: 'favorite', sortDirection: 'asc' });
    expect(selectMarketRows(market, '', second.sorting, second.sortDirection, {}, {}, favorites)).toEqual([
      market[1],
      market[0],
    ]);
    expect(third).toEqual({ sorting: null, sortDirection: 'asc' });
    expect(selectMarketRows(market, '', third.sorting, third.sortDirection, {}, {}, favorites)).toEqual(
      market,
    );
  });

  it('applies combined inclusive market filters', () => {
    const rows = [
      ...market,
      {
        symbol: 'SOLUSDT',
        priceTickSize: '0.01',
        price: 3,
        change: 3,
        range: 3,
        natr: 3,
        trades: 3,
        volume: 30,
      },
    ];
    const filters = createMarketListFilters();
    filters.volume = { min: 20, max: 30 };
    filters.change = { min: 0, max: 3 };
    filters.trades = { min: 2, max: 3 };
    filters.natr = { min: 2, max: 3 };
    filters.correlation = { min: 20, max: 20 };

    expect(
      selectMarketRows(rows, '', null, 'desc', { BTCUSDT: 0.15, SOLUSDT: 0.2 }, {}, new Set(), filters),
    ).toEqual([rows[2]]);
  });

  it('keeps correlation filter bounds inclusive and excludes rows without correlation', () => {
    const filters = createMarketListFilters();
    filters.correlation = { min: 15, max: 15 };

    expect(selectMarketRows(market, '', null, 'desc', { BTCUSDT: 0.15 }, {}, new Set(), filters)).toEqual([
      market[0],
    ]);
  });

  it('sorts NATR 5m/14 values in both directions and keeps unavailable values last', () => {
    const rows = [
      ...market,
      {
        symbol: 'SOLUSDT',
        priceTickSize: '0.01',
        price: 3,
        change: 0,
        range: 3,
        natr: 3,
        trades: 3,
        volume: 30,
      },
    ];
    const natrs = { BTCUSDT: 1.2, SOLUSDT: 0.4 };

    expect(selectMarketRows(rows, '', 'natr5m14', 'asc', {}, natrs).map(({ symbol }) => symbol)).toEqual([
      'SOLUSDT',
      'BTCUSDT',
      'ETHUSDT',
    ]);
    expect(selectMarketRows(rows, '', 'natr5m14', 'desc', {}, natrs).map(({ symbol }) => symbol)).toEqual([
      'BTCUSDT',
      'SOLUSDT',
      'ETHUSDT',
    ]);
  });
});

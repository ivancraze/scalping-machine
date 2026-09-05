import { describe, expect, it } from 'vitest';
import { nextMarketListSortState, selectMarketRows } from './market-list';

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
});

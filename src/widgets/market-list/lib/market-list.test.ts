import { describe, expect, it } from 'vitest';
import { nextSortState, selectCorrelationSymbols, selectMarketRows } from './market-list';
import type { MarketRow } from '../../../entities/market';

const marketRow = (symbol: string, volume: number): MarketRow => ({
  symbol,
  volume,
  priceTickSize: '0.01',
  price: 1,
  change: 0,
  range: 0,
  natr: 0,
  trades: 0,
});

describe('selectCorrelationSymbols', () => {
  it('selects every pair meeting the daily turnover threshold', () => {
    expect(
      selectCorrelationSymbols(
        [
          marketRow('ETHUSDT', 50_000_000),
          marketRow('SOLUSDT', 49_999_999),
          marketRow('BTCUSDT', 51_000_000),
        ],
        50_000_000,
      ),
    ).toEqual(['BTCUSDT', 'ETHUSDT']);
  });
});

describe('selectMarketRows', () => {
  it('preserves the source order when sorting is reset', () => {
    const market = [marketRow('SOLUSDT', 60_000_000), marketRow('BTCUSDT', 100_000_000)];

    expect(selectMarketRows(market, '', null, 'desc', {})).toEqual(market);
  });
});

describe('nextSortState', () => {
  it('cycles numeric columns through descending, ascending, and reset', () => {
    const descending = nextSortState({ sorting: null, sortDirection: 'desc' }, 'change');
    const ascending = nextSortState(descending, 'change');

    expect(descending).toEqual({ sorting: 'change', sortDirection: 'desc' });
    expect(ascending).toEqual({ sorting: 'change', sortDirection: 'asc' });
    expect(nextSortState(ascending, 'change')).toEqual({ sorting: null, sortDirection: 'asc' });
  });
});

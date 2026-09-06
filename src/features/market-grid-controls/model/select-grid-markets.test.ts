import { describe, expect, it } from 'vitest';
import type { MarketRow } from '../../../entities/market';
import type { MarketGridFilters } from './types';
import { defaultMarketGridFilters } from './storage';
import { selectGridMarkets } from './select-grid-markets';

const market: MarketRow[] = [
  {
    symbol: 'BTCUSDT',
    priceTickSize: '0.1',
    price: 1,
    change: 5,
    range: 1,
    natr: 1,
    trades: 20,
    volume: 200,
  },
  {
    symbol: 'ETHUSDT',
    priceTickSize: '0.01',
    price: 1,
    change: -4,
    range: 1,
    natr: 1,
    trades: 50,
    volume: 100,
  },
  {
    symbol: 'SOLUSDT',
    priceTickSize: '0.01',
    price: 1,
    change: 2,
    range: 1,
    natr: 1,
    trades: 10,
    volume: 300,
  },
  {
    symbol: 'XRPUSDT',
    priceTickSize: '0.0001',
    price: 1,
    change: -1,
    range: 1,
    natr: 1,
    trades: 40,
    volume: 400,
  },
];
const noFilters: MarketGridFilters = {
  ...defaultMarketGridFilters(),
  minVolume: null,
};

describe('selectGridMarkets', () => {
  it('searches case-insensitively and combines inclusive numeric filters', () => {
    const filters = {
      ...noFilters,
      minVolume: 100,
      minTrades: 20,
      minChange: -4,
      maxChange: 5,
    };

    expect(selectGridMarkets(market, 'usdt', 'all', filters, new Set()).map(({ symbol }) => symbol)).toEqual([
      'XRPUSDT',
      'BTCUSDT',
      'ETHUSDT',
    ]);
  });

  it('sorts each view by its documented metric and filters favorites', () => {
    expect(
      selectGridMarkets(market, '', 'gainers', noFilters, new Set()).map(({ symbol }) => symbol),
    ).toEqual(['BTCUSDT', 'SOLUSDT', 'XRPUSDT', 'ETHUSDT']);
    expect(selectGridMarkets(market, '', 'losers', noFilters, new Set()).map(({ symbol }) => symbol)).toEqual(
      ['ETHUSDT', 'XRPUSDT', 'SOLUSDT', 'BTCUSDT'],
    );
    expect(selectGridMarkets(market, '', 'active', noFilters, new Set()).map(({ symbol }) => symbol)).toEqual(
      ['ETHUSDT', 'XRPUSDT', 'BTCUSDT', 'SOLUSDT'],
    );
    expect(
      selectGridMarkets(market, '', 'favorites', noFilters, new Set(['ETHUSDT', 'BTCUSDT'])).map(
        ({ symbol }) => symbol,
      ),
    ).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('limits a sorted copy without mutating the market snapshot', () => {
    const originalOrder = market.map(({ symbol }) => symbol);

    expect(
      selectGridMarkets(market, '', 'all', noFilters, new Set(), { limit: 2 }).map(({ symbol }) => symbol),
    ).toEqual(['XRPUSDT', 'SOLUSDT']);
    expect(market.map(({ symbol }) => symbol)).toEqual(originalOrder);
  });

  it('applies max/range filters and a normalized blacklist before sorting', () => {
    const filters = { ...noFilters, maxVolume: 350, minRange: 1, maxTrades: 30 };

    expect(
      selectGridMarkets(market, '', 'all', filters, new Set(), {
        blacklist: ['BTCUSDT'],
        sortField: 'absoluteChange',
        sortDirection: 'desc',
      }).map(({ symbol }) => symbol),
    ).toEqual(['SOLUSDT']);
  });

  it('filters by NATR and always keeps unavailable NATR values last when sorting', () => {
    const natrs = { BTCUSDT: 2.5, SOLUSDT: 1.25, XRPUSDT: 3.5 };

    expect(
      selectGridMarkets(market, '', 'all', noFilters, new Set(), {
        sortField: 'natr',
        sortDirection: 'asc',
        natrs,
      }).map(({ symbol }) => symbol),
    ).toEqual(['SOLUSDT', 'BTCUSDT', 'XRPUSDT', 'ETHUSDT']);
    expect(
      selectGridMarkets(market, '', 'all', { ...noFilters, minNatr: 2, maxNatr: 3 }, new Set(), {
        natrs,
      }).map(({ symbol }) => symbol),
    ).toEqual(['BTCUSDT']);
  });
});

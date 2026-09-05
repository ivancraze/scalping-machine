import type { DepthLevel, MarketRow } from '../model/types';

// Public USD-M market data; no API key or signed requests.
const API = 'https://fapi.binance.com/fapi/v1';
const asNumber = (v: string | number) => Number(v);

type FuturesSymbol = {
  symbol: string;
  status: string;
  contractType: string;
  quoteAsset: string;
  marginAsset: string;
  filters: Array<{ filterType: string; tickSize?: string }>;
};
let instruments: { symbols: Map<string, string>; expiresAt: number } | undefined;
let instrumentsRequest: Promise<Map<string, string>> | undefined;

async function getInstruments(): Promise<Map<string, string>> {
  if (instruments && instruments.expiresAt > Date.now()) return instruments.symbols;
  if (instrumentsRequest) return instrumentsRequest;
  instrumentsRequest = (async () => {
    const response = await fetch(`${API}/exchangeInfo`);
    if (!response.ok) throw new Error('Binance Futures instruments unavailable');
    const data: { symbols: FuturesSymbol[] } = await response.json();
    const symbols = new Map<string, string>(
      data.symbols
        .filter(
          (item) =>
            item.status === 'TRADING' &&
            item.contractType === 'PERPETUAL' &&
            item.quoteAsset === 'USDT' &&
            item.marginAsset === 'USDT',
        )
        .map((item) => {
          const tickSize = item.filters.find((filter) => filter.filterType === 'PRICE_FILTER')?.tickSize;
          if (!tickSize || !Number.isFinite(Number(tickSize)) || Number(tickSize) <= 0)
            throw new Error('Binance Futures price tick unavailable');
          return [item.symbol, tickSize];
        }),
    );
    instruments = { symbols, expiresAt: Date.now() + 5 * 60_000 };
    return symbols;
  })();
  try {
    return await instrumentsRequest;
  } finally {
    instrumentsRequest = undefined;
  }
}

export async function getMarket(): Promise<MarketRow[]> {
  const symbols = await getInstruments();
  const response = await fetch(`${API}/ticker/24hr`);
  if (!response.ok) throw new Error('Binance API unavailable');
  const data: Array<Record<string, string>> = await response.json();
  return data
    .filter((x) => symbols.has(x.symbol) && asNumber(x.quoteVolume) > 800_000)
    .map((x) => {
      const price = asNumber(x.lastPrice),
        high = asNumber(x.highPrice),
        low = asNumber(x.lowPrice);
      return {
        symbol: x.symbol,
        priceTickSize: symbols.get(x.symbol)!,
        price,
        change: asNumber(x.priceChangePercent),
        range: (high / low) * 100 - 100,
        natr: ((high - low) / price) * 100,
        trades: asNumber(x.count),
        volume: asNumber(x.quoteVolume),
      };
    });
}

export async function getCandles(symbol: string, interval = '1m') {
  const response = await fetch(
    `${API}/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=72`,
  );
  if (!response.ok) throw new Error('Candles unavailable');
  return response.json() as Promise<Array<[number, string, string, string, string, string]>>;
}

export async function getDepth(
  symbol: string,
  minNotional: number,
  distance: number,
): Promise<{ mid: number; levels: DepthLevel[] }> {
  const response = await fetch(`${API}/depth?symbol=${symbol}&limit=500`);
  if (!response.ok) throw new Error('Order book unavailable');
  const data: { bids: [string, string][]; asks: [string, string][] } = await response.json();
  const mid = (asNumber(data.bids[0][0]) + asNumber(data.asks[0][0])) / 2;
  const parse = (side: 'bid' | 'ask', list: [string, string][]) =>
    list
      .map(([price, quantity]) => ({
        price: asNumber(price),
        quantity: asNumber(quantity),
        notional: asNumber(price) * asNumber(quantity),
        side,
      }))
      .filter((x) => x.notional >= minNotional && Math.abs((x.price / mid - 1) * 100) <= distance);
  return { mid, levels: [...parse('ask', data.asks), ...parse('bid', data.bids)] };
}

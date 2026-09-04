import type { DepthLevel, MarketRow } from '../model/types';

const API = 'https://api.binance.com/api/v3';
const asNumber = (v: string | number) => Number(v);

export async function getMarket(): Promise<MarketRow[]> {
  const response = await fetch(`${API}/ticker/24hr`);
  if (!response.ok) throw new Error('Binance API unavailable');
  const data: Array<Record<string, string>> = await response.json();
  return data
    .filter(
      (x) =>
        x.symbol.endsWith('USDT') &&
        asNumber(x.quoteVolume) > 800_000 &&
        !/UPUSDT|DOWNUSDT|BULLUSDT|BEARUSDT/.test(x.symbol),
    )
    .map((x) => {
      const price = asNumber(x.lastPrice),
        high = asNumber(x.highPrice),
        low = asNumber(x.lowPrice);
      return {
        symbol: x.symbol,
        price,
        change: asNumber(x.priceChangePercent),
        range: (high / low) * 100 - 100,
        natr: ((high - low) / price) * 100,
        trades: asNumber(x.count),
        volume: asNumber(x.quoteVolume),
      };
    });
}

export async function getCandles(symbol: string, interval = '5m') {
  const safeInterval = interval === '1s' || interval === '15s' ? '1m' : interval;
  const response = await fetch(`${API}/klines?symbol=${symbol}&interval=${safeInterval}&limit=72`);
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

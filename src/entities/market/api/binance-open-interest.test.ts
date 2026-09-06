import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  marketGet: vi.fn(),
  futuresDataGet: vi.fn(),
}));

vi.mock('./binance-client', () => ({
  binanceHttpClient: { get: mocks.marketGet },
  binanceFuturesDataHttpClient: { get: mocks.futuresDataGet },
}));

import { getOpenInterest, getOpenInterestHistory } from './binance';

describe('Binance open interest adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the current quantity and exchange timestamp', async () => {
    mocks.marketGet.mockResolvedValue({
      data: { openInterest: '10659.509', time: 1_589_437_530_011 },
    });

    await expect(getOpenInterest('BTCUSDT')).resolves.toEqual({
      timestamp: 1_589_437_530_011,
      quantity: 10_659.509,
    });
  });

  it('maps USD values, removes invalid rows and sorts history chronologically', async () => {
    const signal = new AbortController().signal;
    mocks.futuresDataGet.mockResolvedValue({
      data: [
        { timestamp: 300, sumOpenInterestValue: '30.5' },
        { timestamp: 100, sumOpenInterestValue: '10.5' },
        { timestamp: 200, sumOpenInterestValue: 'invalid' },
      ],
    });

    await expect(
      getOpenInterestHistory('BTCUSDT', '5m', { limit: 500, endTime: 400, signal }),
    ).resolves.toEqual([
      { timestamp: 100, valueUsd: 10.5 },
      { timestamp: 300, valueUsd: 30.5 },
    ]);
    expect(mocks.futuresDataGet).toHaveBeenCalledWith('/openInterestHist', {
      params: { symbol: 'BTCUSDT', period: '5m', limit: 500, endTime: 400 },
      signal,
    });
  });
});

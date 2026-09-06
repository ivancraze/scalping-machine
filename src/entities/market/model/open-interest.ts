export const openInterestPeriods = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'] as const;
export type OpenInterestPeriod = (typeof openInterestPeriods)[number];

const OPEN_INTEREST_PERIOD_MS: Record<OpenInterestPeriod, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

export const openInterestPeriodMilliseconds = (period: OpenInterestPeriod) => OPEN_INTEREST_PERIOD_MS[period];

export type OpenInterestPoint = {
  timestamp: number;
  valueUsd: number;
};

export type OpenInterestSnapshot = {
  timestamp: number;
  quantity: number;
};

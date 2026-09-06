export const AUTO_LEVEL_ID_PREFIX = 'pulse:auto-level:';
export const AUTO_LEVEL_OWNER_SOURCE_ID = 'pulse:auto-levels';

export const autoLevelIntervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type AutoLevelInterval = (typeof autoLevelIntervals)[number];

export type AutoLevelType = 'support' | 'resistance' | 'trend';
export type AutoLevelKind = 'support' | 'resistance' | 'trend-support' | 'trend-resistance';
export type AutoLevelDetector = 'breakout' | 'extremum';
export type ExtremumLevelStrength = 'weak' | 'medium' | 'strong';
export type AutoLevelCandle = [number, string, string, string, string, string];

export type AutoLevelSettings = {
  enabled: boolean;
  interval: AutoLevelInterval;
  historySize: 300 | 600 | 1000;
  minTouches: number;
  deviationPercent: number;
  nearPriceOnly: boolean;
  maxDistancePercent: number;
  enabledDetectors: Record<AutoLevelDetector, boolean>;
  extremumHistorySize: 200 | 500 | 1500;
  extremumMinTouches: 1 | 2 | 3;
  extremumStrength: ExtremumLevelStrength;
  extremumLimit: 3 | 5 | 7 | 10;
  showBrokenExtremums: boolean;
  extremumColor: string;
  enabledTypes: Record<AutoLevelType, boolean>;
  colors: {
    support: string;
    resistance: string;
  };
  lineWidth: 1 | 2 | 3 | 4;
  showLabels: boolean;
  hideWeak: boolean;
};

export type AutoLevelPoint = {
  timestamp: number;
  price: number;
};

export type DetectedAutoLevel = {
  id: string;
  detector: AutoLevelDetector;
  kind: AutoLevelKind;
  points: AutoLevelPoint[];
  projectedPrice: number;
  touches: number;
  score: number;
  weak: boolean;
  analysisInterval: AutoLevelInterval;
  frozen: boolean;
  distancePercent?: number;
  breakoutDirection?: 'up' | 'down';
  compression?: boolean;
  broken?: boolean;
  zonePercent?: number;
};

export type AutoLevelWorkerRequest = {
  requestId: number;
  scope: string;
  candles: AutoLevelCandle[];
  settings: AutoLevelSettings;
};

export type AutoLevelWorkerResponse =
  | { requestId: number; scope: string; levels: DetectedAutoLevel[] }
  | { requestId: number; scope: string; error: string };

export const DEFAULT_AUTO_LEVEL_SETTINGS: AutoLevelSettings = {
  enabled: false,
  interval: '15m',
  historySize: 600,
  minTouches: 3,
  deviationPercent: 0.25,
  nearPriceOnly: true,
  maxDistancePercent: 1,
  enabledDetectors: { breakout: true, extremum: false },
  extremumHistorySize: 1500,
  extremumMinTouches: 1,
  extremumStrength: 'medium',
  extremumLimit: 7,
  showBrokenExtremums: false,
  extremumColor: '#969aa8',
  enabledTypes: { support: true, resistance: true, trend: false },
  colors: { support: '#22c55e', resistance: '#ef4444' },
  lineWidth: 1,
  showLabels: true,
  hideWeak: false,
};

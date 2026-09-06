export type ChartIndicatorSettings = {
  volume: {
    visible: boolean;
    upColor: string;
    downColor: string;
    height: number;
  };
  openInterest: {
    visible: boolean;
    color: string;
    height: number;
  };
};

export type ChartIndicatorHeights = {
  volume: number;
  openInterest: number;
};

export const DEFAULT_CHART_INDICATOR_SETTINGS: ChartIndicatorSettings = {
  volume: {
    visible: true,
    upColor: '#09825f',
    downColor: '#a7294a',
    height: 112,
  },
  openInterest: {
    visible: true,
    color: '#0f8bfd',
    height: 72,
  },
};

export const defaultChartIndicatorSettings = (): ChartIndicatorSettings => ({
  volume: { ...DEFAULT_CHART_INDICATOR_SETTINGS.volume },
  openInterest: { ...DEFAULT_CHART_INDICATOR_SETTINGS.openInterest },
});

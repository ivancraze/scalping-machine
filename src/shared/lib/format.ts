export const compactUsd = (value: number) =>
  value >= 1e9
    ? `${(value / 1e9).toFixed(1)}B`
    : value >= 1e6
      ? `${(value / 1e6).toFixed(0)}M`
      : `${(value / 1e3).toFixed(0)}K`;
export const percentage = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const displayPrice = (n: number) =>
  n >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(5);

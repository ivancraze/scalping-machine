import type { MarketRow } from '../../../entities/market';

export type MarketTableRow = MarketRow & {
  correlation: number | undefined;
  correlationLoading: boolean;
  natr5m14: number | undefined;
  natr5m14Loading: boolean;
};

export type MarketListProps = {
  market: MarketRow[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
};

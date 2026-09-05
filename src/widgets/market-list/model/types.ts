import type { MarketRow } from '../../../entities/market';

export type MarketTableRow = MarketRow & {
  correlation: number | undefined;
  correlationLoading: boolean;
};

export type MarketListProps = {
  market: MarketRow[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
};

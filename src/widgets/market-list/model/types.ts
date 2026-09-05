import type { MarketRow } from '../../../entities/market';

export type MarketListProps = {
  market: MarketRow[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
};

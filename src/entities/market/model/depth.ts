export type MarketDepthLevel = {
  price: number;
  quantity: number;
  notional: number;
  side: 'bid' | 'ask';
};

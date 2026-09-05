import { QueryClientProvider } from '@tanstack/react-query';
import { MarketTerminalPage } from '../pages/market-terminal';
import { queryClient } from './query-client';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MarketTerminalPage />
    </QueryClientProvider>
  );
}

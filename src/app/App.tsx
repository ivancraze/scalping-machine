import { QueryClientProvider } from '@tanstack/react-query';
import { MarketTerminalPage } from '../pages/market-terminal';
import { queryClient } from './query-client';
import { ThemeProvider } from './ThemeProvider';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MarketTerminalPage />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

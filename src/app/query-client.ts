import { QueryClient } from '@tanstack/react-query';
import { shouldRetryRequest } from '../shared/api/http-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryRequest,
    },
  },
});

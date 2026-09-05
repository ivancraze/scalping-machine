import axios from 'axios';

export const binanceHttpClient = axios.create({
  baseURL: 'https://fapi.binance.com/fapi/v1',
  timeout: 10_000,
  withCredentials: false,
});

export class RequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RequestError';
  }
}

export function throwRequestError(error: unknown, message: string): never {
  if (axios.isCancel(error)) throw error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    throw new RequestError(message, status === undefined || status >= 500, { cause: error });
  }
  throw new RequestError(message, false, { cause: error });
}

export const shouldRetryRequest = (failureCount: number, error: unknown) =>
  failureCount < 1 && error instanceof RequestError && error.retryable;

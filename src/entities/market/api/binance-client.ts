import axios from 'axios';

export const binanceHttpClient = axios.create({
  baseURL: 'https://fapi.binance.com/fapi/v1',
  timeout: 10_000,
  withCredentials: false,
});

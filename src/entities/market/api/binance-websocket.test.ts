import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceWebSocketClient, type WebSocketConnection } from './binance-websocket';

class FakeWebSocket implements WebSocketConnection {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  closeFromServer() {
    this.readyState = 3;
    this.onclose?.();
  }

  message(stream: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ stream, data }) });
  }
}

afterEach(() => vi.useRealTimers());

describe('BinanceWebSocketClient', () => {
  it('uses the Binance market endpoint for regular market-data streams', () => {
    const createConnection = vi.fn(() => new FakeWebSocket());
    const client = new BinanceWebSocketClient(undefined, createConnection);

    client.subscribe('btcusdt@kline_1m', vi.fn());

    expect(createConnection).toHaveBeenCalledWith('wss://fstream.binance.com/market/stream');
  });

  it('shares a stream between subscribers and closes after the last unsubscribe', () => {
    const sockets: FakeWebSocket[] = [];
    const client = new BinanceWebSocketClient('ws://test', () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = client.subscribe('btcusdt@kline_1m', first);
    const unsubscribeSecond = client.subscribe('btcusdt@kline_1m', second);
    sockets[0].open();
    sockets[0].message('btcusdt@kline_1m', { close: '100' });

    expect(sockets).toHaveLength(1);
    expect(JSON.parse(sockets[0].sent[0])).toMatchObject({
      method: 'SUBSCRIBE',
      params: ['btcusdt@kline_1m'],
    });
    expect(first).toHaveBeenCalledWith({ close: '100' });
    expect(second).toHaveBeenCalledWith({ close: '100' });

    unsubscribeFirst();
    expect(sockets[0].sent).toHaveLength(1);
    unsubscribeSecond();
    expect(JSON.parse(sockets[0].sent[1])).toMatchObject({
      method: 'UNSUBSCRIBE',
      params: ['btcusdt@kline_1m'],
    });
    expect(sockets[0].closed).toBe(true);
  });

  it('reconnects, restores streams, and notifies subscribers', () => {
    vi.useFakeTimers();
    const sockets: FakeWebSocket[] = [];
    const client = new BinanceWebSocketClient('ws://test', () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });
    const onReconnect = vi.fn();

    client.subscribe('btcusdt@aggTrade', vi.fn(), onReconnect);
    sockets[0].open();
    sockets[0].closeFromServer();
    vi.advanceTimersByTime(1_000);
    sockets[1].open();

    expect(sockets).toHaveLength(2);
    expect(JSON.parse(sockets[1].sent[0])).toMatchObject({
      method: 'SUBSCRIBE',
      params: ['btcusdt@aggTrade'],
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled reconnect after the final unsubscribe', () => {
    vi.useFakeTimers();
    const sockets: FakeWebSocket[] = [];
    const client = new BinanceWebSocketClient('ws://test', () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });

    const unsubscribe = client.subscribe('btcusdt@aggTrade', vi.fn());
    sockets[0].open();
    sockets[0].closeFromServer();
    unsubscribe();
    vi.advanceTimersByTime(15_000);

    expect(sockets).toHaveLength(1);
  });

  it('ignores messages for inactive streams', () => {
    const sockets: FakeWebSocket[] = [];
    const client = new BinanceWebSocketClient('ws://test', () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });
    const listener = vi.fn();

    client.subscribe('btcusdt@aggTrade', listener);
    sockets[0].open();
    sockets[0].message('ethusdt@aggtrade', { price: '100' });

    expect(listener).not.toHaveBeenCalled();
  });
});

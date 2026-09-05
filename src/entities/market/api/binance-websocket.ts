type WebSocketMessageEvent = { data: string };

export type WebSocketConnection = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null;
  onclose: (() => void) | null;
};

type WebSocketFactory = (url: string) => WebSocketConnection;
type StreamListener = (data: unknown) => void;
type ReconnectListener = () => void;

type Subscription = {
  onMessage: StreamListener;
  onReconnect?: ReconnectListener;
};

const BINANCE_FUTURES_STREAM_URL = 'wss://fstream.binance.com/market/stream';
const RECONNECT_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000];
const SOCKET_OPEN = 1;

export class BinanceWebSocketClient {
  private socket: WebSocketConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private hasConnected = false;
  private readonly subscriptions = new Map<string, Set<Subscription>>();

  constructor(
    private readonly url = BINANCE_FUTURES_STREAM_URL,
    private readonly createConnection: WebSocketFactory = (socketUrl) =>
      new WebSocket(socketUrl) as unknown as WebSocketConnection,
  ) {}

  subscribe(stream: string, onMessage: StreamListener, onReconnect?: ReconnectListener) {
    const subscriptions = this.subscriptions.get(stream) ?? new Set<Subscription>();
    const isNewStream = subscriptions.size === 0;
    const subscription = { onMessage, onReconnect };
    subscriptions.add(subscription);
    this.subscriptions.set(stream, subscriptions);

    if (this.socket?.readyState === SOCKET_OPEN && isNewStream) this.send('SUBSCRIBE', [stream]);
    else this.connect();

    return () => {
      const activeSubscriptions = this.subscriptions.get(stream);
      if (!activeSubscriptions) return;
      activeSubscriptions.delete(subscription);
      if (activeSubscriptions.size > 0) return;
      this.subscriptions.delete(stream);
      if (this.socket?.readyState === SOCKET_OPEN) this.send('UNSUBSCRIBE', [stream]);
      if (this.subscriptions.size === 0) this.disconnect();
    };
  }

  private connect() {
    if (this.socket || this.reconnectTimer || this.subscriptions.size === 0) return;
    const socket = this.createConnection(this.url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.reconnectAttempts = 0;
      this.send('SUBSCRIBE', [...this.subscriptions.keys()]);
      if (reconnected) {
        for (const subscriptions of this.subscriptions.values()) {
          for (const subscription of subscriptions) subscription.onReconnect?.();
        }
      }
    };
    socket.onmessage = ({ data }) => this.routeMessage(data);
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      if (this.subscriptions.size > 0) this.scheduleReconnect();
    };
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.subscriptions.size === 0) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
    if (params.length === 0 || this.socket?.readyState !== SOCKET_OPEN) return;
    this.socket.send(JSON.stringify({ method, params, id: Date.now() }));
  }

  private routeMessage(rawMessage: string) {
    const message: unknown = JSON.parse(rawMessage);
    if (!message || typeof message !== 'object' || !('stream' in message) || !('data' in message)) return;
    const { stream, data } = message as { stream: unknown; data: unknown };
    if (typeof stream !== 'string') return;
    for (const subscription of this.subscriptions.get(stream) ?? []) subscription.onMessage(data);
  }
}

export const binanceWebSocket = new BinanceWebSocketClient();

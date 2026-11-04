/**
 * The socket of one group.
 *
 * A group pushes committed public messages to its active human members. The
 * client reads the messages over HTTP and receives the new ones here.
 */

import type { GroupMessage } from './groups.ts';

/** The state the group socket exposes to the interface. */
export interface GroupSocketState {
  connected: boolean;
  reconnecting: boolean;
}

export interface GroupSocketHandlers {
  /** A message arrived. */
  onMessage: (message: GroupMessage) => void;
  /** The connection state changed. */
  onState: (state: GroupSocketState) => void;
}

export interface GroupSocketOptions {
  url: string;
  token: string;
  groupId: string;
  handlers: GroupSocketHandlers;
  reconnectDelayMs?: number;
}

const DEFAULT_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
/** The server asks for a ping to keep the membership fresh. */
const PING_INTERVAL_MS = 25000;

export class GroupSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private closedByClient = false;
  private state: GroupSocketState = { connected: false, reconnecting: false };
  private readonly options: GroupSocketOptions;

  constructor(options: GroupSocketOptions) {
    this.options = options;
  }

  getState(): GroupSocketState {
    return this.state;
  }

  open(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.closedByClient = false;
    const url = new URL(this.options.url);
    url.searchParams.set('token', this.options.token);
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.setState({ connected: true, reconnecting: false });
      this.startPing();
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let packet: { type?: string; message?: GroupMessage };
      try {
        packet = JSON.parse(event.data) as { type?: string; message?: GroupMessage };
      } catch {
        return;
      }
      if (packet.type === 'message.created' && packet.message) {
        this.options.handlers.onMessage(packet.message);
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.stopPing();
      this.setState({ connected: false });
      if (this.closedByClient) return;
      this.scheduleReconnect();
    };
  }

  close(): void {
    this.closedByClient = true;
    this.stopPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setState({ connected: false, reconnecting: false });
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      const socket = this.socket;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.setState({ reconnecting: true });
    const base = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const delay = Math.min(base * 2 ** this.attempts, MAX_RECONNECT_DELAY_MS);
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private setState(patch: Partial<GroupSocketState>): void {
    const next = { ...this.state, ...patch };
    if (next.connected === this.state.connected && next.reconnecting === this.state.reconnecting) {
      return;
    }
    this.state = next;
    this.options.handlers.onState(next);
  }
}

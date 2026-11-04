/**
 * The socket of one chat session.
 *
 * The socket owns one connection and its reconnection. The interface reads
 * the state the socket exposes and sends intents through it.
 *
 * Two facts drive the design. The server delivers the truth of a
 * conversation as events, and every event carries a position, so a client
 * that reconnects asks for the events after the last position it saw and
 * loses nothing. And one session holds at most one Run, so the socket
 * refuses a second message while one is in flight.
 */

import {
  isFailure,
  isTerminal,
  packetCursor,
  type IncomingPacket,
} from './chat-packet.ts';

/** The state the socket exposes to the interface. */
export interface ChatSocketState {
  /** The socket is open and the server accepted it. */
  connected: boolean;
  /** The socket is reconnecting after a loss. */
  reconnecting: boolean;
  /** A Run is in flight. */
  busy: boolean;
  /** The session the socket talks about. */
  sessionId: string | null;
  /** The last error the server reported. */
  error: string | null;
}

export interface ChatSocketHandlers {
  /** The server sent a packet. */
  onPacket: (packet: IncomingPacket) => void;
  /** The connection state changed. */
  onState: (state: ChatSocketState) => void;
}

export interface ChatSocketOptions {
  /** The URL of the socket, without the query. */
  url: string;
  /** The access token of the session. */
  token: string;
  /** The agent the session belongs to. */
  agentId: string;
  /** The session, when the client already knows it. */
  sessionId?: string | null;
  /** The language of the interface, for the server logs. */
  language?: string;
  /** How long the client waits before the first reconnection attempt. */
  reconnectDelayMs?: number;
  handlers: ChatSocketHandlers;
}

/** The delay before the first reconnection attempt, and the base of the backoff. */
const DEFAULT_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8000;

export class ChatSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private closedByClient = false;
  private state: ChatSocketState;
  /** The position of the last event the client saw, for a reconnection. */
  private cursor: string | null = null;
  /** The Run the socket is attached to, when there is one. */
  private attachedRunId: string | null = null;

  /** The options of the socket. */
  private readonly options: ChatSocketOptions;

  constructor(options: ChatSocketOptions) {
    this.options = options;
    this.state = {
      connected: false,
      reconnecting: false,
      busy: false,
      sessionId: options.sessionId ?? null,
      error: null,
    };
  }

  /** The state of the socket. */
  getState(): ChatSocketState {
    return this.state;
  }

  /** Open the socket. A socket that is already open stays open. */
  open(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByClient = false;
    const url = new URL(this.options.url);
    url.searchParams.set('token', this.options.token);
    url.searchParams.set('lang', this.options.language ?? 'zh');
    if (this.options.sessionId) {
      url.searchParams.set('session_id', this.options.sessionId);
    }
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState({ connected: true, reconnecting: false, error: null });
      // A socket that was attached to a Run asks for the events it missed.
      if (this.attachedRunId) {
        this.attachRun(this.attachedRunId, this.cursor);
      }
    };

    socket.onmessage = (event) => {
      const packet = this.parse(event.data);
      if (!packet) return;
      this.handlePacket(packet);
    };

    socket.onerror = () => {
      // The close event carries the outcome; an error alone says nothing.
    };

    socket.onclose = () => {
      this.socket = null;
      this.setState({ connected: false });
      if (this.closedByClient) return;
      this.scheduleReconnect();
    };
  }

  /** Close the socket and stop the reconnection. */
  close(): void {
    this.closedByClient = true;
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

  /** Send a message. It is dropped when the socket is not open. */
  sendMessage(payload: {
    content: string;
    displayContent?: string;
    fileName?: string;
    modelId?: string;
    runId?: string;
    correlationId?: string;
  }): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(
      JSON.stringify({
        content: payload.content,
        ...(payload.displayContent ? { display_content: payload.displayContent } : {}),
        ...(payload.fileName ? { file_name: payload.fileName } : {}),
        ...(payload.modelId ? { model_id: payload.modelId } : {}),
        ...(payload.runId ? { run_id: payload.runId } : {}),
        ...(payload.correlationId ? { correlation_id: payload.correlationId } : {}),
      }),
    );
    this.setState({ busy: true });
    return true;
  }

  /** Ask the Run in flight to stop. */
  abort(runId: string): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'abort', run_id: runId }));
    return true;
  }

  /** Attach to a Run that is still running, from the last position seen. */
  attachRun(runId: string, cursor?: string | null): boolean {
    this.attachedRunId = runId;
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(
      JSON.stringify({
        type: 'attach_run',
        run_id: runId,
        ...(cursor ?? this.cursor ? { cursor: cursor ?? this.cursor } : {}),
      }),
    );
    return true;
  }

  /** The position of the last event the client saw. */
  getCursor(): string | null {
    return this.cursor;
  }

  private handlePacket(packet: IncomingPacket): void {
    if (packet.type === 'connected') {
      this.setState({ sessionId: packet.session_id ?? null, busy: false, error: null });
    }
    const cursor = packetCursor(packet);
    if (cursor) {
      this.cursor = cursor;
    }
    if (packet.type === 'runtime_status') {
      if (packet.event === 'queued' || packet.event === 'run_created') {
        this.setState({ busy: true });
      }
    }
    if (isTerminal(packet)) {
      this.attachedRunId = null;
      this.setState({ busy: false, error: packet.code ? packet.message ?? null : null });
    }
    if (isFailure(packet)) {
      this.setState({ busy: false, error: packet.message ?? null });
    }
    this.options.handlers.onPacket(packet);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.setState({ reconnecting: true });
    const base = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const delay = Math.min(base * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private setState(patch: Partial<ChatSocketState>): void {
    const next = { ...this.state, ...patch };
    const changed =
      next.connected !== this.state.connected ||
      next.reconnecting !== this.state.reconnecting ||
      next.busy !== this.state.busy ||
      next.sessionId !== this.state.sessionId ||
      next.error !== this.state.error;
    if (!changed) return;
    this.state = next;
    this.options.handlers.onState(next);
  }

  private parse(raw: unknown): IncomingPacket | null {
    if (typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw) as IncomingPacket;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

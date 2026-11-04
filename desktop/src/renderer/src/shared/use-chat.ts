import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from './chat-contract.ts';
import {
  isAnswerChunk,
  isFailure,
  isTerminal,
  isThinking,
  isToolCall,
  packetRunId,
  type IncomingPacket,
} from './chat-packet.ts';
import { listMessages, readRuntimeState } from './chat-api.ts';
import { notifyAnswer } from './notify.ts';
import { ChatSocket, type ChatSocketState } from './chat-socket.ts';
import { isRunActive } from './run-state.ts';

/**
 * The chat of one session.
 *
 * The hook owns the socket and the messages it receives. The server is the
 * authority: the stored messages replace the streamed ones as soon as the
 * server has them, so the interface never shows a message the server did
 * not store.
 */

export interface ChatTurn {
  /** The kind of the turn. */
  kind: 'message' | 'thinking' | 'tool';
  /** The message of a message turn. */
  message?: ChatMessage;
  /** The reasoning of a thinking turn. */
  thinking?: string;
  /** The tool of a tool turn. */
  tool?: {
    callId: string;
    name: string;
    args: Record<string, unknown>;
    status: 'running' | 'done';
    result: string;
    reasoning: string;
    errorCode?: string | null;
  };
}

export interface UseChatOptions {
  /** The address of the server, without the API path. */
  serverUrl: string;
  /** The access token of the session. */
  token: string | null;
  /** The agent the session belongs to. */
  agentId: string | null;
  /** The session the chat shows. */
  sessionId: string | null;
  /** The interface language, for the server logs. */
  language?: string;
  /** The name of the agent, for the notice of a finished answer. */
  agentName?: string;
}

export interface ChatView {
  /** The turns of the chat, oldest first. */
  turns: ChatTurn[];
  /** The state of the socket. */
  socket: ChatSocketState;
  /** Send a message. */
  send: (content: string, options?: { modelId?: string; runId?: string; correlationId?: string }) => boolean;
  /** Stop the Run in flight. */
  stop: () => void;
  /** Whether a Run is in flight. */
  busy: boolean;
  /** Reload the messages of the session from the server. */
  reload: () => Promise<void>;
}

const EMPTY_STATE: ChatSocketState = {
  connected: false,
  reconnecting: false,
  busy: false,
  sessionId: null,
  error: null,
};

/** The turns that one packet produces. */
function reduceTurns(current: ChatTurn[], packet: IncomingPacket): ChatTurn[] {
  if (isThinking(packet)) {
    const content = packet.content ?? '';
    const last = current[current.length - 1];
    if (last?.kind === 'thinking') {
      return [
        ...current.slice(0, -1),
        { kind: 'thinking', thinking: (last.thinking ?? '') + content },
      ];
    }
    return [...current, { kind: 'thinking', thinking: content }];
  }
  if (isAnswerChunk(packet)) {
    const content = packet.content ?? '';
    const last = current[current.length - 1];
    if (last?.kind === 'message' && last.message?.role === 'assistant') {
      const message = last.message;
      return [
        ...current.slice(0, -1),
        {
          kind: 'message',
          message: { ...message, content: message.content + content },
        },
      ];
    }
    return [
      ...current,
      {
        kind: 'message',
        message: {
          id: `stream-${Date.now()}`,
          role: 'assistant',
          content,
          created_at: null,
          cursor: null,
        },
      },
    ];
  }
  if (isToolCall(packet)) {
    const callId = packet.call_id ?? '';
    const without = current.filter(
      (turn) => !(turn.kind === 'tool' && turn.tool?.callId === callId),
    );
    return [
      ...without,
      {
        kind: 'tool',
        tool: {
          callId,
          name: packet.name ?? 'tool',
          args: packet.args ?? {},
          status: packet.status === 'done' ? 'done' : 'running',
          result: packet.result ?? '',
          reasoning: packet.reasoning_content ?? '',
          errorCode: packet.error_code ?? null,
        },
      },
    ];
  }
  return current;
}

export function useChat(options: UseChatOptions): ChatView {
  const { serverUrl, token, agentId, sessionId } = options;
  /** The messages the server stores. */
  const [stored, setStored] = useState<ChatMessage[]>([]);
  /** The turns that arrived on the socket and the server did not store yet. */
  const [live, setLive] = useState<ChatTurn[]>([]);
  const [socketState, setSocketState] = useState<ChatSocketState>(EMPTY_STATE);
  const socketRef = useRef<ChatSocket | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !agentId || !sessionId) return;
    setStored(await listMessages(serverUrl, token, agentId, sessionId));
  }, [agentId, serverUrl, sessionId, token]);

  /** The name the notice shows, kept current without a render-time write. */
  const agentNameRef = useRef(options.agentName ?? '');
  useEffect(() => {
    agentNameRef.current = options.agentName ?? '';
  }, [options.agentName]);

  const handlePacket = useCallback(
    (packet: IncomingPacket) => {
      if (isThinking(packet) || isAnswerChunk(packet) || isToolCall(packet)) {
        setLive((current) => reduceTurns(current, packet));
        return;
      }
      if (packet.type === 'runtime_status') {
        const runId = packetRunId(packet);
        if (runId) setActiveRunId(runId);
        return;
      }
      if (isTerminal(packet)) {
        setActiveRunId(null);
        setCorrelationId(packet.correlation_id ?? null);
        if (!isFailure(packet) && typeof packet.content === 'string' && packet.content) {
          // The window may be in the tray, so the answer also goes to the
          // system.
          void notifyAnswer({
            agentName: agentNameRef.current,
            text: packet.content,
          });
        }
        // The server stored the message; the local view is replaced by the
        // stored one.
        void reload();
        return;
      }
      if (isFailure(packet)) {
        setActiveRunId(null);
      }
    },
    [reload],
  );

  useEffect(() => {
    if (!token || !agentId || !sessionId) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      const messages = await listMessages(serverUrl, token, agentId, sessionId);
      if (cancelled) return;
      setStored(messages);

      // The Run that holds the session lane is the truth about the work. A
      // client that opened on a session with a Run in flight attaches to it.
      const state = await readRuntimeState(serverUrl, token, agentId, sessionId);
      if (cancelled) return;
      const run = state?.active_run ?? null;
      if (!run || !isRunActive(run)) return;
      setActiveRunId(run.run_id);
      setCorrelationId(run.correlation_id ?? null);
    })();

    const socket = new ChatSocket({
      url: `${serverUrl.replace(/^http/, 'ws')}/ws/chat/${agentId}`,
      token,
      agentId,
      sessionId,
      language: options.language,
      handlers: {
        onPacket: handlePacket,
        onState: setSocketState,
      },
    });
    socketRef.current = socket;
    socket.open();

    // The Run that holds the session lane. The socket attaches to it, and
    // asks for the events it missed after a reconnection.
    void (async () => {
      const state = await readRuntimeState(serverUrl, token, agentId, sessionId);
      if (cancelled) return;
      const run = state?.active_run ?? null;
      if (!run || !isRunActive(run)) return;
      socket.attachRun(run.run_id);
    })();

    return () => {
      cancelled = true;
      socket.close();
      socketRef.current = null;
    };
    // The socket is rebuilt when the session or the credential changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, handlePacket, sessionId, token, serverUrl]);

  const send = useCallback(
    (
      content: string,
      sendOptions: { modelId?: string; runId?: string; correlationId?: string } = {},
    ) => {
      const socket = socketRef.current;
      if (!socket) return false;
      const runId = sendOptions.runId ?? activeRunId ?? undefined;
      const correlation = sendOptions.correlationId ?? correlationId ?? undefined;
      setLive((current) => [
        ...current,
        {
          kind: 'message',
          message: {
            id: `local-${Date.now()}`,
            role: 'user',
            content,
            created_at: new Date().toISOString(),
            cursor: null,
          },
        },
      ]);
      return socket.sendMessage({
        content,
        displayContent: content,
        ...(sendOptions.modelId ? { modelId: sendOptions.modelId } : {}),
        ...(runId ? { runId } : {}),
        ...(correlation ? { correlationId: correlation } : {}),
      });
    },
    [activeRunId, correlationId],
  );

  const stop = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !activeRunId) return;
    socket.abort(activeRunId);
  }, [activeRunId]);

  // The stored messages come first, and the live turns follow them. A turn
  // the server has already stored is not shown twice.
  const turns = useMemo<ChatTurn[]>(() => {
    const storedTurns: ChatTurn[] = stored.map((message) => ({ kind: 'message', message }));
    const storedIds = new Set(stored.map((message) => message.id));
    const pending = live.filter((turn) => {
      if (turn.kind !== 'message') return true;
      const id = turn.message?.id;
      return !id || !storedIds.has(id);
    });
    return [...storedTurns, ...pending];
  }, [live, stored]);

  return useMemo(
    () => ({
      turns,
      socket: socketState,
      send,
      stop,
      busy: socketState.busy,
      reload,
    }),
    [reload, send, socketState, stop, turns],
  );
}

/**
 * The chat API of the platform.
 *
 * The server owns the truth about a conversation: the sessions, the messages,
 * and the Run that holds a session lane. This module reads that truth.
 */

import { apiRequest } from './http.ts';
import type { ChatMessage, ChatSession, SessionRuntimeState } from './chat-contract.ts';

export type { ChatMessage, ChatSession, SessionRuntimeState };

/** The sessions of one agent that the signed-in user owns. */
export async function listSessions(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<ChatSession[]> {
  try {
    return await apiRequest<ChatSession[]>(`${baseUrl}/api/agents/${agentId}/sessions`, { token });
  } catch {
    return [];
  }
}

/** The messages of one session, oldest first. */
export async function listMessages(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  try {
    return await apiRequest<ChatMessage[]>(
      `${baseUrl}/api/agents/${agentId}/sessions/${sessionId}/messages?limit=${limit}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Read the runtime state of one session. */
export async function readRuntimeState(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
): Promise<SessionRuntimeState | null> {
  try {
    return await apiRequest<SessionRuntimeState>(
      `${baseUrl}/api/agents/${agentId}/sessions/${sessionId}/runtime-state`,
      { token },
    );
  } catch {
    return null;
  }
}

import { apiRequest } from './http.ts';

/**
 * The sessions of one agent.
 *
 * The server owns the sessions. The client creates one, reads the list, and
 * names the one it shows.
 */

/** The answer of the create endpoint. */
export interface CreatedSession {
  id: string;
  agent_id: string | null;
  user_id: string | null;
  title: string | null;
  source_channel: string;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
  tool_call_count: number;
  unread_count: number;
  is_primary: boolean;
}

/** Create a new session of an agent. */
export async function createSession(
  baseUrl: string,
  token: string,
  agentId: string,
  title?: string,
): Promise<CreatedSession> {
  return apiRequest<CreatedSession>(`${baseUrl}/api/agents/${agentId}/sessions`, {
    token,
    method: 'POST',
    body: JSON.stringify(title ? { title } : {}),
  });
}

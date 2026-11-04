import { apiRequest } from './http.ts';

/**
 * The assistants of the organization.
 *
 * The server owns the assistants and what they spent. The client reads the
 * list and the workbench reads the numbers of each one.
 */

/** One assistant. */
export interface AgentSummary {
  id: string;
  name: string;
  role_description?: string | null;
  status?: string | null;
  avatar_url?: string | null;
  /** Whether the assistant belongs to the organization, to one person, or to a few. */
  access_mode?: string | null;
  max_tokens_per_day?: number | null;
  tokens_used_today?: number | null;
  llm_calls_today?: number | null;
  llm_limit?: number | null;
  created_at?: string | null;
  last_active_at?: string | null;
  /** The kind of the assistant: native or an outside one. */
  agent_type?: string | null;
  /** When the authorization of the assistant ends. */
  expires_at?: string | null;
}

/** Every assistant of the organization. */
export async function listAgents(baseUrl: string, token: string): Promise<AgentSummary[]> {
  try {
    const answer = await apiRequest<AgentSummary[] | { items?: AgentSummary[] }>(
      `${baseUrl}/api/agents/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

import { apiRequest } from './http.ts';

/**
 * The numbers of the organization.
 *
 * The dashboard is a reading of what the organization used: the agents that
 * run, the tokens that went through them, and the approvals that wait. Every
 * number here comes from the server; the client computes none of them.
 */

/** The counts of the organization. */
export interface OrgStats {
  total_agents: number;
  running_agents: number;
  total_users: number;
  pending_approvals: number;
}

/** One bucket of usage. */
export interface TokenBucket {
  total_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_hit_rate: number;
}

/** The usage of the organization, over three spans. */
export interface TokenUsage {
  today: TokenBucket;
  month: TokenBucket;
  total: TokenBucket;
}

/** One row of the activity of an Agent. */
export interface AgentActivityEntry {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  created_at: string | null;
}

/** The counts of the organization, for an administrator. */
export async function readOrgStats(baseUrl: string, token: string): Promise<OrgStats | null> {
  try {
    return await apiRequest<OrgStats>(`${baseUrl}/api/enterprise/stats`, { token });
  } catch {
    return null;
  }
}

/** The token usage of the organization. */
export async function readTokenUsage(baseUrl: string, token: string): Promise<TokenUsage | null> {
  try {
    return await apiRequest<TokenUsage>(`${baseUrl}/api/tenants/me/token-usage`, { token });
  } catch {
    return null;
  }
}

/** The recent activity of one Agent. */
export async function readAgentActivity(
  baseUrl: string,
  token: string,
  agentId: string,
  limit = 20,
): Promise<AgentActivityEntry[]> {
  try {
    const answer = await apiRequest<AgentActivityEntry[] | { items?: AgentActivityEntry[] }>(
      `${baseUrl}/api/agents/${agentId}/activity?limit=${limit}`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

import { apiRequest } from './http.ts';

/**
 * The administration of one Agent.
 *
 * The server owns the Agent. The client reads it, changes the fields it may
 * change, and reads the models and the access of the organization.
 */

/** One Agent as the server returns it. */
export interface AgentSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  role_description: string;
  bio: string | null;
  welcome_message: string | null;
  status: string;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  context_window_size: number;
  max_tokens_per_day: number | null;
  max_tokens_per_month: number | null;
  max_tool_rounds: number;
  max_triggers: number;
  min_poll_interval_min: number;
  webhook_rate_limit: number;
  heartbeat_enabled: boolean;
  heartbeat_interval_minutes: number;
  heartbeat_active_hours: string;
  timezone: string | null;
  access_mode: string;
  company_access_level: string;
  agent_type: string;
  tokens_used_today: number;
  tokens_used_month: number;
  llm_calls_today: number;
  max_llm_calls_per_day: number;
  created_at: string;
}

/** One model of the organization. */
export interface ModelSummary {
  id: string;
  provider: string;
  model: string;
  label: string;
  enabled: boolean;
  supports_vision: boolean;
  supports_tool_calling: boolean | null;
}

/** The change of one Agent. Only the given fields change. */
export type AgentPatch = Partial<{
  name: string;
  avatar_url: string | null;
  role_description: string;
  bio: string;
  welcome_message: string;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  context_window_size: number;
  max_tokens_per_day: number | null;
  max_tokens_per_month: number | null;
  max_tool_rounds: number;
  max_triggers: number;
  heartbeat_enabled: boolean;
  heartbeat_interval_minutes: number;
  heartbeat_active_hours: string;
}>;

/** The access of one Agent. */
export interface AgentPermissions {
  scope_type: 'company' | 'private' | 'custom';
  access_level: 'use' | 'manage';
  is_owner: boolean;
}

/** Read one Agent. */
export async function readAgent(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentSummary> {
  return apiRequest<AgentSummary>(`${baseUrl}/api/agents/${agentId}`, { token });
}

/** Change one Agent. */
export async function updateAgent(
  baseUrl: string,
  token: string,
  agentId: string,
  patch: AgentPatch,
): Promise<AgentSummary> {
  return apiRequest<AgentSummary>(`${baseUrl}/api/agents/${agentId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** The models of the organization. */
export async function listModels(baseUrl: string, token: string): Promise<ModelSummary[]> {
  try {
    return await apiRequest<ModelSummary[]>(`${baseUrl}/api/enterprise/llm-models`, { token });
  } catch {
    return [];
  }
}

/** The access of one Agent. */
export async function readPermissions(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentPermissions> {
  const raw = await apiRequest<{ scope_type?: string; access_level?: string; is_owner?: boolean }>(
    `${baseUrl}/api/agents/${agentId}/permissions`,
    { token },
  );
  const scope = raw.scope_type === 'user' ? 'private' : raw.scope_type;
  return {
    scope_type: scope === 'private' || scope === 'custom' ? scope : 'company',
    access_level: raw.access_level === 'manage' ? 'manage' : 'use',
    is_owner: raw.is_owner === true,
  };
}

/** Change the access of one Agent. */
export async function updatePermissions(
  baseUrl: string,
  token: string,
  agentId: string,
  permissions: { scope_type: string; access_level: string },
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/permissions`, {
    token,
    method: 'PUT',
    body: JSON.stringify(permissions),
  });
}

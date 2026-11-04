import { apiRequest } from './http.ts';

/**
 * The parts of the platform a person uses, and the parts a program calls.
 *
 * Everything here is on the server and had no place in the client. A screen
 * that needs one of them calls it here, so no component builds a path.
 */

/** The templates a new assistant may start from. */
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  capability_bullets?: string[];
  is_builtin?: boolean;
}

/** The templates of the organization. */
export async function listTemplates(baseUrl: string, token: string): Promise<AgentTemplate[]> {
  try {
    return await apiRequest<AgentTemplate[]>(`${baseUrl}/api/templates`, { token });
  } catch {
    return [];
  }
}

/** One approval of the organization. */
export interface Approval {
  id: string;
  agent_id?: string | null;
  agent_name?: string | null;
  title?: string | null;
  description?: string | null;
  status: string;
  created_at: string | null;
}

/** The approvals that wait. */
export async function listApprovals(
  baseUrl: string,
  token: string,
): Promise<Approval[]> {
  try {
    return await apiRequest<Approval[]>(`${baseUrl}/api/enterprise/approvals`, { token });
  } catch {
    return [];
  }
}

/** The counts of the organization. */
export async function readOrgCounts(
  baseUrl: string,
  token: string,
): Promise<{
  total_agents: number;
  running_agents: number;
  total_users: number;
  pending_approvals: number;
} | null> {
  try {
    return await apiRequest(`${baseUrl}/api/enterprise/stats`, { token });
  } catch {
    return null;
  }
}

/** One model of the organization. */
export interface EnterpriseModel {
  id: string;
  provider: string;
  model: string;
  label: string;
  is_default: boolean;
  enabled: boolean;
  api_key_masked?: string | null;
}

/** The models of the organization. */
export async function listEnterpriseModels(
  baseUrl: string,
  token: string,
): Promise<EnterpriseModel[]> {
  try {
    return await apiRequest<EnterpriseModel[]>(`${baseUrl}/api/enterprise/llm-models`, { token });
  } catch {
    return [];
  }
}

/** The settings of the runtime: which model runs, and what it may do. */
export async function readRuntimeModelSettings(
  baseUrl: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await apiRequest(`${baseUrl}/api/enterprise/runtime-model-settings`, { token });
  } catch {
    return null;
  }
}

/** One part of the information of the organization. */
export interface EnterpriseInfo {
  name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  description?: string | null;
}

/** The information of the organization. */
export async function readEnterpriseInfo(
  baseUrl: string,
  token: string,
): Promise<EnterpriseInfo | null> {
  try {
    return await apiRequest<EnterpriseInfo>(`${baseUrl}/api/enterprise/info`, { token });
  } catch {
    return null;
  }
}

/** Change one part of the information of the organization. */
export async function updateEnterpriseInfo(
  baseUrl: string,
  token: string,
  infoType: string,
  value: unknown,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/enterprise/info/${infoType}`, {
    token,
    method: 'PUT',
    body: JSON.stringify(value),
  });
}

/** Every person of the organization, with the fields an administrator changes. */
export interface OrgPerson {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  tokens_used_today?: number;
  max_tokens_per_day?: number | null;
}

/** The people of the organization. */
export async function listOrgPeople(
  baseUrl: string,
  token: string,
): Promise<OrgPerson[]> {
  try {
    const answer = await apiRequest<OrgPerson[] | { items?: OrgPerson[] }>(
      `${baseUrl}/api/org/users`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Change one person of the organization. */
export async function updateOrgPerson(
  baseUrl: string,
  token: string,
  userId: string,
  patch: { display_name?: string; role?: string; is_active?: boolean },
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/org/users/${userId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** The people a group may take. */
export interface MemberCandidate {
  id: string;
  name: string;
  participant_type: 'human' | 'agent';
  role?: string | null;
}

/** The people a group may take. */
export async function listGroupCandidates(
  baseUrl: string,
  token: string,
  groupId?: string,
): Promise<MemberCandidate[]> {
  const path = groupId
    ? `/api/groups/${groupId}/member-candidates`
    : '/api/groups/member-candidates';
  try {
    const answer = await apiRequest<MemberCandidate[] | { items?: MemberCandidate[] }>(
      `${baseUrl}${path}`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The conversations of one assistant, with the messages they hold. */
export interface HistoryConversation {
  id: string;
  title?: string | null;
  message_count: number;
  last_message_at?: string | null;
}

/** The conversations of one assistant. */
export async function listConversations(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<HistoryConversation[]> {
  try {
    return await apiRequest<HistoryConversation[]>(
      `${baseUrl}/api/agents/${agentId}/chat-history/conversations`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The messages of one conversation. */
export async function listConversationMessages(
  baseUrl: string,
  token: string,
  agentId: string,
  conversationId: string,
): Promise<Array<{ id: string; role: string; content: string; created_at: string | null }>> {
  try {
    return await apiRequest(
      `${baseUrl}/api/agents/${agentId}/chat-history/${encodeURIComponent(conversationId)}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Give a task of one assistant to another. */
export async function delegateTask(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { to_agent_id: string; task: string; context?: string },
): Promise<{ delegation_id: string; message: string }> {
  return apiRequest(`${baseUrl}/api/agents/${agentId}/collaborate/delegate`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Send a message from one assistant to another. */
export async function collaborate(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { to_agent_id: string; message: string },
): Promise<{ message: string }> {
  return apiRequest(`${baseUrl}/api/agents/${agentId}/collaborate/message`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Hand the work of one assistant over to another. */
export async function handover(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { to_agent_id: string; reason?: string },
): Promise<{ message: string }> {
  return apiRequest(`${baseUrl}/api/agents/${agentId}/handover`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** The people one assistant may be given. */
export async function listPermissionCandidates(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<MemberCandidate[]> {
  try {
    return await apiRequest<MemberCandidate[]>(
      `${baseUrl}/api/agents/${agentId}/permissions/candidates`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The assistants one assistant knows. */
export async function listAgentCandidates(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<MemberCandidate[]> {
  try {
    return await apiRequest<MemberCandidate[]>(
      `${baseUrl}/api/agents/${agentId}/relationships/agents/candidates`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The people one assistant knows. */
export async function listMemberCandidates(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<MemberCandidate[]> {
  try {
    return await apiRequest<MemberCandidate[]>(
      `${baseUrl}/api/agents/${agentId}/relationships/member-candidates`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The files of the workspace of a group. */
export async function listGroupFiles(
  baseUrl: string,
  token: string,
  groupId: string,
): Promise<Array<{ path: string; size: number; updated_at: string | null }>> {
  try {
    const answer = await apiRequest<
      Array<{ path: string; size: number; updated_at: string | null }> | { files?: Array<{ path: string; size: number; updated_at: string | null }> }
    >(`${baseUrl}/api/groups/${groupId}/workspace`, { token });
    if (Array.isArray(answer)) return answer;
    return answer.files ?? [];
  } catch {
    return [];
  }
}

/** The tools that are installed on the assistants of the organization. */
export async function listInstalledTools(
  baseUrl: string,
  token: string,
): Promise<Array<{ id: string; tool_id: string; agent_id: string; name: string }>> {
  try {
    const answer = await apiRequest<
      Array<{ id: string; tool_id: string; agent_id: string; name: string }> | { items?: Array<{ id: string; tool_id: string; agent_id: string; name: string }> }
    >(`${baseUrl}/api/tools/agent-installed`, { token });
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The organizations of the platform. */
export async function listAllTenants(
  baseUrl: string,
  token: string,
): Promise<Array<{ id: string; name: string; slug: string; is_active: boolean }>> {
  try {
    return await apiRequest(`${baseUrl}/api/tenants`, { token });
  } catch {
    return [];
  }
}

/** Put one person into one organization. */
export async function assignPersonToTenant(
  baseUrl: string,
  token: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/tenants/${tenantId}/assign-user/${userId}`, {
    token,
    method: 'PUT',
  });
}

/** Whether an address is already taken. */
export async function checkDuplicate(
  baseUrl: string,
  token: string,
  input: { email?: string; username?: string },
): Promise<{ exists: boolean; field?: string }> {
  try {
    return await apiRequest(`${baseUrl}/api/auth/check-duplicate`, {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    return { exists: false };
  }
}

/** The way a person may create an account. */
export async function readRegistrationConfig(
  baseUrl: string,
  token: string | null,
): Promise<{ invitation_code_required: boolean; allowed_oauth_providers?: string[] } | null> {
  try {
    return await apiRequest(`${baseUrl}/api/auth/registration-config`, {
      ...(token ? { token } : {}),
    });
  } catch {
    return null;
  }
}

/** The first step of a registration. */
export async function registerInit(
  baseUrl: string,
  input: { email: string; username?: string; password: string },
): Promise<{ requires_verification: boolean; invitation_code?: string | null }> {
  return apiRequest(`${baseUrl}/api/auth/register/init`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** The pages of the server that a person may open. */
export async function listPages(
  baseUrl: string,
  token: string | null,
): Promise<Array<{ id: string; title: string; path: string; description?: string | null }>> {
  try {
    return await apiRequest(`${baseUrl}/api/pages/list`, {
      ...(token ? { token } : {}),
    });
  } catch {
    return [];
  }
}

/** Bind an outside identity to the account of the user. */
export async function bindIdentity(
  baseUrl: string,
  token: string,
  provider: string,
  code: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/auth/${provider}/bind`, {
    token,
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Let go of an outside identity. */
export async function unbindIdentity(
  baseUrl: string,
  token: string,
  provider: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/auth/${provider}/unbind`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** The outside identities the server knows. */
export async function listAuthProviders(
  baseUrl: string,
): Promise<Array<{ name: string; label: string; enabled: boolean }>> {
  try {
    return await apiRequest(`${baseUrl}/api/auth/providers`);
  } catch {
    return [];
  }
}

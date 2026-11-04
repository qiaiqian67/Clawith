import { apiRequest } from './http.ts';

/**
 * The organization of the user.
 *
 * The server owns the members, the models, and the invitation codes. The
 * client reads them and changes what the role of the user allows.
 */

/** One person of the organization. */
export interface OrgMember {
  id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  role: string;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

/** One model the organization may use. */
export interface LlmModel {
  id: string;
  provider: string;
  model: string;
  label: string;
  is_default: boolean;
  enabled: boolean;
  supports_vision: boolean;
  api_key_masked?: string | null;
  base_url?: string | null;
  max_tokens?: number | null;
}

/** One provider the server knows how to call. */
export interface LlmProvider {
  id: string;
  name: string;
  requires_api_key: boolean;
  supports_base_url: boolean;
  models: string[];
}

/** One invitation code. */
export interface InvitationCode {
  id: string;
  code: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  created_at: string | null;
}

/** The people of the organization. */
export async function listMembers(baseUrl: string, token: string): Promise<OrgMember[]> {
  try {
    const answer = await apiRequest<OrgMember[] | { items?: OrgMember[]; users?: OrgMember[] }>(
      `${baseUrl}/api/enterprise/org/members`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? answer.users ?? [];
  } catch {
    return [];
  }
}

/** The models of the organization. */
export async function listModels(baseUrl: string, token: string): Promise<LlmModel[]> {
  try {
    return await apiRequest<LlmModel[]>(`${baseUrl}/api/enterprise/llm-models`, { token });
  } catch {
    return [];
  }
}

/** The providers the server can call. */
export async function listProviders(baseUrl: string, token: string): Promise<LlmProvider[]> {
  try {
    return await apiRequest<LlmProvider[]>(`${baseUrl}/api/enterprise/llm-providers`, { token });
  } catch {
    return [];
  }
}

/** Add one model to the organization. */
export async function addModel(
  baseUrl: string,
  token: string,
  input: { provider: string; model: string; label: string; api_key: string; base_url?: string },
): Promise<LlmModel> {
  return apiRequest<LlmModel>(`${baseUrl}/api/enterprise/llm-models`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Remove one model. */
export async function removeModel(baseUrl: string, token: string, modelId: string): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/enterprise/llm-models/${modelId}`, {
    token,
    method: 'DELETE',
  });
}

/** Make one model the default of the organization. */
export async function setDefaultModel(
  baseUrl: string,
  token: string,
  modelId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/enterprise/llm-models/${modelId}/set-default`, {
    token,
    method: 'POST',
  });
}

/** The invitation codes of the organization. */
export async function listInvitationCodes(
  baseUrl: string,
  token: string,
): Promise<InvitationCode[]> {
  try {
    const answer = await apiRequest<{ items?: InvitationCode[] } | InvitationCode[]>(
      `${baseUrl}/api/enterprise/invitation-codes`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Create a batch of invitation codes. */
export async function createInvitationCodes(
  baseUrl: string,
  token: string,
  count: number,
  maxUses: number,
): Promise<InvitationCode[]> {
  return apiRequest<InvitationCode[]>(`${baseUrl}/api/enterprise/invitation-codes`, {
    token,
    method: 'POST',
    body: JSON.stringify({ count, max_uses: maxUses }),
  });
}

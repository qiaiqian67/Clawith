import { apiRequest } from './http.ts';

/**
 * The work of one Agent: its tasks, its people, its focus, and its directory.
 *
 * These are the surfaces that make an Agent a colleague and not a chat
 * window: what it is working on, who it knows, and what it keeps in view.
 */

/** One task of an Agent. */
export interface AgentTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** One person or Agent the Agent works with. */
export interface RelationshipEntry {
  id: string;
  participant_id: string;
  participant_type: string;
  display_name: string;
  role_description: string | null;
  note: string | null;
}

/** One item the Agent keeps in view. */
export interface FocusItem {
  key: string;
  title: string;
  status: string;
  due_at: string | null;
  created_at: string | null;
}

/** The tasks of one Agent. */
export async function listTasks(baseUrl: string, token: string, agentId: string): Promise<AgentTask[]> {
  try {
    return await apiRequest<AgentTask[]>(`${baseUrl}/api/agents/${agentId}/tasks/`, { token });
  } catch {
    return [];
  }
}

/** Write one task. */
export async function createTask(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { title: string; description?: string; priority?: string },
): Promise<AgentTask> {
  return apiRequest<AgentTask>(`${baseUrl}/api/agents/${agentId}/tasks/`, {
    token,
    method: 'POST',
    body: JSON.stringify({ ...input, status: 'pending' }),
  });
}

/** Change the status of one task. */
export async function updateTask(
  baseUrl: string,
  token: string,
  agentId: string,
  taskId: string,
  patch: { status?: string; title?: string },
): Promise<AgentTask> {
  return apiRequest<AgentTask>(`${baseUrl}/api/agents/${agentId}/tasks/${taskId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Run one task now. */
export async function triggerTask(
  baseUrl: string,
  token: string,
  agentId: string,
  taskId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/tasks/${taskId}/trigger`, {
    token,
    method: 'POST',
  });
}

/** The people an Agent works with. */
export async function listRelationships(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<RelationshipEntry[]> {
  try {
    const answer = await apiRequest<RelationshipEntry[] | { items?: RelationshipEntry[] }>(
      `${baseUrl}/api/agents/${agentId}/relationships/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The focus of one Agent. */
export async function listFocus(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<FocusItem[]> {
  try {
    const answer = await apiRequest<FocusItem[] | { items?: FocusItem[] }>(
      `${baseUrl}/api/agents/${agentId}/focus/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Close one focus item. */
export async function completeFocus(
  baseUrl: string,
  token: string,
  agentId: string,
  key: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/focus/${encodeURIComponent(key)}/complete`, {
    token,
    method: 'POST',
  });
}

/** What the Agent knows about the people of the organization. */
export interface DirectoryPerson {
  id: string;
  display_name: string;
  title: string | null;
  department: string | null;
  email: string | null;
}

/** The people in the directory of one Agent. */
export async function readDirectory(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<DirectoryPerson[]> {
  try {
    const answer = await apiRequest<
      | DirectoryPerson[]
      | { members?: DirectoryPerson[]; humans?: DirectoryPerson[]; items?: DirectoryPerson[] }
    >(`${baseUrl}/api/agents/${agentId}/directory`, { token });
    if (Array.isArray(answer)) return answer;
    // The directory answers with a page object under a name of its own.
    return answer.members ?? answer.humans ?? answer.items ?? [];
  } catch {
    return [];
  }
}

/** One credential an Agent holds for a service. */
export interface AgentCredential {
  id: string;
  name: string;
  kind: string | null;
  value_masked: string | null;
  created_at: string | null;
}

/** The credentials of one Agent. */
export async function listCredentials(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentCredential[]> {
  try {
    const answer = await apiRequest<AgentCredential[] | { items?: AgentCredential[] }>(
      `${baseUrl}/api/agents/${agentId}/credentials/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Add one credential to an Agent. */
export async function createCredential(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { name: string; value: string; kind?: string },
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/credentials/`, {
    token,
    method: 'POST',
    body: JSON.stringify({ name: input.name, value: input.value, kind: input.kind ?? 'api_key' }),
  });
}

/** Remove one credential. */
export async function deleteCredential(
  baseUrl: string,
  token: string,
  agentId: string,
  credentialId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/credentials/${credentialId}`, {
    token,
    method: 'DELETE',
  });
}

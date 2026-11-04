import { apiRequest } from './http.ts';

/**
 * The tools the assistants use.
 *
 * A tool is a thing an assistant can do: a search, a shell, a file system, an
 * MCP server. The server owns the tools and the keys; the client reads them
 * and turns one on for an assistant.
 */

/** One tool of the organization. */
export interface ToolSummary {
  id: string;
  name: string;
  display_name?: string | null;
  category: string;
  description?: string | null;
  source: string;
  is_enabled: boolean;
  requires_config?: boolean;
  config_schema?: Record<string, unknown> | null;
}

/** One tool of one assistant, with the keys it carries. */
export interface AgentTool {
  id: string;
  tool_id: string;
  name: string;
  display_name?: string | null;
  category: string;
  is_enabled: boolean;
  /** The keys of the tool, with the secrets masked by the server. */
  global_config: Record<string, unknown> | null;
  agent_config: Record<string, unknown> | null;
  config_schema?: Record<string, unknown> | null;
}

/** Every tool of the organization. */
export async function listTools(baseUrl: string, token: string): Promise<ToolSummary[]> {
  try {
    const answer = await apiRequest<ToolSummary[] | { items?: ToolSummary[] }>(
      `${baseUrl}/api/tools/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The tools of one assistant, with what each one carries. */
export async function listAgentTools(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentTool[]> {
  try {
    const answer = await apiRequest<AgentTool[] | { items?: AgentTool[] }>(
      `${baseUrl}/api/tools/agents/${agentId}/with-config`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Turn the tools of one assistant on or off, in one call. */
export async function updateAgentTools(
  baseUrl: string,
  token: string,
  agentId: string,
  toolIds: string[],
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/tools/agents/${agentId}`, {
    token,
    method: 'PUT',
    body: JSON.stringify({ tool_ids: toolIds }),
  });
}

/** The keys of one tool of one assistant. */
export async function updateAgentToolConfig(
  baseUrl: string,
  token: string,
  agentId: string,
  toolId: string,
  config: Record<string, unknown>,
): Promise<void> {
  await apiRequest<unknown>(
    `${baseUrl}/api/tools/agents/${agentId}/tool-config/${toolId}`,
    { token, method: 'PUT', body: JSON.stringify(config) },
  );
}

/** The test of an MCP server: the server calls it and answers. */
export async function testMcp(
  baseUrl: string,
  token: string,
  config: { server_url: string; headers?: Record<string, string> },
): Promise<{ ok: boolean; detail: string }> {
  try {
    const answer = await apiRequest<{ ok?: boolean; detail?: string; message?: string }>(
      `${baseUrl}/api/tools/test-mcp`,
      { token, method: 'POST', body: JSON.stringify(config) },
    );
    return { ok: answer.ok ?? true, detail: answer.detail ?? answer.message ?? '' };
  } catch (cause) {
    return { ok: false, detail: cause instanceof Error ? cause.message : 'unknown' };
  }
}

/** The email services the server knows how to send with. */
export async function listEmailProviders(
  baseUrl: string,
  token: string,
): Promise<Record<string, { label: string; help_url: string; help_text: string }>> {
  try {
    return await apiRequest(`${baseUrl}/api/tools/email-providers`, { token });
  } catch {
    return {};
  }
}

/** The test of an email service: the server sends one message and answers. */
export async function testEmail(
  baseUrl: string,
  token: string,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const answer = await apiRequest<{ ok?: boolean; detail?: string; message?: string }>(
      `${baseUrl}/api/tools/test-email`,
      { token, method: 'POST', body: JSON.stringify(config) },
    );
    return { ok: answer.ok ?? true, detail: answer.detail ?? answer.message ?? '' };
  } catch (cause) {
    return { ok: false, detail: cause instanceof Error ? cause.message : 'unknown' };
  }
}

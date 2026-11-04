import { apiRequest } from './http.ts';

/**
 * The administration of the platform.
 *
 * A platform administrator sees every company, the numbers of the platform,
 * and what the people did. A member sees none of it, and the server refuses
 * the calls, so the client hides the surface and not only the button.
 */

/** One company on the platform. */
export interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  user_count: number;
  agent_count: number;
  created_at: string | null;
}

/** The numbers of the platform. */
export interface PlatformMetrics {
  total_companies: number;
  total_users: number;
  total_agents: number;
  total_messages: number;
  active_today: number;
}

/** One line of the audit trail. */
export interface AuditLogEntry {
  id: string;
  action: string;
  actor_name: string | null;
  agent_name: string | null;
  detail: string | null;
  status: string | null;
  created_at: string | null;
}

/** Every company. */
export async function listCompanies(baseUrl: string, token: string): Promise<Company[]> {
  try {
    const answer = await apiRequest<Company[] | { items?: Company[]; companies?: Company[] }>(
      `${baseUrl}/api/admin/companies`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? answer.companies ?? [];
  } catch {
    return [];
  }
}

/** The numbers of the platform. */
export async function readPlatformMetrics(
  baseUrl: string,
  token: string,
): Promise<PlatformMetrics | null> {
  try {
    return await apiRequest<PlatformMetrics>(`${baseUrl}/api/admin/metrics/enhanced`, { token });
  } catch {
    return null;
  }
}

/** Turn one company on or off. */
export async function toggleCompany(
  baseUrl: string,
  token: string,
  companyId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/admin/companies/${companyId}/toggle`, {
    token,
    method: 'PUT',
  });
}

/** The audit trail of the organization. */
export async function listAuditLogs(
  baseUrl: string,
  token: string,
  limit = 50,
): Promise<AuditLogEntry[]> {
  try {
    const answer = await apiRequest<AuditLogEntry[] | { items?: AuditLogEntry[] }>(
      `${baseUrl}/api/enterprise/audit-logs?limit=${limit}`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

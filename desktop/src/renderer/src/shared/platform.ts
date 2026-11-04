import { apiRequest } from './http.ts';

/**
 * The platform, as an administrator sees it.
 *
 * The platform administrator sees every company, the numbers of the
 * platform, and the settings that decide who may create a company.
 */

/** One company on the platform. */
export interface PlatformCompany {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sso_enabled?: boolean;
  sso_domain?: string | null;
  created_at: string | null;
  user_count: number;
  agent_count: number;
  agent_running_count: number;
  total_tokens: number;
  cache_read_tokens_total?: number;
}

/** The numbers of the platform. */
export interface PlatformMetrics {
  avg_tokens_per_session_30d: number;
  retention_rate_7d: number;
  last_week_active_companies: number;
  retained_companies: number;
  channel_distribution: Record<string, number>;
  tool_category_top10: Array<{ category: string; count: number }>;
  churn_warnings: Array<{ name?: string; id?: string; reason?: string; days?: number }>;
}

/** The settings of the platform. */
export interface PlatformSettings {
  allow_self_create_company: boolean;
  invitation_code_enabled: boolean;
  sso_custom_domain_redirect_enabled: boolean;
}

/** The leaders of the platform. */
export interface PlatformLeaderboards {
  top_companies: Array<{ name: string; total_tokens: number }>;
  top_agents: Array<{ name: string; total_tokens: number }>;
}

/** Every company of the platform. */
export async function listPlatformCompanies(
  baseUrl: string,
  token: string,
): Promise<PlatformCompany[]> {
  try {
    const answer = await apiRequest<PlatformCompany[] | { items?: PlatformCompany[] }>(
      `${baseUrl}/api/admin/companies`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The numbers of the platform. */
export async function readEnhancedMetrics(
  baseUrl: string,
  token: string,
): Promise<PlatformMetrics | null> {
  try {
    return await apiRequest<PlatformMetrics>(`${baseUrl}/api/admin/metrics/enhanced`, { token });
  } catch {
    return null;
  }
}

/** The leaders of the platform. */
export async function readLeaderboards(
  baseUrl: string,
  token: string,
): Promise<PlatformLeaderboards | null> {
  try {
    return await apiRequest<PlatformLeaderboards>(`${baseUrl}/api/admin/metrics/leaderboards`, {
      token,
    });
  } catch {
    return null;
  }
}

/** The settings of the platform. */
export async function readPlatformSettings(
  baseUrl: string,
  token: string,
): Promise<PlatformSettings | null> {
  try {
    return await apiRequest<PlatformSettings>(`${baseUrl}/api/admin/platform-settings`, { token });
  } catch {
    return null;
  }
}

/** Change the settings of the platform. */
export async function updatePlatformSettings(
  baseUrl: string,
  token: string,
  patch: Partial<PlatformSettings>,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/admin/platform-settings`, {
    token,
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/** Turn one company on or off. */
export async function togglePlatformCompany(
  baseUrl: string,
  token: string,
  companyId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/admin/companies/${companyId}/toggle`, {
    token,
    method: 'PUT',
  });
}

import { apiRequest } from './http.ts';

/** One organization. */
export interface Tenant {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  role?: string | null;
  is_active?: boolean;
}

/**
 * The quota of the organization, and the switch between organizations.
 *
 * The organization has a limit of tokens a day. The rail shows the ring of
 * what is left, so a person sees the limit before the assistants hit it.
 */

/** The tokens of one window: today, the month, or all the time. */
export interface TokenBucket {
  total_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_hit_rate: number;
}

/** The quota of the organization. */
export interface TenantUsage {
  today: TokenBucket;
  month: TokenBucket;
  total: TokenBucket;
}

/** The quota of the organization. */
export async function readTenantUsage(
  baseUrl: string,
  token: string,
): Promise<TenantUsage | null> {
  try {
    return await apiRequest<TenantUsage>(`${baseUrl}/api/tenants/me/token-usage`, { token });
  } catch {
    return null;
  }
}

/** The limit of the organization of one person. */
export async function readMyQuota(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<{ max_tokens_per_day: number | null; tokens_used_today: number } | null> {
  try {
    return await apiRequest(`${baseUrl}/api/users/${userId}/quota`, { token });
  } catch {
    return null;
  }
}

/** The organizations the person is in. */
export async function listMyTenants(baseUrl: string, token: string): Promise<Tenant[]> {
  try {
    const answer = await apiRequest<Tenant[] | { items?: Tenant[]; tenants?: Tenant[] }>(
      `${baseUrl}/api/auth/my-tenants`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? answer.tenants ?? [];
  } catch {
    return [];
  }
}

/** The organization of the session. */
export async function readMyTenant(baseUrl: string, token: string): Promise<Tenant | null> {
  try {
    return await apiRequest<Tenant>(`${baseUrl}/api/tenants/me`, { token });
  } catch {
    return null;
  }
}

/** Move the session into another organization. */
export async function switchTenant(
  baseUrl: string,
  token: string,
  tenantId: string,
): Promise<{ access_token?: string; token?: string }> {
  return apiRequest(`${baseUrl}/api/auth/switch-tenant`, {
    token,
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId }),
  });
}

/**
 * How much of the day is left, as a fraction between 0 and 1.
 *
 * A ring draws what is left, so the number here is the share that remains.
 */
export function remainingShare(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - used / limit));
}

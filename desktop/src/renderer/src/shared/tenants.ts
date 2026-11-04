import { apiRequest } from './http.ts';

/**
 * The organizations a person belongs to, and the one they are in.
 *
 * A tenant is one organization. A person may be in more than one, and the
 * client changes which one they are in.
 */

/** One organization. */
export interface Tenant {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  role?: string | null;
  is_active?: boolean;
}

/** The organizations of the signed-in person. */
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

/** The organization the session is in. */
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
): Promise<{ access_token?: string; token?: string; user?: unknown }> {
  return apiRequest(`${baseUrl}/api/auth/switch-tenant`, {
    token,
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId }),
  });
}

/** The quota of every organization of the platform, for an administrator. */
export interface TenantQuota {
  tenant_id: string;
  tenant_name: string;
  max_tokens_per_day: number | null;
  max_tokens_per_month: number | null;
  used_today: number;
}

/** The quotas of the organizations. */
export async function listTenantQuotas(
  baseUrl: string,
  token: string,
): Promise<TenantQuota[]> {
  try {
    const answer = await apiRequest<TenantQuota[] | { items?: TenantQuota[] }>(
      `${baseUrl}/api/enterprise/tenant-quotas`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** Change the quota of one organization. */
export async function updateTenantQuotas(
  baseUrl: string,
  token: string,
  patch: Record<string, number | null>,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/enterprise/tenant-quotas`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

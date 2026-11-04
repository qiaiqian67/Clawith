import { apiRequest } from './http.ts';

/**
 * The people of the organization, as an administrator sees them.
 *
 * A role and a quota belong to a person in one organization, so the server
 * owns both and the client sends the change it wants.
 */

/** One person, with the facts an administrator changes. */
export interface ManagedUser {
  id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  role: string;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  max_tokens_per_day: number | null;
  max_tokens_per_month: number | null;
  tokens_used_today: number;
  created_at: string | null;
}

/** The roles the server knows. */
export type UserRole = 'member' | 'org_admin' | 'platform_admin';

/** Every person of the organization. */
export async function listManagedUsers(baseUrl: string, token: string): Promise<ManagedUser[]> {
  try {
    return await apiRequest<ManagedUser[]>(`${baseUrl}/api/users/`, { token });
  } catch {
    return [];
  }
}

/** Change the role of one person. */
export async function setUserRole(
  baseUrl: string,
  token: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/users/${userId}/role`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/** Change the token quota of one person. */
export async function setUserQuota(
  baseUrl: string,
  token: string,
  userId: string,
  quota: { max_tokens_per_day: number | null; max_tokens_per_month: number | null },
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/users/${userId}/quota`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(quota),
  });
}

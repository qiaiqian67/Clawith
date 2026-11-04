import { apiRequest } from './http.ts';

/**
 * The skills of the organization.
 *
 * A skill is a folder of instructions an Agent can read. The server owns the
 * skills; the client lists them.
 */

/** One skill of the organization. */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  folder_name: string | null;
  is_builtin: boolean;
  is_default: boolean;
  created_at: string | null;
}

/** The skills the organization can give an Agent. */
export async function listSkills(baseUrl: string, token: string): Promise<SkillSummary[]> {
  try {
    return await apiRequest<SkillSummary[]>(`${baseUrl}/api/skills/`, { token });
  } catch {
    return [];
  }
}

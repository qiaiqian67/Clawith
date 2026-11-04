import { apiRequest } from './http.ts';

/**
 * The skills of the organization, and the market they come from.
 *
 * A skill is a set of instructions an assistant follows. The market is where
 * the organization finds more of them.
 */

/** One skill. */
export interface SkillSummary {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  source: string;
  version?: string | null;
  is_enabled?: boolean;
}

/** One skill of the market. */
export interface MarketSkill {
  slug: string;
  displayName: string;
  description?: string | null;
  author?: string | null;
  version?: string | null;
  downloads?: number;
  tags?: string[];
}

/** Every skill of the organization. */
export async function listSkills(baseUrl: string, token: string): Promise<SkillSummary[]> {
  try {
    const answer = await apiRequest<SkillSummary[] | { items?: SkillSummary[] }>(
      `${baseUrl}/api/skills/`,
      { token },
    );
    if (Array.isArray(answer)) return answer;
    return answer.items ?? [];
  } catch {
    return [];
  }
}

/** The skills of the market that match a word. */
export async function searchMarket(
  baseUrl: string,
  token: string,
  query: string,
): Promise<MarketSkill[]> {
  try {
    return await apiRequest<MarketSkill[]>(
      `${baseUrl}/api/skills/clawhub/search?q=${encodeURIComponent(query)}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The detail of one skill of the market. */
export async function readMarketSkill(
  baseUrl: string,
  token: string,
  slug: string,
): Promise<MarketSkill | null> {
  try {
    return await apiRequest<MarketSkill>(
      `${baseUrl}/api/skills/clawhub/detail/${encodeURIComponent(slug)}`,
      { token },
    );
  } catch {
    return null;
  }
}

/** Put one skill of the market into the organization. */
export async function installMarketSkill(
  baseUrl: string,
  token: string,
  slug: string,
): Promise<SkillSummary> {
  return apiRequest<SkillSummary>(`${baseUrl}/api/skills/clawhub/install`, {
    token,
    method: 'POST',
    body: JSON.stringify({ slug }),
  });
}

/** The preview of a skill that comes from a link. */
export async function previewUrlSkill(
  baseUrl: string,
  token: string,
  url: string,
): Promise<{ name: string; description: string; content: string } | null> {
  try {
    return await apiRequest(`${baseUrl}/api/skills/import-from-url/preview`, {
      token,
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  } catch {
    return null;
  }
}

/** Put a skill that comes from a link into the organization. */
export async function importUrlSkill(
  baseUrl: string,
  token: string,
  url: string,
): Promise<SkillSummary> {
  return apiRequest<SkillSummary>(`${baseUrl}/api/skills/import-from-url`, {
    token,
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/** Write one skill. */
export async function createSkill(
  baseUrl: string,
  token: string,
  input: { name: string; description?: string; content: string; category?: string },
): Promise<SkillSummary> {
  return apiRequest<SkillSummary>(`${baseUrl}/api/skills/`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Change one skill. */
export async function updateSkill(
  baseUrl: string,
  token: string,
  skillId: string,
  patch: { name?: string; description?: string; content?: string },
): Promise<SkillSummary> {
  return apiRequest<SkillSummary>(`${baseUrl}/api/skills/${skillId}`, {
    token,
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/** Remove one skill. */
export async function removeSkill(
  baseUrl: string,
  token: string,
  skillId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/skills/${skillId}`, {
    token,
    method: 'DELETE',
  });
}

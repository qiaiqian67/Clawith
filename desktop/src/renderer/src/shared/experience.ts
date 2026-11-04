import { apiRequest } from './http.ts';

/**
 * The library of the organization: what was learned and what it is worth.
 *
 * An entry is one piece of experience. It is distilled from what happened,
 * reviewed, published, and later cited by the assistants that used it.
 */

/** One entry of the library. */
export interface ExperienceEntry {
  id: string;
  title: string;
  /** The lesson itself. */
  body: string;
  /** When it applies. */
  applicability: string;
  /** Where it came from: a session, a person, a document. */
  origin: string;
  status: string;
  tags: string[];
  visibility_scope: string;
  created_by: string;
  created_by_name?: string | null;
  origin_agent_id?: string | null;
  origin_agent_name?: string | null;
  draft_of_id?: string | null;
  retired_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Whether the caller may change this entry. */
  can_edit?: boolean;
  can_review?: boolean;
  can_retire?: boolean;
}

/** The numbers of the library. */
export interface LibraryStats {
  total: number;
  today: number;
  cited: number;
  top_contributors: Array<{ name: string; count: number }>;
}

/** The entries of the library. The older name is the one the agent panel uses. */
export const listExperience = listEntries;

/** The entries of the library. */
export async function listEntries(
  baseUrl: string,
  token: string,
  options: { view?: 'team' | 'mine' | 'all'; status?: string; tag?: string; q?: string } = {},
): Promise<ExperienceEntry[]> {
  const params = new URLSearchParams({ view: options.view ?? 'team', limit: '50', offset: '0' });
  if (options.status && options.status !== 'all') params.set('status', options.status);
  if (options.tag) params.set('tag', options.tag);
  if (options.q) params.set('q', options.q);
  try {
    return await apiRequest<ExperienceEntry[]>(
      `${baseUrl}/api/experience/entries?${params.toString()}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** The numbers of the library. */
export async function readLibraryStats(
  baseUrl: string,
  token: string,
): Promise<LibraryStats | null> {
  try {
    return await apiRequest<LibraryStats>(`${baseUrl}/api/experience/stats`, { token });
  } catch {
    return null;
  }
}

/** Distill what happened into a draft of an entry. */
export async function distillContent(
  baseUrl: string,
  token: string,
  input: { body: string; title?: string; origin?: string },
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/distill`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Write one entry from a piece of content. */
export async function createDraft(
  baseUrl: string,
  token: string,
  input: { title: string; body: string; applicability?: string; tags?: string[] },
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/drafts`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Change one entry. */
export async function updateEntry(
  baseUrl: string,
  token: string,
  entryId: string,
  patch: { title?: string; body?: string; applicability?: string; tags?: string[] },
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/entries/${entryId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Publish one entry, so the assistants may use it. */
export async function publishEntry(
  baseUrl: string,
  token: string,
  entryId: string,
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/entries/${entryId}/publish`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Retire one entry, so the assistants stop using it. */
export async function retireEntry(
  baseUrl: string,
  token: string,
  entryId: string,
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/entries/${entryId}/retire`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** The review of one entry: publish it, retire it, or ask for a change. */
export async function reviewEntry(
  baseUrl: string,
  token: string,
  entryId: string,
  decision: 'approve' | 'reject' | 'request_changes',
  note?: string,
): Promise<ExperienceEntry> {
  return apiRequest<ExperienceEntry>(`${baseUrl}/api/experience/entries/${entryId}/review`, {
    token,
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  });
}

/** Remove one entry. */
export async function removeEntry(
  baseUrl: string,
  token: string,
  entryId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/experience/entries/${entryId}`, {
    token,
    method: 'DELETE',
  });
}

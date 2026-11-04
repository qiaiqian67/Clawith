import { apiRequest } from './http.ts';

/**
 * The OKR of the organization.
 *
 * An objective names what the organization wants. A key result names how it
 * knows. The server owns both; the client reads the current period and moves
 * a key result forward.
 */

/** One key result of an objective. */
export interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string | null;
  status: string;
  last_updated_at: string;
  created_at: string;
}

/** One objective. */
export interface Objective {
  id: string;
  title: string;
  description: string | null;
  owner_type: string;
  owner_id: string | null;
  owner_name: string | null;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  key_results: KeyResult[];
}

/** The OKR of the period the organization is in. */
export async function listObjectives(baseUrl: string, token: string): Promise<Objective[]> {
  try {
    return await apiRequest<Objective[]>(`${baseUrl}/api/okr/objectives`, { token });
  } catch {
    return [];
  }
}

/** Write one objective. */
export async function createObjective(
  baseUrl: string,
  token: string,
  input: { title: string; description?: string; period_start: string; period_end: string },
): Promise<Objective> {
  return apiRequest<Objective>(`${baseUrl}/api/okr/objectives`, {
    token,
    method: 'POST',
    body: JSON.stringify({ ...input, owner_type: 'company', owner_id: null }),
  });
}

/** Remove one objective. */
export async function deleteObjective(
  baseUrl: string,
  token: string,
  objectiveId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/okr/objectives/${objectiveId}`, {
    token,
    method: 'DELETE',
  });
}

/** Move one key result forward. */
export async function updateKeyResultProgress(
  baseUrl: string,
  token: string,
  keyResultId: string,
  currentValue: number,
): Promise<KeyResult> {
  return apiRequest<KeyResult>(`${baseUrl}/api/okr/key-results/${keyResultId}/progress`, {
    token,
    method: 'POST',
    body: JSON.stringify({ value: currentValue }),
  });
}

/** Change the title or the status of one objective. */
export async function updateObjective(
  baseUrl: string,
  token: string,
  objectiveId: string,
  patch: { title?: string; description?: string; status?: string },
): Promise<Objective> {
  return apiRequest<Objective>(`${baseUrl}/api/okr/objectives/${objectiveId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Change one key result. */
export async function updateKeyResult(
  baseUrl: string,
  token: string,
  keyResultId: string,
  patch: { title?: string; target_value?: number; current_value?: number; unit?: string; status?: string },
): Promise<KeyResult> {
  return apiRequest<KeyResult>(`${baseUrl}/api/okr/key-results/${keyResultId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** The span of the period the organization is in. */
export function progressOf(keyResult: KeyResult): number {
  if (!keyResult.target_value) return 0;
  return Math.max(0, Math.min(1, keyResult.current_value / keyResult.target_value));
}

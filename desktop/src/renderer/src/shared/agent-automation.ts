import { apiRequest } from './http.ts';

/**
 * The triggers and the schedules of one Agent.
 *
 * A trigger wakes an Agent when a time or an event condition is met. A
 * schedule runs an instruction on a cron expression. The server owns both.
 */

/** One trigger of an Agent. */
export interface AgentTrigger {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  reason: string;
  is_enabled: boolean;
  is_system: boolean;
  fire_count: number;
  max_fires: number | null;
  cooldown_seconds: number;
  last_fired_at: string | null;
  expires_at: string | null;
}

/** One schedule of an Agent. */
export interface AgentSchedule {
  id: string;
  agent_id: string;
  name: string;
  instruction: string;
  cron_expr: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
}

/** The triggers of one Agent. */
export async function listTriggers(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentTrigger[]> {
  try {
    return await apiRequest<AgentTrigger[]>(`${baseUrl}/api/agents/${agentId}/triggers`, { token });
  } catch {
    return [];
  }
}

/** Turn one trigger on or off. */
export async function setTriggerEnabled(
  baseUrl: string,
  token: string,
  agentId: string,
  triggerId: string,
  enabled: boolean,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/triggers/${triggerId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ is_enabled: enabled }),
  });
}

/** Remove one trigger. */
export async function deleteTrigger(
  baseUrl: string,
  token: string,
  agentId: string,
  triggerId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/triggers/${triggerId}`, {
    token,
    method: 'DELETE',
  });
}

/** The schedules of one Agent. */
export async function listSchedules(
  baseUrl: string,
  token: string,
  agentId: string,
): Promise<AgentSchedule[]> {
  try {
    return await apiRequest<AgentSchedule[]>(`${baseUrl}/api/agents/${agentId}/schedules/`, {
      token,
    });
  } catch {
    return [];
  }
}

/** Create one schedule of an Agent. */
export async function createSchedule(
  baseUrl: string,
  token: string,
  agentId: string,
  input: { name: string; instruction: string; cron_expr: string },
): Promise<AgentSchedule> {
  return apiRequest<AgentSchedule>(`${baseUrl}/api/agents/${agentId}/schedules/`, {
    token,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Turn one schedule on or off. */
export async function setScheduleEnabled(
  baseUrl: string,
  token: string,
  agentId: string,
  scheduleId: string,
  enabled: boolean,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/schedules/${scheduleId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ is_enabled: enabled }),
  });
}

/** Remove one schedule. */
export async function deleteSchedule(
  baseUrl: string,
  token: string,
  agentId: string,
  scheduleId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/schedules/${scheduleId}`, {
    token,
    method: 'DELETE',
  });
}

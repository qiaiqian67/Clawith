import { apiRequest } from './http.ts';

/**
 * The approvals of one Agent.
 *
 * An Agent asks for a person's decision before it does something that
 * matters. The server owns the request; the client shows it and sends the
 * answer.
 */

/** One approval the Agent is waiting for. */
export interface ApprovalRequest {
  id: string;
  agent_id: string;
  action_type: string;
  details: string;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
}

/** The approvals of one Agent. */
export async function listApprovals(
  baseUrl: string,
  token: string,
  agentId: string,
  status: 'pending' | 'approved' | 'rejected' | null = 'pending',
): Promise<ApprovalRequest[]> {
  const query = status ? `?status_filter=${status}` : '';
  try {
    return await apiRequest<ApprovalRequest[]>(
      `${baseUrl}/api/agents/${agentId}/approvals${query}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Answer one approval. */
export async function resolveApproval(
  baseUrl: string,
  token: string,
  agentId: string,
  approvalId: string,
  action: 'approve' | 'reject',
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/approvals/${approvalId}/resolve`, {
    token,
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

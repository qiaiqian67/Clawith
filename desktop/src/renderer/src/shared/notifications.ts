import { apiRequest } from './http.ts';

/**
 * The notices of the user.
 *
 * The server files a notice when something happened that the user should
 * know: an approval is waiting, someone liked a post, an Agent reported back.
 */

/** One notice. */
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

/** The notices of the user, newest first. */
export async function listNotifications(
  baseUrl: string,
  token: string,
  options: { limit?: number; unreadOnly?: boolean; category?: string } = {},
): Promise<Notification[]> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    offset: '0',
  });
  if (options.unreadOnly) params.set('unread_only', 'true');
  if (options.category && options.category !== 'all') params.set('category', options.category);
  try {
    return await apiRequest<Notification[]>(
      `${baseUrl}/api/notifications?${params.toString()}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** How many notices the user has not read. */
export async function unreadCount(baseUrl: string, token: string): Promise<number> {
  try {
    const answer = await apiRequest<{ unread_count?: number; count?: number }>(
      `${baseUrl}/api/notifications/unread-count`,
      { token },
    );
    return answer.unread_count ?? answer.count ?? 0;
  } catch {
    return 0;
  }
}

/** Mark one notice as read. */
export async function markRead(baseUrl: string, token: string, id: string): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/notifications/${id}/read`, { token, method: 'POST' });
}

/** Mark every notice as read. */
export async function markAllRead(baseUrl: string, token: string): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/notifications/read-all`, { token, method: 'POST' });
}

/** One message an agent sent to another agent of the user. */
export interface InboxMessage {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  peer_agent_name: string | null;
  session_id: string | null;
  content: string;
  created_at: string | null;
}

/** The messages between the agents the user manages. */
export async function readInbox(baseUrl: string, token: string, limit = 50): Promise<InboxMessage[]> {
  try {
    return await apiRequest<InboxMessage[]>(`${baseUrl}/api/messages/inbox?limit=${limit}`, { token });
  } catch {
    return [];
  }
}

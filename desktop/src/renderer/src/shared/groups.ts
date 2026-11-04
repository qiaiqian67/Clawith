import { apiRequest } from './http.ts';

/**
 * The groups of the platform.
 *
 * A group is a shared conversation of people and Agents. The server owns the
 * groups, the sessions, and the messages; the client reads them and sends a
 * message.
 */


/** One group of the organization. */
export interface Group {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_by_participant_id: string;
  created_at: string;
  updated_at: string;
}

/** One session of a group. */
export interface GroupSession {
  id: string;
  group_id: string;
  title: string;
  is_primary: boolean;
  unread_count: number;
  created_by_participant_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

/** One member of a group. */
export interface GroupMember {
  id: string;
  participant_id: string;
  participant_type: string;
  participant_ref_id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  role_description: string | null;
  title: string | null;
  is_deleted: boolean;
  joined_at: string;
}

/** One message of a group session. */
export interface GroupMessage {
  id: string;
  role: string;
  content: string;
  participant_id: string | null;
  sender_name: string | null;
  mentions: Array<Record<string, unknown>>;
  created_at: string;
  cursor: string;
}

/** The answer of a sent group message. */
export interface GroupMessageIntake {
  message: GroupMessage;
  dispatch_kind: string;
  run_ids: string[];
  created: boolean;
  error_code: string | null;
  error: unknown;
}

/** The groups the signed-in user belongs to. */
export async function listGroups(baseUrl: string, token: string): Promise<Group[]> {
  try {
    return await apiRequest<Group[]>(`${baseUrl}/api/groups/`, { token });
  } catch {
    return [];
  }
}

/** The sessions of one group. */
export async function listGroupSessions(
  baseUrl: string,
  token: string,
  groupId: string,
): Promise<GroupSession[]> {
  try {
    return await apiRequest<GroupSession[]>(`${baseUrl}/api/groups/${groupId}/sessions`, { token });
  } catch {
    return [];
  }
}

/** The members of one group. */
export async function listGroupMembers(
  baseUrl: string,
  token: string,
  groupId: string,
): Promise<GroupMember[]> {
  try {
    return await apiRequest<GroupMember[]>(`${baseUrl}/api/groups/${groupId}/members`, { token });
  } catch {
    return [];
  }
}

/** The messages of one group session, oldest first. */
export async function listGroupMessages(
  baseUrl: string,
  token: string,
  groupId: string,
  sessionId: string,
  limit = 50,
): Promise<GroupMessage[]> {
  try {
    return await apiRequest<GroupMessage[]>(
      `${baseUrl}/api/groups/${groupId}/sessions/${sessionId}/messages?limit=${limit}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Send a message to one group session. */
export async function sendGroupMessage(
  baseUrl: string,
  token: string,
  groupId: string,
  sessionId: string,
  content: string,
  mentions: Array<{ participant_id: string }> = [],
): Promise<GroupMessageIntake> {
  return apiRequest<GroupMessageIntake>(
    `${baseUrl}/api/groups/${groupId}/sessions/${sessionId}/messages`,
    { token, method: 'POST', body: JSON.stringify({ content, mentions }) },
  );
}

/** One person or Agent who may join a group. */
export interface GroupMemberCandidate {
  participant_id: string;
  participant_type: 'user' | 'agent';
  participant_ref_id: string;
  display_name: string;
  avatar_url: string | null;
  role_description: string | null;
  title: string | null;
}

/** The people and Agents who may join a group of this organization. */
export async function listMemberCandidates(
  baseUrl: string,
  token: string,
  participantType: 'user' | 'agent',
  limit = 100,
): Promise<GroupMemberCandidate[]> {
  try {
    return await apiRequest<GroupMemberCandidate[]>(
      `${baseUrl}/api/groups/member-candidates?participant_type=${participantType}&limit=${limit}`,
      { token },
    );
  } catch {
    return [];
  }
}

/** Create a group with the given members. */
export async function createGroup(
  baseUrl: string,
  token: string,
  input: { name: string; description?: string; memberParticipantIds: string[] },
): Promise<Group> {
  return apiRequest<Group>(`${baseUrl}/api/groups/`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
      member_participant_ids: input.memberParticipantIds,
    }),
  });
}

/** Invite one person or Agent into a group. */
export async function inviteGroupMember(
  baseUrl: string,
  token: string,
  groupId: string,
  participantId: string,
): Promise<GroupMember[]> {
  return apiRequest<GroupMember[]>(`${baseUrl}/api/groups/${groupId}/members`, {
    token,
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId }),
  });
}

/** Remove one member from a group. */
export async function removeGroupMember(
  baseUrl: string,
  token: string,
  groupId: string,
  memberId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/groups/${groupId}/members/${memberId}`, {
    token,
    method: 'DELETE',
  });
}

/** Start a new session of a group. */
export async function createGroupSession(
  baseUrl: string,
  token: string,
  groupId: string,
  title?: string,
): Promise<GroupSession> {
  return apiRequest<GroupSession>(`${baseUrl}/api/groups/${groupId}/sessions`, {
    token,
    method: 'POST',
    body: JSON.stringify(title ? { title } : {}),
  });
}

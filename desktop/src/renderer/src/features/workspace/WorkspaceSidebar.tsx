import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Group } from '../../shared/groups.ts';

/**
 * The list of the conversations: the assistants, their sessions, and the
 * groups of the organization.
 *
 * The list is one column of the card, and the card is the whole page, so the
 * list carries no background of its own.
 */

export interface SidebarAgent {
  id: string;
  name: string;
  role_description?: string | null;
  status?: string | null;
  avatar_url?: string | null;
}

export interface WorkspaceSession {
  id: string;
  title: string | null;
  unread_count: number;
  is_primary: boolean;
}

export interface WorkspaceSidebarProps {
  agents: SidebarAgent[];
  /** The agent whose chat is open. */
  activeAgentId: string | null;
  /** The sessions of the active agent. */
  sessions: WorkspaceSession[];
  /** The session whose messages are shown. */
  activeSessionId: string | null;
  /** The failure of the last session action, when there was one. */
  sessionError?: string | null;
  onSelectAgent: (agentId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCreateAgent: () => void;
  /** Start a new session of the active agent. */
  onCreateSession?: () => void;
  /** The name of the organization on this server. */
  serverName: string;
  /** The groups of the organization. */
  groups?: Group[];
  /** The group whose conversation is shown. */
  activeGroupId?: string | null;
  onSelectGroup?: (groupId: string) => void;
  /** Open the dialog that creates a group. */
  onCreateGroup?: () => void;
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return props.agents;
    return props.agents.filter((agent) => agent.name.toLowerCase().includes(needle));
  }, [props.agents, query]);

  const running = props.agents.filter((agent) => agent.status === 'running').length;

  return (
    <aside className="zx-sidebar" aria-label={t('workspace.search')}>
      <div className="zx-sidebar-search-wrap">
        <div className="zx-sidebar-search-field">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            className="zx-sidebar-search"
            type="search"
            placeholder={t('workspace.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <nav className="zx-sidebar-list">
        <button type="button" className="zx-sidebar-create" onClick={props.onCreateAgent}>
          <span className="zx-sidebar-create-mark" aria-hidden="true" />
          {t('workspace.newAgent')}
        </button>

        {visible.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className="zx-sidebar-agent"
            data-active={agent.id === props.activeAgentId ? 'true' : undefined}
            onClick={() => props.onSelectAgent(agent.id)}
          >
            <span className="zx-sidebar-avatar" aria-hidden="true">
              {agent.avatar_url ? (
                <img className="zx-sidebar-avatar-image" src={agent.avatar_url} alt="" />
              ) : (
                agent.name.slice(0, 1)
              )}
            </span>
            <span className="zx-sidebar-agent-text">
              <strong>{agent.name}</strong>
              {agent.role_description ? <small>{agent.role_description}</small> : null}
            </span>
            {agent.status === 'running' ? <span className="zx-sidebar-status" aria-hidden="true" /> : null}
          </button>
        ))}

        {props.onCreateGroup || (props.groups && props.groups.length > 0) ? (
          <div className="zx-sidebar-sessions">
            <h2 className="zx-sidebar-sessions-title">{t('group.title')}</h2>
            {props.onCreateGroup ? (
              <button type="button" className="zx-sidebar-new-session" onClick={props.onCreateGroup}>
                + {t('group.createTitle')}
              </button>
            ) : null}
            {(props.groups ?? []).map((group) => (
              <button
                key={group.id}
                type="button"
                className="zx-sidebar-session"
                data-active={group.id === props.activeGroupId ? 'true' : undefined}
                onClick={() => props.onSelectGroup?.(group.id)}
              >
                <span className="zx-sidebar-session-text">{group.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {props.sessions.length > 0 || props.onCreateSession ? (
          <div className="zx-sidebar-sessions">
            <h2 className="zx-sidebar-sessions-title">{t('chat.sessions')}</h2>
            {props.onCreateSession ? (
              <button type="button" className="zx-sidebar-new-session" onClick={props.onCreateSession}>
                + {t('chat.newSession')}
              </button>
            ) : null}
            {props.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className="zx-sidebar-session"
                data-active={session.id === props.activeSessionId ? 'true' : undefined}
                onClick={() => props.onSelectSession(session.id)}
              >
                <span className="zx-sidebar-session-text">
                  {session.title ?? t('chat.session')}
                </span>
                {session.unread_count > 0 ? (
                  <span className="zx-sidebar-session-unread">{session.unread_count}</span>
                ) : null}
              </button>
            ))}
            {props.sessionError ? (
              <p className="zx-sidebar-session-error">{props.sessionError}</p>
            ) : null}
          </div>
        ) : null}
      </nav>

      <footer className="zx-sidebar-foot">
        <span className="zx-sidebar-foot-dot" aria-hidden="true" />
        <span className="zx-sidebar-foot-text">
          {t('workspace.working', { count: running })}
        </span>
      </footer>
    </aside>
  );
}

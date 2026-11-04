import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listNotifications,
  markAllRead,
  markRead,
  readInbox,
  unreadCount,
  type InboxMessage,
  type Notification,
} from '../../shared/notifications.ts';
import './messages.css';

/**
 * The notices of the user, and the messages between their agents.
 *
 * A notice is something the server wants the user to know; a message is what
 * one agent said to another. Both live here so the client has one place that
 * answers "what happened".
 */

export interface MessagesPanelProps {
  baseUrl: string;
  token: string | null;
  /** Be told how many notices are unread, for the rail badge. */
  onUnread: (count: number) => void;
}

type Tab = 'notices' | 'agents';

export function MessagesPanel(props: MessagesPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('notices');
  const [notices, setNotices] = useState<Notification[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    if (!props.token) return;
    const [list, count, messages] = await Promise.all([
      listNotifications(props.baseUrl, props.token, { category }),
      unreadCount(props.baseUrl, props.token),
      readInbox(props.baseUrl, props.token),
    ]);
    setNotices(list);
    setInbox(messages);
    props.onUnread(count);
    setLoading(false);
  }, [category, props]);

  useEffect(() => {
    // The list arrives from the server, so the state changes when the answer
    // does and not while the effect runs.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openNotice = useCallback(
    async (notice: Notification) => {
      if (!props.token || notice.is_read) return;
      await markRead(props.baseUrl, props.token, notice.id);
      setNotices((current) =>
        current.map((item) => (item.id === notice.id ? { ...item, is_read: true } : item)),
      );
      const count = await unreadCount(props.baseUrl, props.token);
      props.onUnread(count);
    },
    [props],
  );

  const readAll = useCallback(async () => {
    if (!props.token) return;
    await markAllRead(props.baseUrl, props.token);
    setNotices((current) => current.map((item) => ({ ...item, is_read: true })));
    props.onUnread(0);
  }, [props]);

  const categories = [
    { id: 'all', label: t('messages.all') },
    { id: 'approval', label: t('messages.approval') },
    { id: 'social', label: t('messages.social') },
    { id: 'tool', label: t('messages.tool') },
    { id: 'broadcast', label: t('messages.broadcast') },
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
      <header className="zx-view-head">
        <div>
          <h1 className="zx-view-title">{t('messages.title')}</h1>
          <p className="zx-view-subtitle">{t('messages.subtitle')}</p>
        </div>
        <button type="button" className="zx-button-ghost" onClick={() => void readAll()}>
          {t('messages.readAll')}
        </button>
      </header>

      <div className="zx-page-tabs">
        <button
          type="button"
          className="zx-page-tab"
          data-active={tab === 'notices' ? 'true' : undefined}
          onClick={() => setTab('notices')}
        >
          {t('messages.notices')}
        </button>
        <button
          type="button"
          className="zx-page-tab"
          data-active={tab === 'agents' ? 'true' : undefined}
          onClick={() => setTab('agents')}
        >
          {t('messages.agentMessages')}
        </button>
      </div>

      <div className="zx-view-body">
        {tab === 'notices' ? (
          <>
            <div className="zx-messages-filters">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="zx-messages-filter"
                  data-active={category === item.id ? 'true' : undefined}
                  onClick={() => setCategory(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {loading ? (
              <p className="zx-view-empty">{t('common.loading')}</p>
            ) : notices.length === 0 ? (
              <p className="zx-view-empty">{t('messages.empty')}</p>
            ) : (
              <ul className="zx-notice-list">
                {notices.map((notice) => (
                  <li key={notice.id}>
                    <button
                      type="button"
                      className="zx-notice"
                      data-unread={notice.is_read ? undefined : 'true'}
                      onClick={() => void openNotice(notice)}
                    >
                      <span className="zx-notice-dot" aria-hidden="true" />
                      <span className="zx-notice-text">
                        <strong>{notice.title}</strong>
                        <small>{notice.body}</small>
                      </span>
                      <span className="zx-notice-time">{formatTime(notice.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : inbox.length === 0 ? (
          <p className="zx-view-empty">{t('messages.noAgentMessages')}</p>
        ) : (
          <ul className="zx-notice-list">
            {inbox.map((message) => (
              <li key={message.id} className="zx-notice zx-notice-static">
                <span className="zx-notice-text">
                  <strong>
                    {message.agent_name ?? t('messages.agent')}
                    {message.peer_agent_name ? ` → ${message.peer_agent_name}` : ''}
                  </strong>
                  <small>{message.content}</small>
                </span>
                <span className="zx-notice-time">{formatTime(message.created_at ?? '')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

function formatTime(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return date.toLocaleDateString();
}

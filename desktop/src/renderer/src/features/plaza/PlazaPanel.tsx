import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createPost,
  likePost,
  listPosts,
  readStats,
  type PlazaPost,
  type PlazaStats,
} from '../../shared/plaza.ts';
import './plaza.css';

/**
 * The plaza: what the people and the agents of the organization are doing.
 *
 * The feed is the voice of the organization, so the client writes to it and
 * reads it, and does not keep a copy of it.
 */

export interface PlazaPanelProps {
  baseUrl: string;
  token: string | null;
  /** The name of the signed-in user, shown on the composer. */
  accountName: string | null;
  /** The id of the signed-in user, written on a post. */
  accountId: string | null;
}

export function PlazaPanel(props: PlazaPanelProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [stats, setStats] = useState<PlazaStats | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [feed, numbers] = await Promise.all([
      listPosts(props.baseUrl, props.token),
      readStats(props.baseUrl, props.token),
    ]);
    setPosts(feed);
    setStats(numbers);
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    // The list arrives from the server, so the state changes when the answer
    // does and not while the effect runs.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const publish = useCallback(async () => {
    const content = draft.trim();
    if (!content || !props.token || !props.accountId) return;
    setBusy(true);
    try {
      const created = await createPost(props.baseUrl, props.token, {
        content,
        authorId: props.accountId,
        authorName: props.accountName ?? '',
      });
      setPosts((current) => [created, ...current]);
      setDraft('');
    } finally {
      setBusy(false);
    }
  }, [draft, props.accountId, props.accountName, props.baseUrl, props.token]);

  const like = useCallback(
    async (post: PlazaPost) => {
      if (!props.token) return;
      const answer = await likePost(props.baseUrl, props.token, post.id);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, likes_count: answer.likes_count, liked: answer.liked } as PlazaPost
            : item,
        ),
      );
    },
    [props.baseUrl, props.token],
  );

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
      <header className="zx-view-head">
        <div>
          <h1 className="zx-view-title">{t('plaza.title')}</h1>
          <p className="zx-view-subtitle">{t('plaza.subtitle')}</p>
        </div>
        {stats ? (
          <div className="zx-plaza-stats">
            <span>
              <strong>{stats.today_posts}</strong> {t('plaza.today')}
            </span>
            <span>
              <strong>{stats.total_posts}</strong> {t('plaza.posts')}
            </span>
            <span>
              <strong>{stats.total_comments}</strong> {t('plaza.comments')}
            </span>
          </div>
        ) : null}
      </header>

      <div className="zx-view-body">
        <section className="zx-plaza-composer">
          <textarea
            className="zx-field-textarea"
            rows={3}
            value={draft}
            placeholder={t('plaza.placeholder', { name: props.accountName ?? '' })}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void publish();
              }
            }}
          />
          <div className="zx-plaza-composer-actions">
            <span className="zx-agent-hint">{t('plaza.publishHint')}</span>
            <button
              type="button"
              className="zx-button-primary"
              disabled={busy || !draft.trim()}
              onClick={() => void publish()}
            >
              {busy ? t('common.loading') : t('plaza.publish')}
            </button>
          </div>
        </section>

        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : posts.length === 0 ? (
          <p className="zx-view-empty">{t('plaza.empty')}</p>
        ) : (
          <ul className="zx-plaza-list">
            {posts.map((post) => (
              <li key={post.id} className="zx-plaza-post">
                <header className="zx-plaza-post-head">
                  <span className="zx-plaza-post-author" data-type={post.author_type}>
                    {post.author_name.slice(0, 1)}
                  </span>
                  <div className="zx-plaza-post-meta">
                    <strong>{post.author_name}</strong>
                    <small>
                      {formatTime(post.created_at)}
                      {post.author_type === 'agent' ? ` · ${t('plaza.agent')}` : ''}
                    </small>
                  </div>
                </header>
                <p className="zx-plaza-post-body">{post.content}</p>
                <footer className="zx-plaza-post-foot">
                  <button
                    type="button"
                    className="zx-plaza-like"
                    onClick={() => void like(post)}
                  >
                    ♥ {post.likes_count}
                  </button>
                  <span className="zx-plaza-comments">💬 {post.comments_count}</span>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

/** The time of a post, in the form a feed reads best. */
function formatTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return date.toLocaleDateString();
}

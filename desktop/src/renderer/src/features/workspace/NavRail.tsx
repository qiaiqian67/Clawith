import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import './nav-rail.css';

/**
 * The one rail of the client.
 *
 * The rail is the whole map: the organization at the top, the views in the
 * middle, and the account at the foot. One rail and one card, because a
 * second column of icons takes the room the work needs.
 */

/** The views of the client. */
export type WorkspaceView =
  | 'workbench'
  | 'agents'
  | 'messages'
  | 'tasks'
  | 'triggers'
  | 'plaza'
  | 'okr'
  | 'library'
  | 'marketplace'
  | 'enterprise'
  | 'admin';

export interface NavRailProps {
  view: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
  /** How many notices are unread. */
  unread: number;
  /** Whether the user may see the administration. */
  showAdmin: boolean;
  /** The servers the client knows, for the switch at the top. */
  servers: Array<{ id: string; name: string; url: string }>;
  activeServerId: string | null;
  onSelectServer: (serverId: string) => void;
  /** The name of the signed-in user. */
  accountName: string | null;
  /** The address of the client, for the version line. */
  appVersion: string;
  /** The appearance the user chose, and the one they may choose. */
  appearance: 'dark' | 'light' | 'system';
  onAppearance: (appearance: 'dark' | 'light' | 'system') => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: React.ReactNode;
  dot?: boolean;
}

const ICON = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export function NavRail(props: NavRailProps) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<'none' | 'servers' | 'account'>('none');

  const items: NavItem[] = [
    { id: 'workbench', label: t('nav.workbench'), icon: ICON(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="4" rx="1.5" /><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /></>) },
    { id: 'agents', label: t('nav.agents'), icon: ICON(<><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3.5v3.5M9 13h.01M15 13h.01M4 12h16" /></>) },
    { id: 'messages', label: t('nav.messages'), icon: ICON(<><path d="M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 2-2z" /></>), dot: true },
    { id: 'tasks', label: t('nav.tasks'), icon: ICON(<><path d="M9 5h10M9 12h10M9 19h10" /><path d="M4 5l1.2 1.2L7.5 4M4 12l1.2 1.2L7.5 11M4 19l1.2 1.2L7.5 18" /></>) },
    { id: 'triggers', label: t('nav.triggers'), icon: ICON(<><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></>) },
    { id: 'plaza', label: t('nav.plaza'), icon: ICON(<><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.4 2.5 2.4 12.5 0 16M12 4c-2.4 2.5-2.4 12.5 0 16" /></>) },
    { id: 'okr', label: t('nav.okr'), icon: ICON(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>) },
    { id: 'library', label: t('nav.library'), icon: ICON(<><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" /></>) },
    { id: 'marketplace', label: t('nav.marketplace'), icon: ICON(<><path d="M4 8.5h16l-1.2 10a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" /><path d="M8.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" /></>) },
    { id: 'enterprise', label: t('nav.enterprise'), icon: ICON(<><path d="M4 20V7l8-3 8 3v13M4 20h16M9 20v-5h6v5" /></>) },
    ...(props.showAdmin
      ? [{ id: 'admin' as WorkspaceView, label: t('nav.admin'), icon: ICON(<><path d="M12 3l7 3v5c0 4.4-2.9 8.2-7 9.5C7.9 19.2 5 15.4 5 11V6z" /><path d="M9.5 11.5l1.8 1.8 3.4-3.6" /></>) }]
      : []),
  ];

  const active = props.servers.find((server) => server.id === props.activeServerId);

  return (
    <div className="zx-rail">
      <div className="zx-rail-top">
        <button
          type="button"
          className="zx-rail-org"
          aria-label={t('nav.switchServer')}
          title={active?.name ?? t('nav.switchServer')}
          onClick={() => setMenu((current) => (current === 'servers' ? 'none' : 'servers'))}
        >
          {(active?.name ?? 'Z').slice(0, 1).toUpperCase()}
          <span className="zx-rail-org-caret" aria-hidden="true" />
        </button>
        {menu === 'servers' ? (
          <>
            <button type="button" className="zx-rail-scrim" aria-label={t('common.close')} onClick={() => setMenu('none')} />
            <div className="zx-rail-menu zx-rail-menu-top" role="menu">
              <span className="zx-rail-menu-label">{t('nav.switchServer')}</span>
              {props.servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  className="zx-rail-menu-item"
                  data-active={server.id === props.activeServerId ? 'true' : undefined}
                  onClick={() => {
                    props.onSelectServer(server.id);
                    setMenu('none');
                  }}
                >
                  <span className="zx-rail-menu-mark">{(server.name || 'Z').slice(0, 1).toUpperCase()}</span>
                  <span className="zx-rail-menu-text">
                    <strong>{server.name}</strong>
                    <small>{server.url}</small>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <nav className="zx-rail-nav" aria-label={t('nav.navigation')}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="zx-rail-item"
            data-active={props.view === item.id ? 'true' : undefined}
            aria-current={props.view === item.id ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={() => props.onChange(item.id)}
          >
            {item.icon}
            {item.id === 'messages' && props.unread > 0 ? <span className="zx-rail-dot" /> : null}
          </button>
        ))}
      </nav>

      <div className="zx-rail-foot">
        <button
          type="button"
          className="zx-rail-me"
          aria-label={t('nav.me')}
          title={t('nav.me')}
          onClick={() => setMenu((current) => (current === 'account' ? 'none' : 'account'))}
        >
          {(props.accountName ?? '我').slice(0, 1)}
        </button>
        {menu === 'account' ? (
          <>
            <button type="button" className="zx-rail-scrim" aria-label={t('common.close')} onClick={() => setMenu('none')} />
            <div className="zx-rail-menu zx-rail-menu-foot" role="menu">
              <div className="zx-rail-menu-account">
                <span className="zx-rail-menu-mark">{(props.accountName ?? '我').slice(0, 1)}</span>
                <span className="zx-rail-menu-text">
                  <strong>{props.accountName ?? t('nav.me')}</strong>
                  <small>{active?.name ?? ''}</small>
                </span>
              </div>
              <span className="zx-rail-menu-label">{t('appearance.title')}</span>
              {(['dark', 'light', 'system'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="zx-rail-menu-item zx-rail-menu-plain"
                  data-active={props.appearance === choice ? 'true' : undefined}
                  onClick={() => props.onAppearance(choice)}
                >
                  {t(`appearance.${choice}`)}
                </button>
              ))}
              <span className="zx-rail-menu-sep" />
              <button
                type="button"
                className="zx-rail-menu-item zx-rail-menu-plain"
                onClick={() => {
                  setMenu('none');
                  props.onOpenSettings();
                }}
              >
                {t('nav.platformSettings')}
              </button>
              <button
                type="button"
                className="zx-rail-menu-item zx-rail-menu-plain"
                onClick={() => {
                  setMenu('none');
                  props.onSignOut();
                }}
              >
                {t('account.menu.signOut')}
              </button>
              <span className="zx-rail-menu-sep" />
              <div className="zx-rail-menu-version">
                <span>{t('nav.version')}</span>
                <span>v{props.appVersion}</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Appearance } from '../../shared/appearance';
import type { ServerSummary } from '../../shared/contract';
import './settings-sheet.css';

/**
 * The settings of the client itself: the appearance, the server, and the
 * session.
 *
 * These are the facts the client keeps on this computer, so this sheet is the
 * one place the user changes them.
 */

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  servers: ServerSummary[];
  activeServerId: string | null;
  onRemoveServer: (serverId: string) => void;
  onSignOut: () => void;
  /** The name of the signed-in user, when the client knows it. */
  accountName: string | null;
}

export function SettingsSheet(props: SettingsSheetProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<'signOut' | string | null>(null);

  if (!props.open) return null;

  const appearances: Array<{ id: Appearance; label: string }> = [
    { id: 'dark', label: t('appearance.dark') },
    { id: 'light', label: t('appearance.light') },
    { id: 'system', label: t('appearance.system') },
  ];

  return (
    <div className="zx-sheet-scrim" onClick={props.onClose}>
      <aside
        className="zx-sheet"
        aria-label={t('appearance.settings')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="zx-sheet-header">
          <h2 className="zx-sheet-title">{t('appearance.settings')}</h2>
          <button
            type="button"
            className="zx-sheet-close"
            aria-label={t('common.close')}
            onClick={props.onClose}
          >
            ×
          </button>
        </header>

        <div className="zx-sheet-body">
          {props.accountName ? <p className="zx-sheet-account">{props.accountName}</p> : null}

          <section className="zx-sheet-section">
            <span className="zx-field-label">{t('appearance.title')}</span>
            <div className="zx-sheet-segment">
              {appearances.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="zx-sheet-segment-item"
                  data-active={props.appearance === item.id ? 'true' : undefined}
                  onClick={() => props.onAppearance(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="zx-sheet-section">
            <span className="zx-field-label">{t('server.title')}</span>
            <ul className="zx-sheet-list">
              {props.servers.map((server) => (
                <li key={server.id} className="zx-sheet-row">
                  <span className="zx-sheet-row-text">
                    <strong>{server.name}</strong>
                    <small>{server.url}</small>
                  </span>
                  {server.id === props.activeServerId ? (
                    <span className="zx-sheet-current">{t('server.current')}</span>
                  ) : confirming === server.id ? (
                    <button
                      type="button"
                      className="zx-agent-danger"
                      onClick={() => {
                        props.onRemoveServer(server.id);
                        setConfirming(null);
                      }}
                    >
                      {t('common.confirm')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="zx-agent-danger"
                      onClick={() => setConfirming(server.id)}
                    >
                      {t('server.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="zx-sheet-section">
            <span className="zx-field-label">{t('account.menu.signOut')}</span>
            {confirming === 'signOut' ? (
              <button
                type="button"
                className="zx-agent-danger"
                onClick={() => {
                  props.onSignOut();
                  setConfirming(null);
                }}
              >
                {t('common.confirm')}
              </button>
            ) : (
              <button type="button" className="zx-agent-danger" onClick={() => setConfirming('signOut')}>
                {t('account.menu.signOut')}
              </button>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

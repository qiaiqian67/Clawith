import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import { TeamMark } from './TeamMark';
import './first-run.css';

/**
 * The first-run screen: one question, then the app opens.
 *
 * The team of marks rises above the question. The question is the only thing
 * on the screen that carries a choice, so the answer is one click away.
 */

export interface FirstRunFlowProps {
  /** Whether the client is already talking to a server with a signed-in user. */
  ready: boolean;
  /** The failure of the readiness check, when there is one. */
  error: string | null;
  onStartFree: () => void;
  onUsePlan: () => void;
  onRetry: () => void;
}

export function FirstRunFlow(props: FirstRunFlowProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    (action: () => void) => {
      if (busy) return;
      setBusy(true);
      action();
    },
    [busy],
  );

  return (
    <main className="zx-first-run">
      <div className="zx-first-run-shell">
        <TeamMark />

        <h1 className="zx-first-run-title">{t('onboarding.title')}</h1>
        <p className="zx-first-run-subtitle">{t('onboarding.subtitle')}</p>

        <div className="zx-first-run-rows">
          <button
            type="button"
            className="zx-first-run-row"
            disabled={busy || props.ready}
            onClick={() => start(props.onStartFree)}
          >
            <span className="zx-first-run-row-text">
              <strong>{t('onboarding.freeTitle')}</strong>
              <small>{t('onboarding.freeDescription')}</small>
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="zx-first-run-chevron">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            className="zx-first-run-row"
            disabled={busy || props.ready}
            onClick={() => start(props.onUsePlan)}
          >
            <span className="zx-first-run-row-text">
              <strong>{t('onboarding.planTitle')}</strong>
              <small>{t('onboarding.planDescription')}</small>
            </span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="zx-first-run-chevron">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {props.error ? (
          <p className="zx-first-run-error" role="alert">
            {props.error}
          </p>
        ) : null}

        {props.ready ? (
          <div className="zx-first-run-ready">
            <AppLogo />
            <p>{t('onboarding.opening')}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

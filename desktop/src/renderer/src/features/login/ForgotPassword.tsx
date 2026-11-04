import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import './account-login.css';

/**
 * The screens that give an account back.
 *
 * A person who cannot sign in asks for a code at their address, and then
 * names that code with a new password. Two screens, because the code arrives
 * somewhere else and the client must not ask for both at once.
 */

export interface ForgotPasswordProps {
  busy: boolean;
  error: string | null;
  /** The code was sent to this address, so the second screen shows. */
  sentTo: string | null;
  done: boolean;
  onRequest: (email: string) => void;
  onReset: (code: string, password: string) => void;
  onBack: () => void;
}

export function ForgotPassword(props: ForgotPasswordProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');

  // The mail carries a link, and a person who copies it should not have to
  // cut the token out of it by hand.
  const token = readToken(tokenInput);

  const reset = useCallback(() => {
    if (password.length < 6 || password !== repeat || token.length < 20) return;
    props.onReset(token, password);
  }, [password, props, repeat, token]);

  return (
    <main className="zx-login-screen">
      <div className="zx-login-shell">
        <header className="zx-login-lockup">
          <AppLogo />
          <span className="zx-login-wordmark">ZeroX</span>
        </header>

        <h1 className="zx-login-title">
          {props.sentTo ? t('password.resetTitle') : t('password.forgotTitle')}
        </h1>
        <p className="zx-login-subtitle">
          {props.sentTo ? t('password.resetSubtitle', { email: props.sentTo }) : t('password.forgotSubtitle')}
        </p>

        {props.sentTo === null ? (
          <>
            <div className="zx-login-field">
              <input
                className="zx-login-input"
                type="email"
                autoFocus
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') props.onRequest(email.trim());
                }}
              />
            </div>
            {props.error ? <p className="zx-login-error">{props.error}</p> : null}
            <button
              type="button"
              className="zx-login-action"
              disabled={props.busy || !email.trim()}
              onClick={() => props.onRequest(email.trim())}
            >
              {props.busy ? t('common.loading') : t('password.sendCode')}
            </button>
          </>
        ) : props.done ? (
          <p className="zx-login-note">{t('password.done')}</p>
        ) : (
          <>
            <div className="zx-login-field">
              <span className="zx-field-label">{t('password.token')}</span>
              <input
                className="zx-field-input"
                autoFocus
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
              />
              <span className="zx-login-hint">{t('password.tokenHint')}</span>
            </div>
            <div className="zx-login-field">
              <span className="zx-field-label">{t('password.newPassword')}</span>
              <input
                className="zx-field-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="zx-login-hint">{t('register.passwordHint')}</span>
            </div>
            <div className="zx-login-field">
              <span className="zx-field-label">{t('password.repeat')}</span>
              <input
                className="zx-field-input"
                type="password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') reset();
                }}
              />
            </div>
            {props.error ? <p className="zx-login-error">{props.error}</p> : null}
            <button
              type="button"
              className="zx-login-submit"
              disabled={props.busy || token.length < 20 || password.length < 6 || password !== repeat}
              onClick={reset}
            >
              {props.busy ? t('common.loading') : t('password.reset')}
            </button>
          </>
        )}

        <div className="zx-login-secondary">
          <button type="button" onClick={props.onBack}>
            {t('password.backToSignIn')}
          </button>
        </div>
      </div>
    </main>
  );
}

/** The token inside a reset link, or the token itself. */
function readToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/[?&]token=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  return trimmed;
}

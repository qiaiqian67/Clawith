import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import './account-login.css';

/**
 * The account creation screen.
 *
 * A new installation has no account, so the client must be able to make one.
 * The server names the first account the platform administrator.
 */

export interface AccountRegisterProps {
  /** The password or the address was refused. */
  error: string | null;
  /** Whether the server asks for an invitation code. */
  invitationRequired: boolean;
  busy: boolean;
  onRegister: (input: { username: string; email: string; password: string }) => void;
  onCancel: () => void;
}

export function AccountRegister(props: AccountRegisterProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = useCallback(() => {
    const trimmedEmail = email.trim();
    const trimmedName = username.trim();
    if (!trimmedEmail || !trimmedName || password.length < 6 || props.busy) return;
    props.onRegister({ username: trimmedName, email: trimmedEmail, password });
  }, [email, password, props, username]);

  return (
    <main className="zx-login-screen">
      <div className="zx-login-shell">
        <header className="zx-login-lockup">
          <AppLogo />
          <span className="zx-login-wordmark">ZeroX</span>
        </header>

        <h1 className="zx-login-title">{t('register.title')}</h1>
        <p className="zx-login-subtitle">{t('register.subtitle')}</p>

        <div className="zx-login-field">
          <span className="zx-field-label">{t('register.username')}</span>
          <input
            className="zx-field-input"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="zx-login-field">
          <span className="zx-field-label">{t('register.email')}</span>
          <input
            className="zx-field-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="zx-login-field">
          <span className="zx-field-label">{t('register.password')}</span>
          <input
            className="zx-field-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <p className="zx-login-hint">{t('register.passwordHint')}</p>
        </div>

        {props.invitationRequired ? (
          <p className="zx-login-hint">{t('register.invitationRequired')}</p>
        ) : null}

        {props.error ? (
          <p className="zx-login-error" role="alert">
            {props.error}
          </p>
        ) : null}

        <div className="zx-login-secondary">
          <button type="button" onClick={props.onCancel}>
            {t('register.backToSignIn')}
          </button>
        </div>

        <button
          type="button"
          className="zx-login-submit"
          disabled={props.busy || !username.trim() || !email.trim() || password.length < 6}
          onClick={submit}
        >
          {props.busy ? t('common.loading') : t('register.submit')}
        </button>
      </div>
    </main>
  );
}

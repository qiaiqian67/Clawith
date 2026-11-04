import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import { OtpInput, type OtpInputStatus } from './OtpInput';
import './account-login.css';

/**
 * The sign-in screen.
 *
 * One question at a time: the address, then the code. The code screen keeps
 * the address on screen so the reader knows where the code went, and the
 * resend button counts down instead of disappearing.
 */

export interface AccountLoginProps {
  /** The address the code was sent to, when the code screen is shown. */
  email: string | null;
  /** Whether a code is on its way. */
  sending: boolean;
  /** Whether the code is being checked. */
  verifying: boolean;
  /** The error of the last attempt, if any. */
  error: string | null;
  /** The address the server has this account. */
  accountEmail?: string | null;
  onRequestCode: (email: string) => void;
  onVerifyCode: (email: string, code: string) => void;
  onChangeEmail: () => void;
  onResend: () => void;
  /** The seconds until the code may be requested again. */
  resendIn: number;
  /** Open the account creation screen. */
  onSignUp?: () => void;
  /** Open the password reset screen. */
  onForgot?: () => void;
}

export function AccountLogin(props: AccountLoginProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (props.email === null) {
      queueMicrotask(() => emailRef.current?.focus({ preventScroll: true }));
    }
  }, [props.email]);

  const status: OtpInputStatus = props.verifying
    ? 'verifying'
    : props.error
      ? 'error'
      : 'idle';

  const submitEmail = useCallback(() => {
    const trimmed = email.trim();
    if (!trimmed || props.sending) return;
    props.onRequestCode(trimmed);
  }, [email, props]);

  const submitCode = useCallback(
    (value: string) => {
      if (!props.email || props.verifying) return;
      props.onVerifyCode(props.email, value);
    },
    [props],
  );

  if (props.email !== null) {
    return (
      <main className="zx-login-screen">
        <div className="zx-login-shell">
          <header className="zx-login-lockup">
            <AppLogo />
            <span className="zx-login-wordmark">ZeroX</span>
          </header>

          <h1 className="zx-login-title">{t('login.codeSent', { email: props.email })}</h1>
          <p className="zx-login-subtitle">{t('login.codeHint', { count: 6 })}</p>

          <div className="zx-login-field">
            <OtpInput
              value={code}
              length={6}
              numeric
              label={t('login.codeHint', { count: 6 })}
              status={status}
              errorMessage={props.error}
              hint={props.verifying ? t('login.verifying') : undefined}
              autofocus
              onChange={setCode}
              onComplete={submitCode}
            />
          </div>

          {props.onSignUp ? (
            <p className="zx-login-note">
              {t('login.nothingArrived')}{' '}
              <button type="button" className="zx-login-link" onClick={props.onSignUp}>
                {t('register.signUp')}
              </button>
            </p>
          ) : null}

          <div className="zx-login-secondary">
            <button type="button" onClick={props.onChangeEmail}>
              {t('login.changeEmail')}
            </button>
            <button type="button" onClick={props.onResend} disabled={props.resendIn > 0}>
              {props.resendIn > 0 ? t('login.resendIn', { seconds: props.resendIn }) : t('login.resend')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="zx-login-screen">
      <div className="zx-login-shell">
        <header className="zx-login-lockup">
          <AppLogo />
          <span className="zx-login-wordmark">ZeroX</span>
        </header>

        <h1 className="zx-login-title">{t('login.title')}</h1>
        <p className="zx-login-subtitle">{t('login.subtitle')}</p>

        <div className="zx-login-field">
          <input
            ref={emailRef}
            className="zx-login-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitEmail();
            }}
          />
        </div>

        {props.error ? <p className="zx-login-error">{props.error}</p> : null}

        <button
          type="button"
          className="zx-login-action"
          disabled={!email.trim() || props.sending}
          onClick={submitEmail}
        >
          {props.sending ? t('common.loading') : t('login.sendCode')}
        </button>

        {props.onSignUp ? (
          <p className="zx-login-note">
            {t('loginExtra.noAccount')}{' '}
            <button type="button" className="zx-login-link" onClick={props.onSignUp}>
              {t('register.signUp')}
            </button>
          </p>
        ) : null}

        {props.onForgot ? (
          <p className="zx-login-note">
            <button type="button" className="zx-login-link" onClick={props.onForgot}>
              {t('password.forgot')}
            </button>
          </p>
        ) : null}

        <p className="zx-login-note">🔒 {t('login.privacy')}</p>
      </div>
    </main>
  );
}

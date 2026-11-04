import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import { OtpInput, type OtpInputStatus } from './OtpInput';
import './account-login.css';

/**
 * The screen that proves the address of a new account.
 *
 * The server mails a six-digit code when an account is made. The account
 * stays inactive until the code names it, so this screen is not optional: a
 * client without it leaves a new user with a code and nowhere to type it.
 */

export interface VerifyEmailProps {
  /** The address the code went to. */
  email: string;
  /** Whether the code is being checked. */
  verifying: boolean;
  /** The failure of the last attempt. */
  error: string | null;
  /** Whether the code was accepted. */
  verified: boolean;
  /** The seconds until the code may be sent again. */
  resendIn: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  /** Go back to the account form, when the address was wrong. */
  onBack: () => void;
  /** Continue without verifying, for an account the server already activated. */
  onSkip?: () => void;
}

export function VerifyEmail(props: VerifyEmailProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  // The code belongs to one address, so a new address starts the field over.
  useEffect(() => {
    const timer = window.setTimeout(() => setCode(''), 0);
    return () => window.clearTimeout(timer);
  }, [props.email]);

  const status: OtpInputStatus = props.verified
    ? 'success'
    : props.verifying
      ? 'verifying'
      : props.error
        ? 'error'
        : 'idle';

  const resend = useCallback(() => {
    if (props.resendIn > 0 || props.verifying) return;
    props.onResend();
  }, [props]);

  return (
    <main className="zx-login-screen">
      <div className="zx-login-shell">
        <header className="zx-login-lockup">
          <AppLogo />
          <span className="zx-login-wordmark">ZeroX</span>
        </header>

        <h1 className="zx-login-title">{t('verify.title')}</h1>
        <p className="zx-login-subtitle">{t('verify.subtitle', { email: props.email })}</p>

        <div className="zx-login-otp">
          <OtpInput
            value={code}
            length={6}
            numeric
            label={t('verify.code')}
            status={status}
            errorMessage={props.error}
            successMessage={t('verify.done')}
            hint={props.verifying ? t('login.verifying') : t('verify.hint')}
            autofocus
            onChange={setCode}
            onComplete={(value) => props.onVerify(value)}
          />
        </div>

        <div className="zx-login-secondary">
          <button type="button" onClick={props.onBack} disabled={props.verifying}>
            {t('verify.back')}
          </button>
          <button type="button" onClick={resend} disabled={props.resendIn > 0 || props.verifying}>
            {props.resendIn > 0 ? t('login.resendIn', { seconds: props.resendIn }) : t('verify.resend')}
          </button>
        </div>

        {props.onSkip ? (
          <button type="button" className="zx-login-skip" onClick={props.onSkip}>
            {t('verify.skip')}
          </button>
        ) : null}
      </div>
    </main>
  );
}

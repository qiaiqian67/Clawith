import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageWheel } from './LanguageWheel';
import { AppLogo } from '../../brand/AppLogo';
import { desktopApi } from '../../shared/bridge';

/**
 * The first screen of the client: the language choice.
 *
 * The choice is stored in the desktop preferences when the bridge is there.
 * Without the bridge it lives in the page, so the interface can be worked on
 * in a browser.
 */
export function LanguageGate() {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string>(() => i18n.resolvedLanguage ?? 'zh');

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [i18n, language]);

  useEffect(() => {
    void desktopApi()?.setPreferences({ language });
  }, [language]);

  return (
    <LanguageWheel language={language} onChange={setLanguage} logo={<AppLogo />} />
  );
}

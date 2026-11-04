/**
 * The appearance of the window.
 *
 * The preference names the appearance, and this module puts it on the
 * document. One owner for the attribute, so a surface reads the theme from
 * its tokens and not from a second copy of the choice.
 */

export type Appearance = 'dark' | 'light' | 'system';

/** The appearance a preference names, with the system resolved. */
export function resolveAppearance(preference: Appearance): 'dark' | 'light' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Put the appearance on the document. */
export function applyAppearance(preference: Appearance): 'dark' | 'light' {
  const resolved = resolveAppearance(preference);
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

/**
 * Follow the system while the preference is `system`.
 *
 * The listener ends when the preference changes, so the client never keeps
 * two opinions about the appearance.
 */
export function watchSystemAppearance(preference: Appearance, onChange: () => void): () => void {
  if (preference !== 'system' || !window.matchMedia) {
    return () => undefined;
  }
  const query = window.matchMedia('(prefers-color-scheme: light)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

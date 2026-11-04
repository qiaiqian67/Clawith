/**
 * The address of a ZeroX server.
 *
 * One owner for the rule: the address the user types becomes the address the
 * client talks to. A blank address and an address with another scheme are
 * refused here, so no other layer has to check them.
 */

/**
 * Turn what the user typed into the address the client uses.
 *
 * A missing scheme becomes `https`, a trailing slash is dropped, and a path
 * is kept. The port stays.
 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('A server address must not be blank.');
  }
  // A scheme that is there but is not http or https is a mistake, not a
  // missing scheme. It is refused instead of being replaced.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1])) {
    throw new Error('The server address must use http or https.');
  }
  const withScheme = schemeMatch ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('The server address is not a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('The server address must use http or https.');
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

/** The host name of an address, for a server the user gave no name. */
export function hostNameOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

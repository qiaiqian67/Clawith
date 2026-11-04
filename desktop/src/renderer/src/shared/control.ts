import { apiRequest } from './http.ts';

/**
 * Taking over the screen of an assistant.
 *
 * An assistant may run in a browser or on a computer. When the user takes
 * over, the client locks the session, sends the clicks and the keys, and
 * asks for a picture of the screen.
 */

/** The answer of every control call. */
export interface ControlAnswer {
  status: 'ok' | 'error';
  detail?: string;
}

/** One picture of the screen. */
export interface ControlScreenshot {
  image: string;
  width?: number;
  height?: number;
}

/** The address the session is on. */
export interface ControlUrl {
  url: string;
  title?: string;
}

/** Lock the session, so the user may drive it. */
export async function lockSession(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  platformHint?: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/control/lock`, {
    token,
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, platform_hint: platformHint ?? null }),
  });
}

/** Let the assistant drive the session again. */
export async function unlockSession(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}/api/agents/${agentId}/control/unlock`, {
    token,
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

/** A picture of the screen. */
export async function takeScreenshot(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
): Promise<ControlScreenshot | null> {
  try {
    return await apiRequest<ControlScreenshot>(
      `${baseUrl}/api/agents/${agentId}/control/screenshot`,
      { token, method: 'POST', body: JSON.stringify({ session_id: sessionId }) },
    );
  } catch {
    return null;
  }
}

/** The address the session is on. */
export async function readCurrentUrl(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
): Promise<ControlUrl | null> {
  try {
    return await apiRequest<ControlUrl>(`${baseUrl}/api/agents/${agentId}/control/current-url`, {
      token,
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    return null;
  }
}

/** A click. */
export async function clickAt(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
): Promise<ControlAnswer> {
  return apiRequest<ControlAnswer>(`${baseUrl}/api/agents/${agentId}/control/click`, {
    token,
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, x, y, button }),
  });
}

/** A word written into the session. */
export async function typeText(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  text: string,
): Promise<ControlAnswer> {
  return apiRequest<ControlAnswer>(`${baseUrl}/api/agents/${agentId}/control/type`, {
    token,
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, text }),
  });
}

/** Keys pressed together. */
export async function pressKeys(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  keys: string[],
): Promise<ControlAnswer> {
  return apiRequest<ControlAnswer>(`${baseUrl}/api/agents/${agentId}/control/press_keys`, {
    token,
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, keys }),
  });
}

/** A drag. */
export async function drag(
  baseUrl: string,
  token: string,
  agentId: string,
  sessionId: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs = 600,
): Promise<ControlAnswer> {
  return apiRequest<ControlAnswer>(`${baseUrl}/api/agents/${agentId}/control/drag`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      from_x: from.x,
      from_y: from.y,
      to_x: to.x,
      to_y: to.y,
      duration_ms: durationMs,
    }),
  });
}

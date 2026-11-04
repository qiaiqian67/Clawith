import { desktopApi } from './bridge.ts';
import type { HttpRequest, HttpResponse } from './http-contract';

/**
 * The one way the client talks to the server.
 *
 * Every call goes through here, so three facts hold everywhere: a failed
 * request carries its status code, a request that needs a session says so
 * when the session is gone, and a network failure has one shape.
 */

/** A request that did not succeed. */
export class ApiError extends Error {
  /** The status the server answered. Zero means the server was not there. */
  readonly status: number;
  /** A short code for the failure. */
  readonly code: string;

  constructor(message: string, status: number, code = 'http_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** Whether the session of the client is gone. */
  get isSessionExpired(): boolean {
    return this.status === 401;
  }

  /** Whether the server was not there at all. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Be told when the session of the client is gone.
 *
 * The token of a session ends. Every surface that reads it learns about it
 * through this one event, so the client returns to the sign-in screen once
 * and not once per call.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** Tell every listener that the session is gone. */
export function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

/** The options of one request. */
export interface RequestOptions {
  /** The token of the session. Without it the call is public. */
  token?: string | null;
  /** The method of the request. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The body of the request, as text. */
  body?: string;
  /** The headers of the request. */
  headers?: Record<string, string>;
  /** How long the client waits, in milliseconds. */
  timeoutMs?: number;
}

/**
 * One request to the server.
 *
 * The answer is the parsed body. A failure throws an `ApiError` with the
 * status of the server and the message the server sent.
 */
export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { token, method = 'GET', body, headers, timeoutMs } = options;

  const answer = await send({
    url,
    method,
    body,
    timeoutMs,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  if (answer.status === 0) {
    throw new ApiError('The server could not be reached.', 0, 'network_error');
  }
  if (answer.status >= 400) {
    if (answer.status === 401) {
      notifySessionExpired();
    }
    throw new ApiError(
      readDetail(answer.body, `The server answered ${answer.status}.`),
      answer.status,
      'http_error',
    );
  }
  if (answer.status === 204 || !answer.body) {
    return undefined as T;
  }
  try {
    return JSON.parse(answer.body) as T;
  } catch {
    throw new ApiError(
      'The server answered something the client cannot read.',
      answer.status,
      'bad_payload',
    );
  }
}

/**
 * The text of one request, without the JSON reading.
 *
 * A caller that wants the body decides what to do with it, and a caller that
 * wants the status gets it either way.
 */
export async function apiRequestText(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const { token, method = 'GET', body, headers, timeoutMs } = options;
  return send({
    url,
    method,
    body,
    timeoutMs,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });
}

/**
 * Perform one request.
 *
 * The packaged client asks the main process, because the page runs on
 * `app://` and the server lives on another origin. A page without the bridge
 * makes the call itself.
 */
async function send(request: HttpRequest): Promise<HttpResponse> {
  const bridge = desktopApi();
  if (bridge) {
    return bridge.requestHttp(request);
  }
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.timeoutMs ? { signal: AbortSignal.timeout(request.timeoutMs) } : {}),
    });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: '' };
  }
}

/** The message of a failure that the server sent as JSON. */
function readDetail(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
      const first = parsed.detail[0] as { msg?: unknown };
      if (typeof first.msg === 'string') return first.msg;
    }
  } catch {
    // A body that is not JSON carries no message.
  }
  return fallback;
}

/** The message of an error response. */
export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const first = body.detail[0] as { msg?: unknown };
      if (typeof first.msg === 'string') return first.msg;
    }
  } catch {
    // A body that is not JSON carries no message.
  }
  return fallback;
}
